<<<<<<< HEAD
const Load = require("../models/Load");
const { logAction } = require("../utils/auditLogger");
const { notifyDriver, notifyAdmins } = require("../utils/notify");
const { sendWhatsApp } = require("../utils/messaging");
const { getIO } = require("../utils/socket");

// Fetch all loads
exports.getAllLoads = async (req, res) => {
  try {
    const loads = await Load.find()
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");
    res.json(loads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch loads" });
  }
};

exports.approveLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);

    if (!load) {
      return res.status(404).json({ message: "Load not found" });
    }

    if (load.status !== "completed") {
      return res.status(400).json({ message: "Only completed loads can be approved" });
    }

    if (!load.podUrl) {
      return res.status(400).json({ message: "Cannot approve a load without a POD" });
    }

    const { note } = req.body;

    load.isApproved = true;
    load.reviewStatus = "approved";
    load.status = "approved";
    load.approvalNote = note || "";
    load.approvedAt = new Date();
    load.approvedBy = req.user?.email;
    load.rejectionNote = "";
    load.updatedBy = req.user?.email;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    await logAction({
      action: "approved", entity: "Load", entityId: load._id, req,
      details: `Approved load ${load.ticketNumber}`,
      metadata: { note: note || "" },
    });

    if (populatedLoad.driver?.email) {
      await notifyDriver(populatedLoad.driver.email, {
        title: "Load Approved",
        message: `Your load ${load.ticketNumber} has been approved.`,
        entity: "Load", entityId: load._id, action: "approved",
      });
    }
    if (populatedLoad.driver?.phone) {
      await sendWhatsApp({
        to: populatedLoad.driver.phone,
        body: `Load ${load.ticketNumber} has been approved. Well done!`,
      });
    }

    await notifyAdmins({
      title: "Load Approved",
      message: `Load ${populatedLoad.ticketNumber} was approved by ${req.user.name}`,
      entity: "Load", entityId: load._id, action: "approved",
    });

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json(populatedLoad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve load" });
  }
};

exports.rejectLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);

    if (!load) {
      return res.status(404).json({ message: "Load not found" });
    }

    if (load.status !== "completed") {
      return res.status(400).json({ message: "Only completed loads can be rejected" });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    load.isApproved = false;
    load.reviewStatus = "rejected";
    load.status = "rejected";
    load.rejectionNote = reason.trim();
    load.rejectedAt = new Date();
    load.rejectedBy = req.user?.email;
    load.approvalNote = "";
    load.updatedBy = req.user?.email;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    await logAction({
      action: "rejected", entity: "Load", entityId: load._id, req,
      details: `Rejected load ${load.ticketNumber}`,
      metadata: { reason: reason.trim() },
    });

    if (populatedLoad.driver?.email) {
      await notifyDriver(populatedLoad.driver.email, {
        title: "Load Rejected",
        message: `Your load ${load.ticketNumber} needs rework: ${reason.trim()}`,
        entity: "Load", entityId: load._id, action: "rejected",
      });
    }
    if (populatedLoad.driver?.phone) {
      await sendWhatsApp({
        to: populatedLoad.driver.phone,
        body: `Load ${load.ticketNumber} needs rework: ${reason.trim()}`,
      });
    }

    await notifyAdmins({
      title: "Load Rejected",
      message: `Load ${populatedLoad.ticketNumber} was rejected by ${req.user.name}`,
      entity: "Load", entityId: load._id, action: "rejected",
    });

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json(populatedLoad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject load" });
  }
};

=======
const Load = require("../models/Load");

// Fetch all loads
exports.getAllLoads = async (req, res) => {
  try {
    const loads = await Load.find()
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");
    res.json(loads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch loads" });
  }
};

exports.approveLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    const { note } = req.body;

    load.isApproved = true;
    load.approvalNote = note || "";
    load.updatedBy = req.user.email;

    await load.save();

    // Re-fetch with populate
    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    res.json(populatedLoad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve load" });
  }
};

>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
