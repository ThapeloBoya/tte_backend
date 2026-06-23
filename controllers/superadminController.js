
// backend/controllers/superadminController.js
const Load = require("../models/Load");
const User = require("../models/User");
const { logAction } = require("../utils/auditLogger");
const { getIO } = require("../utils/socket");

// Get all loads
exports.getAllLoads = async (req, res) => {
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

// Update load (approval, notes, etc.) with audit logging
exports.updateLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    const allowedFields = ["isApproved", "reviewStatus", "status", "approvalNote", "rejectionNote", "notes", "driver", "truck", "priority", "cargoType", "pickupLocation", "deliveryLocation", "collectionDate", "deliveryDate", "deliveryDay"];
    for (const key of Object.keys(req.body)) {
      if (allowedFields.includes(key)) {
        load[key] = req.body[key];
      }
    }

    if (req.user?.email) load.updatedBy = req.user.email;
    await load.save();

    const populated = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    await logAction({
      action: req.body.isApproved ? "approved" : "updated",
      entity: "Load", entityId: load._id, req,
      details: req.body.isApproved
        ? `Super admin approved load ${load.ticketNumber}`
        : `Super admin updated load ${load.ticketNumber}`,
    });

    const io = getIO();
    if (io) io.emit("loadUpdated", populated);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


