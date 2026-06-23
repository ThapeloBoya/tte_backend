
const express = require("express");
const router = express.Router();
const Load = require("../models/Load");
const Driver = require("../models/Driver");
const { generatePOD } = require("../controllers/generatePOD");
const path = require("path");
const { protect, authorize } = require("../middleware/authMiddleware");
const { ensureDriverProfile } = require("../utils/driverProfile");
const { logAction } = require("../utils/auditLogger");
const { notifyAdmins, notifyAdmin2 } = require("../utils/notify");
const { sendEmail } = require("../utils/email");
const { sendSMS, sendWhatsApp } = require("../utils/messaging");
const { getIO } = require("../utils/socket");
const { validatePODFile, createSafePODFilename } = require("../utils/fileUploadSafety");
const { normalizeDriverMilestones, normalizeDriverIssue } = require("../utils/loadValidation");

const canDriverTransition = (from, to) => {
  const current = from || "waiting";
  const transitions = {
    waiting: ["in transit"],
    assigned: ["in transit"],
    "in transit": ["completed"],
    completed: ["completed"],
  };

  return transitions[current]?.includes(to);
};

// GET /api/driver-loads/driver
router.get("/driver", protect, authorize("driver"), async (req, res) => {
  try {
    const { email } = req.query;
    if (email && email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: "Cannot fetch loads for another driver" });
    }

    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const loads = await Load.find({ driver: driver._id })
      .populate("customer", "name email phone address")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    res.json(loads);
  } catch (err) {
    console.error("Error fetching loads:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// PATCH /api/driver-loads/:id -> update load status, milestones, notes, or driver issue
router.patch("/:id", protect, authorize("driver"), async (req, res) => {
  try {
    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: req.params.id, driver: driver._id });

    if (!load) return res.status(404).json({ message: "Load not found" });

    const { status, notes, milestones, driverIssue } = req.body;

    if (status !== undefined) {
      if (!canDriverTransition(load.status, status)) {
        return res.status(400).json({ message: `Invalid driver status transition from ${load.status} to ${status}` });
      }
      load.status = status;

      if (status === "in transit" && !load.milestones?.arrivedPickupAt) {
        load.milestones = { ...(load.milestones?.toObject?.() || load.milestones || {}), arrivedPickupAt: new Date() };
      }

      if (status === "completed" && !load.milestones?.completedAt) {
        load.milestones = { ...(load.milestones?.toObject?.() || load.milestones || {}), completedAt: new Date() };
      }
    }
    if (notes !== undefined) load.notes = notes;
    if (milestones) {
      const safeMilestones = normalizeDriverMilestones(milestones);
      load.milestones = { ...(load.milestones?.toObject?.() || load.milestones || {}), ...safeMilestones };
    }
    if (driverIssue) {
      try {
        const safeIssue = normalizeDriverIssue(driverIssue);
        if (safeIssue) {
          load.driverIssue = {
            ...(load.driverIssue?.toObject?.() || load.driverIssue || {}),
            ...safeIssue,
          };
        }
      } catch (err) {
        return res.status(400).json({ message: "Invalid issue data" });
      }
    }
    load.updatedBy = req.user.email;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("customer", "name email phone address")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    await logAction({
      action: "status_updated", entity: "Load", entityId: load._id, req,
      details: `Driver updated load ${load.ticketNumber} — status: ${load.status}${driverIssue ? ", reported issue" : ""}`,
      metadata: { status, driverIssue: !!driverIssue },
    });

    if (driverIssue) {
      const loadPop = await Load.findById(load._id).populate("customer", "name").populate("truck", "registrationNumber");
      await notifyAdmins({
        title: "Issue Reported",
        message: `Driver ${req.user.name} reported "${driverIssue.type}" on load ${load.ticketNumber} — ${loadPop?.customer?.name || "Unknown"} to ${loadPop?.pickupLocation || "?"}`,
        entity: "Load", entityId: load._id, action: "issue_reported",
      });
    }

    if (status === "in transit" && load._id) {
      await notifyAdmins({
        title: "Load In Transit",
        message: `Load ${load.ticketNumber} is now in transit by ${req.user.name}`,
        entity: "Load", entityId: load._id, action: "status_updated",
      });

      if (populatedLoad?.customer?.email) {
        await sendEmail({
          to: populatedLoad.customer.email,
          subject: `Your shipment ${load.ticketNumber} is in transit`,
          html: `<p>Hi ${populatedLoad.customer.name},</p>
<p>Your shipment <strong>${load.ticketNumber}</strong> is now in transit.</p>
<p><strong>From:</strong> ${load.pickupLocation}</p>
<p><strong>To:</strong> ${load.deliveryLocation}</p>
<p>Track your shipment: <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}">${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}</a></p>`,
        });
      }
      if (populatedLoad?.customer?.phone) {
        await sendSMS({
          to: populatedLoad.customer.phone,
          body: `Your shipment ${load.ticketNumber} is in transit! From: ${load.pickupLocation} To: ${load.deliveryLocation}. Track: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}`,
        });
      }
    }

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json(populatedLoad);
    
  } catch (err) {
    console.error("Error updating load:", err);
    
    res.status(500).json({ message: "Server error" });
  }
});

// Generate POD for a load
router.post("/:id/generate-pod", protect, authorize("driver"), generatePOD);

router.post("/:id/pod", protect, authorize("driver"), async (req, res) => {
  try {
    if (!req.files || !req.files.pod) {
      return res.status(400).json({ message: "No POD file uploaded" });
    }

    const file = req.files.pod;
    const validationError = validatePODFile(file);
    if (validationError) return res.status(400).json({ message: validationError });

    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: req.params.id, driver: driver._id });
    if (!load) return res.status(404).json({ message: "Load not found" });

    const filename = createSafePODFilename(load, file.name);
    const uploadPath = path.join(__dirname, "../uploads", filename);

    await file.mv(uploadPath);

    load.podUrl = `/uploads/${filename}`;
    load.status = "completed";
    load.reviewStatus = "pending";
    load.isApproved = false;
    load.approvalNote = "";
    load.rejectionNote = "";
    load.milestones = {
      ...(load.milestones?.toObject?.() || load.milestones || {}),
      completedAt: load.milestones?.completedAt || new Date(),
    };
    load.updatedBy = req.user.email;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("customer", "name email phone address")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    await logAction({
      action: "pod_uploaded", entity: "Load", entityId: load._id, req,
      details: `Driver uploaded POD for load ${load.ticketNumber}`,
    });

    await notifyAdmin2({
      title: "POD Uploaded",
      message: `Driver ${req.user.name} uploaded POD for load ${load.ticketNumber}`,
      entity: "Load", entityId: load._id, action: "pod_uploaded",
    });

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
        body: `Your shipment ${load.ticketNumber} has been delivered! Track: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}. Thank you for shipping with us.`,
      });
    }

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json({ message: "POD uploaded successfully", load: populatedLoad });
  } catch (err) {
    console.error("Error uploading driver POD:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

