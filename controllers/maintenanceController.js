const Maintenance = require("../models/Maintenance");
const Truck = require("../models/Truck");
const { logAction } = require("../utils/auditLogger");
const { getIO } = require("../utils/socket");
const { notifyAdmins, notifySuperAdmin } = require("../utils/notify");

exports.getRecords = async (req, res) => {
  try {
    const { truck, status, page = 1, limit = 50, sort = "-createdAt" } = req.query;
    const filter = {};
    if (truck) filter.truck = truck;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Maintenance.countDocuments(filter);
    const records = await Maintenance.find(filter)
      .populate("truck", "registrationNumber model make mileage status")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id)
      .populate("truck", "registrationNumber model make mileage status");
    if (!record) return res.status(404).json({ message: "Maintenance record not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const { truck, serviceType, description, scheduledDate, scheduledMileage, cost, vendor, notes, status } = req.body;

    if (!truck || !serviceType) {
      return res.status(400).json({ message: "Truck and service type are required" });
    }

    const truckDoc = await Truck.findById(truck);
    if (!truckDoc) return res.status(404).json({ message: "Truck not found" });

    const record = await Maintenance.create({
      truck, serviceType, description,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      scheduledMileage: scheduledMileage ? Number(scheduledMileage) : undefined,
      cost: cost ? Number(cost) : 0,
      vendor, notes,
      status: status || "scheduled",
      createdBy: req.user?.email,
    });

    if (record.status === "scheduled" || record.status === "overdue") {
      truckDoc.status = "under maintenance";
      await truckDoc.save();
    }

    await logAction({
      action: "created", entity: "Maintenance", entityId: record._id, req,
      details: `Created maintenance record for ${truckDoc.registrationNumber} — ${serviceType}`,
    });

    await notifyAdmins({
      title: "Maintenance Scheduled",
      message: `${serviceType} scheduled for ${truckDoc.registrationNumber}`,
      entity: "Maintenance", entityId: record._id, action: "created",
    });

    const io = getIO();
    if (io) io.emit("truckUpdated", truckDoc);

    const populated = await Maintenance.findById(record._id)
      .populate("truck", "registrationNumber model make mileage status");

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Maintenance record not found" });

    const allowedFields = ["serviceType", "description", "scheduledDate", "scheduledMileage", "completedDate", "completedMileage", "status", "cost", "vendor", "notes"];
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) record[f] = req.body[f];
    });

    record.updatedBy = req.user?.email;
    await record.save();

    const truckDoc = await Truck.findById(record.truck);
    if (truckDoc) {
      if (record.status === "completed" && truckDoc.status === "under maintenance") {
        const hasOpen = await Maintenance.findOne({ truck: truckDoc._id, status: { $in: ["scheduled", "in progress", "overdue"] } });
        if (!hasOpen) {
          truckDoc.status = "available";
          await truckDoc.save();
        }
      }
      if ((record.status === "scheduled" || record.status === "overdue") && truckDoc.status !== "under maintenance") {
        truckDoc.status = "under maintenance";
        await truckDoc.save();
      }

      const io = getIO();
      if (io) io.emit("truckUpdated", truckDoc);
    }

    await logAction({
      action: "updated", entity: "Maintenance", entityId: record._id, req,
      details: `Updated maintenance record for truck ${truckDoc?.registrationNumber || record.truck} — ${record.serviceType} (${record.status})`,
    });

    const populated = await Maintenance.findById(record._id)
      .populate("truck", "registrationNumber model make mileage status");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.completeRecord = async (req, res) => {
  try {
    const { cost, completedMileage, notes, vendor } = req.body;
    const record = await Maintenance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Maintenance record not found" });

    record.status = "completed";
    record.completedDate = new Date();
    record.completedMileage = completedMileage ? Number(completedMileage) : undefined;
    record.cost = cost ? Number(cost) : record.cost;
    record.notes = notes || record.notes;
    record.vendor = vendor || record.vendor;
    record.updatedBy = req.user?.email;
    await record.save();

    const truckDoc = await Truck.findById(record.truck);
    if (truckDoc) {
      const hasOpen = await Maintenance.findOne({ truck: truckDoc._id, status: { $in: ["scheduled", "in progress", "overdue"] } });
      if (!hasOpen) {
        truckDoc.status = "available";
        await truckDoc.save();
      }

      const io = getIO();
      if (io) io.emit("truckUpdated", truckDoc);
    }

    await logAction({
      action: "completed", entity: "Maintenance", entityId: record._id, req,
      details: `Completed maintenance for ${truckDoc?.registrationNumber || record.truck} — ${record.serviceType} ($${record.cost})`,
    });

    await notifyAdmins({
      title: "Maintenance Completed",
      message: `${record.serviceType} completed for ${truckDoc?.registrationNumber || "truck"} — $${record.cost}`,
      entity: "Maintenance", entityId: record._id, action: "completed",
    });

    const populated = await Maintenance.findById(record._id)
      .populate("truck", "registrationNumber model make mileage status");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Maintenance record not found" });

    await record.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Maintenance", entityId: req.params.id, req,
      details: `Deleted maintenance record for truck ${record.truck} — ${record.serviceType}`,
    });

    const truckDoc = await Truck.findById(record.truck);
    if (truckDoc) {
      const hasOpen = await Maintenance.findOne({ truck: truckDoc._id, status: { $in: ["scheduled", "in progress", "overdue"] } });
      if (!hasOpen && truckDoc.status === "under maintenance") {
        truckDoc.status = "available";
        await truckDoc.save();
      }
      const io = getIO();
      if (io) io.emit("truckUpdated", truckDoc);
    }

    res.json({ message: "Maintenance record deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUpcoming = async (req, res) => {
  try {
    const overdue = await Maintenance.find({ status: "scheduled", scheduledDate: { $lte: new Date() } })
      .populate("truck", "registrationNumber model make mileage status")
      .sort("scheduledDate")
      .limit(20);

    const upcoming = await Maintenance.find({
      status: "scheduled",
      scheduledDate: { $gt: new Date(), $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    })
      .populate("truck", "registrationNumber model make mileage status")
      .sort("scheduledDate")
      .limit(20);

    const stats = await Maintenance.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalCost: { $sum: "$cost" },
        },
      },
    ]);

    const totalCost = await Maintenance.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$cost" } } },
    ]);

    res.json({
      overdue,
      upcoming,
      stats,
      totalMaintenanceCost: totalCost[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
