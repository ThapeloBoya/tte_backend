
const Load = require("../models/Load");
const Driver = require("../models/Driver");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { logAction } = require("../utils/auditLogger");
const { sendEmail } = require("../utils/email");
const { notifyDriver, notifyAdmin2, notifyAdmins } = require("../utils/notify");
const { sendSMS, sendWhatsApp } = require("../utils/messaging");
const { getIO } = require("../utils/socket");
const { validateCreateLoadBody, normalizeAdminLoadUpdate } = require("../utils/loadValidation");
const { validatePODFile, createSafePODFilename } = require("../utils/fileUploadSafety");

// Create load (admin)
exports.createLoad = async (req, res) => {
  try {
    const validationError = validateCreateLoadBody(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const {
      customer,
      driver,
      truck,
      collectionDate,
      deliveryDate,
      pickupLocation,
      deliveryLocation,
      deliveryDay,
      cargoType,
      priority,
      customerRef,
      notes,
      status,
      weight,
    } = req.body;

    const load = await Load.create({
      customer,
      driver: driver || undefined,
      truck,
      collectionDate: collectionDate ? new Date(collectionDate) : undefined,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      pickupLocation,
      deliveryLocation,
      deliveryDay,
      cargoType,
      priority: priority || "normal",
      customerRef,
      notes,
      status: status || (driver ? "assigned" : "waiting"),
      weight: weight ? Number(weight) : undefined,
    });

    await logAction({
      action: "created", entity: "Load", entityId: load._id, req,
      details: `Created load ${load.ticketNumber} for ${load.customer || "unknown"}`,
    });

    const createdLoad = await Load.findById(load._id).populate("driver", "name email").populate("truck", "registrationNumber").populate("customer", "name email");

    setImmediate(async () => {
      try {
        if (createdLoad?.customer?.email) {
          const trackUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/track`;
          await sendEmail({
            to: createdLoad.customer.email,
            subject: `Your shipment ${createdLoad.ticketNumber} has been created`,
            html: `<p>Hi ${createdLoad.customer.name},</p>
<p>Your shipment has been created.</p>
<p><strong>Ticket:</strong> ${createdLoad.ticketNumber}</p>
<p><strong>From:</strong> ${createdLoad.pickupLocation}</p>
<p><strong>To:</strong> ${createdLoad.deliveryLocation}</p>
<p>Track your shipment: <a href="${trackUrl}">${trackUrl}</a></p>
<p>Enter your ticket number on the tracking page to see live updates.</p>`,
          });
        } else {
          console.log("Load email skipped: customer email missing for", createdLoad?.ticketNumber, "- customer:", createdLoad?.customer?._id);
        }

        if (createdLoad?.driver?.email) {
          await notifyDriver(createdLoad.driver.email, {
            title: "New Load Assigned",
            message: `Load ${createdLoad.ticketNumber} assigned to you — ${createdLoad.pickupLocation} to ${createdLoad.deliveryLocation}`,
            entity: "Load", entityId: load._id, action: "assigned",
          });
        }

        if (createdLoad?.driver?.phone) {
          await sendWhatsApp({
            to: createdLoad.driver.phone,
            body: `New load assigned: ${createdLoad.ticketNumber}\nFrom: ${createdLoad.pickupLocation}\nTo: ${createdLoad.deliveryLocation}\nTrack: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${createdLoad.ticketNumber}`,
          });
        }

        if (createdLoad?.customer?.phone) {
          await sendSMS({
            to: createdLoad.customer.phone,
            body: `Your shipment ${createdLoad.ticketNumber} has been created. From: ${createdLoad.pickupLocation} To: ${createdLoad.deliveryLocation}. Track: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${createdLoad.ticketNumber}`,
          });
        }

        const io = getIO();
        if (io) io.emit("loadCreated", createdLoad);
      } catch (e) {
        console.error("Non-fatal error after load creation:", e);
      }
    });

    res.status(201).json(createdLoad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all loads
exports.getLoads = async (req, res) => {
  try {
    const loads = await Load.find()
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");
    res.json(loads);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get load by ID
exports.getLoadById = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");
    if (!load) return res.status(404).json({ message: "Load not found" });
    res.json(load);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update load
exports.updateLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);

    if (!load) {
      return res.status(404).json({ message: "Load not found" });
    }

    if (req.user.role === "driver") {
      const allowedFields = ["status"];
      Object.keys(req.body).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete req.body[key];
        }
      });
      Object.keys(req.body).forEach((key) => {
        load[key] = req.body[key];
      });
    } else {
      let updates;
      try {
        updates = normalizeAdminLoadUpdate(req.body);
      } catch (valErr) {
        return res.status(400).json({ message: valErr.message });
      }
      Object.assign(load, updates);

      if (updates.driver && load.status === "waiting") {
        load.status = "assigned";
      }
    }

    load.updatedBy = req.user?.email || req.user?.id;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("customer", "name email")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    await logAction({
      action: "updated", entity: "Load", entityId: load._id, req,
      details: `Updated load ${load.ticketNumber} — status: ${load.status}`,
      metadata: { changes: Object.keys(req.body) },
    });

    setImmediate(async () => {
      try {
        if (req.body.driver && populatedLoad?.driver?.email) {
          await notifyDriver(populatedLoad.driver.email, {
            title: "New Load Assigned",
            message: `Load ${populatedLoad.ticketNumber} assigned to you — ${populatedLoad.pickupLocation} to ${populatedLoad.deliveryLocation}`,
            entity: "Load", entityId: load._id, action: "assigned",
          });
        }
        if (req.body.driver && populatedLoad?.driver?.phone) {
          await sendWhatsApp({
            to: populatedLoad.driver.phone,
            body: `New load assigned: ${populatedLoad.ticketNumber}\nFrom: ${populatedLoad.pickupLocation}\nTo: ${populatedLoad.deliveryLocation}\nTrack: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${populatedLoad.ticketNumber}`,
          });
        }
      } catch (e) {
        console.error("Non-fatal driver notification error:", e);
      }
    });

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json(populatedLoad);

  } catch (err) {
    console.error("Error updating load:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload POD
exports.uploadPOD = async (req, res) => {
  try {
    if (!req.files || !req.files.pod) {
      return res.status(400).json({ message: "No POD file uploaded" });
    }

    const file = req.files.pod;
    const validationError = validatePODFile(file);
    if (validationError) return res.status(400).json({ message: validationError });

    const load = await Load.findById(req.params.id);

    if (!load) {
      return res.status(404).json({ message: "Load not found" });
    }

    const filename = createSafePODFilename(load, file.name);
    const uploadPath = path.join(__dirname, "../uploads", filename);

    await file.mv(uploadPath);

    load.podUrl = `/uploads/${filename}`;
    load.status = "completed";
    load.reviewStatus = "pending";
    load.isApproved = false;
    load.approvalNote = "";
    load.rejectionNote = "";

    // ✅ FIX: use real auth user instead of params fantasy email
    load.updatedBy = req.user?.email || load.driver?.email;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);
    if (io) io.emit("podUploaded", { loadId: load._id, ticketNumber: load.ticketNumber });

    await logAction({
      action: "pod_uploaded", entity: "Load", entityId: load._id, req,
      details: `POD uploaded for load ${load.ticketNumber}`,
    });

    await notifyAdmin2({
      title: "POD Uploaded",
      message: `POD uploaded for load ${load.ticketNumber} by ${req.user.name}`,
      entity: "Load", entityId: load._id, action: "pod_uploaded",
    });

    try {
      if (populatedLoad?.customer?.email) {
        await sendEmail({
          to: populatedLoad.customer.email,
          subject: `Your shipment ${load.ticketNumber} has been delivered`,
          html: `<p>Hi ${populatedLoad.customer.name},</p>
<p>Your shipment <strong>${load.ticketNumber}</strong> has been delivered.</p>
<p><strong>From:</strong> ${load.pickupLocation}</p>
<p><strong>To:</strong> ${load.deliveryLocation}</p>
${load.podUrl ? `<p><a href="${process.env.BACKEND_URL || "http://localhost:5000"}${load.podUrl}">View Proof of Delivery</a></p>` : ""}
<p>Thank you for shipping with us.</p>`,
        });
      }
      if (populatedLoad?.customer?.phone) {
        await sendSMS({
          to: populatedLoad.customer.phone,
          body: `Your shipment ${load.ticketNumber} has been delivered! From: ${load.pickupLocation} To: ${load.deliveryLocation}. Thank you for shipping with us.`,
        });
      }
    } catch (notifErr) {
      console.error("POD notification error (non-fatal):", notifErr.message);
    }

    res.json({
      message: "POD uploaded successfully",
      load: populatedLoad
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// Delete load by ID
exports.deleteLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    await load.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Load", entityId: req.params.id, req,
      details: `Deleted load ${load.ticketNumber}`,
    });

    const io = getIO();
    if (io) io.emit("loadDeleted", { id: req.params.id, ticketNumber: load.ticketNumber });

    res.json({ message: "Load deleted successfully" });
  } catch (err) {
    console.error("Error deleting load:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resolveLoadIssue = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (!load.driverIssue?.description) return res.status(400).json({ message: "No issue reported on this load" });
    if (load.driverIssue.status === "resolved") return res.status(400).json({ message: "Issue already resolved" });

    const { note } = req.body;

    load.driverIssue.status = "resolved";
    load.driverIssue.resolutionNote = note || "";
    load.driverIssue.resolvedAt = new Date();
    load.driverIssue.resolvedBy = req.user?.email;
    load.updatedBy = req.user?.email;
    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    await logAction({
      action: "resolved", entity: "Load", entityId: load._id, req,
      details: `Resolved issue on load ${load.ticketNumber} — ${load.driverIssue?.type}`,
    });

    if (populatedLoad?.driver?.email) {
      await notifyDriver(populatedLoad.driver.email, {
        title: "Issue Resolved",
        message: `The issue on load ${populatedLoad.ticketNumber} has been resolved by ${req.user.name}.`,
        entity: "Load", entityId: load._id, action: "resolved",
      });
    }

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json(populatedLoad);
  } catch (err) {
    console.error("Error resolving load issue:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- BULK UPDATE STATUS ---
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });
    if (!status) return res.status(400).json({ message: "status is required" });
    const allowedStatuses = ["waiting", "assigned", "in transit", "completed", "approved", "rejected", "canceled"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const result = await Load.updateMany({ _id: { $in: ids } }, { status, updatedBy: req.user?.email });

    await logAction({
      action: "bulk_status", entity: "Load", entityId: `${ids.length} loads`, req,
      details: `Bulk updated ${result.modifiedCount} loads to status: ${status}`,
    });

    const io = getIO();
    if (io) ids.forEach((id) => io.emit("loadUpdated", { _id: id }));

    res.json({ message: `Updated ${result.modifiedCount} loads`, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- BULK ASSIGN DRIVER ---
exports.bulkAssignDriver = async (req, res) => {
  try {
    const { ids, driverId, truckId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });

    const updateData = {};
    if (driverId) updateData.driver = driverId;
    if (truckId) updateData.truck = truckId;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ message: "driverId or truckId required" });

    const result = await Load.updateMany(
      { _id: { $in: ids } },
      driverId ? { ...updateData, status: "assigned" } : updateData
    );

    await logAction({
      action: "bulk_assign", entity: "Load", entityId: `${ids.length} loads`, req,
      details: `Bulk assigned ${result.modifiedCount} loads`,
    });

    setImmediate(async () => {
      try {
        if (driverId) {
          const Driver = require("../models/Driver");
          const driver = await Driver.findById(driverId).select("email name phone");
          if (driver?.email) {
            const assignedLoads = await Load.find({ _id: { $in: ids } }).select("ticketNumber pickupLocation deliveryLocation").lean();
            for (const load of assignedLoads) {
              await notifyDriver(driver.email, {
                title: "New Load Assigned",
                message: `Load ${load.ticketNumber} assigned to you — ${load.pickupLocation} to ${load.deliveryLocation}`,
                entity: "Load", entityId: load._id, action: "assigned",
              });
            }
          }
          if (driver?.phone) {
            const assignedLoads = await Load.find({ _id: { $in: ids } }).select("ticketNumber pickupLocation deliveryLocation").lean();
            for (const load of assignedLoads) {
              await sendWhatsApp({
                to: driver.phone,
                body: `New load assigned: ${load.ticketNumber}\nFrom: ${load.pickupLocation}\nTo: ${load.deliveryLocation}\nTrack: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}`,
              });
            }
          }
        }
      } catch (e) {
        console.error("Non-fatal bulk assign notification error:", e);
      }
    });

    const io = getIO();
    if (io) ids.forEach((id) => io.emit("loadUpdated", { _id: id }));

    res.json({ message: `Assigned ${result.modifiedCount} loads`, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// --- BULK DELETE ---
exports.bulkDeleteLoads = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });

    const result = await Load.updateMany(
      { _id: { $in: ids } },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user?.email } }
    );

    await logAction({
      action: "bulk_delete", entity: "Load", entityId: `${ids.length} loads`, req,
      details: `Bulk deleted ${result.modifiedCount} loads`,
    });

    const io = getIO();
    if (io) ids.forEach((id) => io.emit("loadDeleted", { id }));

    res.json({ message: `Deleted ${result.deletedCount} loads`, deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create load by driver
exports.createLoadByDriver = async (req, res) => {
  try {
    const { pickupLocation, deliveryLocation, truck, weight, cargoType, notes, customer, driverEmail } = req.body;

    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!driverEmail) return res.status(400).json({ message: "Driver email is required" });

    const driver = await Driver.findOne({ email: driverEmail });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const ticketNumber = "TICKET-" + uuidv4().split("-")[0].toUpperCase();

    const load = await Load.create({
      driver: driver._id,
      customer,
      pickupLocation,
      deliveryLocation,
      truck: truck || undefined,
      weight: weight ? Number(weight) : undefined,
      cargoType,
      notes,
      status: "waiting",
      createdBy: driverEmail,
      podUrl: null,
      ticketNumber,
    });

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    res.status(201).json(populatedLoad);
  } catch (err) {
    console.error("Error creating load:", err);
    res.status(500).json({ message: err.message });
  }
};
