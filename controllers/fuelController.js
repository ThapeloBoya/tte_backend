const Fuel = require("../models/Fuel");
const Truck = require("../models/Truck");
const { logAction } = require("../utils/auditLogger");

exports.getRecords = async (req, res) => {
  try {
    const { truck, startDate, endDate, page = 1, limit = 50, sort: rawSort = "-date" } = req.query;
    const filter = {};
    if (truck) filter.truck = truck;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const allowedSortFields = ["date", "-date", "liters", "-liters", "costPerLiter", "-costPerLiter", "totalCost", "-totalCost", "mileage", "-mileage", "vendor", "-vendor", "createdAt", "-createdAt"];
    const sort = allowedSortFields.includes(rawSort) ? rawSort : "-date";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Fuel.countDocuments(filter);
    const records = await Fuel.find(filter)
      .populate("truck", "registrationNumber model make fuelType")
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
    const record = await Fuel.findById(req.params.id)
      .populate("truck", "registrationNumber model make fuelType");
    if (!record) return res.status(404).json({ message: "Fuel record not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const { truck, date, liters, costPerLiter, mileage, vendor, fuelType, notes } = req.body;

    if (!truck || !liters || !costPerLiter) {
      return res.status(400).json({ message: "Truck, liters, and cost per liter are required" });
    }

    const truckDoc = await Truck.findById(truck);
    if (!truckDoc) return res.status(404).json({ message: "Truck not found" });

    const totalCost = Number(liters) * Number(costPerLiter);

    const record = await Fuel.create({
      truck, date: date ? new Date(date) : new Date(),
      liters: Number(liters), costPerLiter: Number(costPerLiter), totalCost,
      mileage: mileage ? Number(mileage) : undefined,
      vendor, fuelType: fuelType || "diesel", notes,
      createdBy: req.user?.email,
    });

    await logAction({
      action: "created", entity: "Fuel", entityId: record._id, req,
      details: `Fuel record created for ${truckDoc.registrationNumber} — ${liters}L $${totalCost}`,
    });

    const populated = await Fuel.findById(record._id)
      .populate("truck", "registrationNumber model make fuelType");

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const record = await Fuel.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Fuel record not found" });

    const allowedFields = ["date", "liters", "costPerLiter", "mileage", "vendor", "fuelType", "notes"];
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) record[f] = req.body[f];
    });

    if (req.body.liters || req.body.costPerLiter) {
      record.totalCost = Number(record.liters) * Number(record.costPerLiter);
    }

    record.createdBy = req.user?.email;
    await record.save();

    await logAction({
      action: "updated", entity: "Fuel", entityId: record._id, req,
      details: `Fuel record updated for truck ${record.truck} — ${record.liters}L $${record.totalCost}`,
    });

    const populated = await Fuel.findById(record._id)
      .populate("truck", "registrationNumber model make fuelType");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const record = await Fuel.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Fuel record not found" });

    await record.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Fuel", entityId: req.params.id, req,
      details: `Fuel record deleted for truck ${record.truck} — ${record.liters}L`,
    });

    res.json({ message: "Fuel record deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getStats = async (req, res) => {
  try {
    const stats = await Fuel.aggregate([
      {
        $group: {
          _id: null,
          totalLiters: { $sum: "$liters" },
          totalCost: { $sum: "$totalCost" },
          count: { $sum: 1 },
          avgCostPerLiter: { $avg: "$costPerLiter" },
        },
      },
    ]);

    const byTruck = await Fuel.aggregate([
      {
        $group: {
          _id: "$truck",
          totalLiters: { $sum: "$liters" },
          totalCost: { $sum: "$totalCost" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalCost: -1 } },
      { $limit: 10 },
    ]);

    await Truck.populate(byTruck, { path: "_id", select: "registrationNumber model make" });

    res.json({
      totalLiters: stats[0]?.totalLiters || 0,
      totalCost: stats[0]?.totalCost || 0,
      totalEntries: stats[0]?.count || 0,
      avgCostPerLiter: stats[0]?.avgCostPerLiter || 0,
      byTruck: byTruck.map((t) => ({
        truck: t._id,
        totalLiters: t.totalLiters,
        totalCost: t.totalCost,
        count: t.count,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
