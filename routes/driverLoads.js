
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

      try {
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
      } catch (notifErr) {
        console.error("Notification error (non-fatal):", notifErr.message);
      }
    }

    if (status === "completed" && load._id) {
      await notifyAdmins({
        title: "Load Completed",
        message: `Driver ${req.user.name} marked load ${load.ticketNumber} as completed`,
        entity: "Load", entityId: load._id, action: "status_updated",
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
<p>Track your shipment: <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}">${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}</a></p>
<p>Thank you for shipping with us.</p>`,
          });
        }
        if (populatedLoad?.customer?.phone) {
          await sendSMS({
            to: populatedLoad.customer.phone,
            body: `Your shipment ${load.ticketNumber} has been delivered! Track: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}. Thank you for shipping with us.`,
          });
        }
      } catch (notifErr) {
        console.error("Completion notification error (non-fatal):", notifErr.message);
      }
    }

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);

    res.json(populatedLoad);
    
  } catch (err) {
    console.error("Error updating load:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
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
          body: `Your shipment ${load.ticketNumber} has been delivered! Track: ${process.env.FRONTEND_URL || "http://localhost:3000"}/track/${load.ticketNumber}. Thank you for shipping with us.`,
        });
      }
    } catch (notifErr) {
      console.error("POD notification error (non-fatal):", notifErr.message);
    }

    const io = getIO();
    if (io) io.emit("loadUpdated", populatedLoad);
    if (io) io.emit("podUploaded", { loadId: load._id, ticketNumber: load.ticketNumber });

    res.json({ message: "POD uploaded successfully", load: populatedLoad });
  } catch (err) {
    console.error("Error uploading driver POD:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/photo", protect, authorize("driver"), async (req, res) => {
  try {
    if (!req.files || !req.files.photo) {
      return res.status(400).json({ message: "No photo uploaded" });
    }

    const file = req.files.photo;
    const validationError = validatePODFile(file);
    if (validationError) return res.status(400).json({ message: validationError });

    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: req.params.id, driver: driver._id });
    if (!load) return res.status(404).json({ message: "Load not found" });

    const filename = createSafePODFilename(load, `photo-${file.name}`);
    const uploadPath = path.join(__dirname, "../uploads", filename);
    await file.mv(uploadPath);

    load.capturedPhotoUrl = `/uploads/${filename}`;
    load.updatedBy = req.user.email;
    await load.save();

    res.json({ message: "Photo saved", capturedPhotoUrl: load.capturedPhotoUrl });
  } catch (err) {
    console.error("Error uploading photo:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/driver-loads/:id/stops/:stopIndex — check in/out at a stop
router.patch("/:id/stops/:stopIndex", protect, authorize("driver"), async (req, res) => {
  try {
    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: req.params.id, driver: driver._id });
    if (!load) return res.status(404).json({ message: "Load not found" });

    const stopIndex = parseInt(req.params.stopIndex);
    if (stopIndex < 0 || stopIndex >= (load.stops || []).length) {
      return res.status(400).json({ message: "Invalid stop index" });
    }

    const { action } = req.body; // "arrive" or "depart"
    const stop = load.stops[stopIndex];

    if (action === "arrive") {
      stop.arrivedAt = stop.arrivedAt || new Date();
    } else if (action === "depart") {
      stop.departedAt = new Date();
    } else {
      return res.status(400).json({ message: "Invalid action. Use 'arrive' or 'depart'" });
    }

    load.markModified("stops");
    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("customer", "name email phone address")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    res.json(populatedLoad);
  } catch (err) {
    console.error("Error updating stop:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/driver-loads/:id/deliveries/:deliveryIndex — mark delivery item as delivered
router.patch("/:id/deliveries/:deliveryIndex", protect, authorize("driver"), async (req, res) => {
  try {
    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: req.params.id, driver: driver._id });
    if (!load) return res.status(404).json({ message: "Load not found" });

    const deliveryIndex = parseInt(req.params.deliveryIndex);
    if (deliveryIndex < 0 || deliveryIndex >= (load.deliveries || []).length) {
      return res.status(400).json({ message: "Invalid delivery index" });
    }

    load.deliveries[deliveryIndex].status = "delivered";
    load.markModified("deliveries");
    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("customer", "name email phone address")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    res.json(populatedLoad);
  } catch (err) {
    console.error("Error updating delivery:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/driver-loads/fuel — driver logs fuel for their current truck
router.post("/fuel", protect, authorize("driver"), async (req, res) => {
  try {
    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const Load = require("../models/Load");
    const Fuel = require("../models/Fuel");
    const Truck = require("../models/Truck");

    const activeLoad = await Load.findOne({ driver: driver._id, status: "in transit" })
      .populate("truck")
      .sort({ createdAt: -1 });

    if (!activeLoad || !activeLoad.truck) {
      return res.status(400).json({ message: "No active load with an assigned truck" });
    }

    const { liters, costPerLiter, vendor, fuelType, notes, mileage } = req.body;
    if (!liters || !costPerLiter) {
      return res.status(400).json({ message: "Liters and cost per liter are required" });
    }

    const totalCost = Number(liters) * Number(costPerLiter);

    const record = await Fuel.create({
      truck: activeLoad.truck._id,
      date: new Date(),
      liters: Number(liters),
      costPerLiter: Number(costPerLiter),
      totalCost,
      mileage: mileage ? Number(mileage) : undefined,
      vendor: vendor || "",
      fuelType: fuelType || "diesel",
      notes: notes || "",
      createdBy: req.user.email,
    });

    await logAction({
      action: "fuel_logged", entity: "Fuel", entityId: record._id, req,
      details: `Driver ${req.user.name} logged ${liters}L for ${activeLoad.truck.registrationNumber}`,
    });

    const populated = await Fuel.findById(record._id).populate("truck", "registrationNumber model make fuelType");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Error logging fuel:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/signature", protect, authorize("driver"), async (req, res) => {
  try {
    if (!req.files || !req.files.signature) {
      return res.status(400).json({ message: "No signature uploaded" });
    }

    const file = req.files.signature;
    const validationError = validatePODFile(file);
    if (validationError) return res.status(400).json({ message: validationError });

    const driver = await ensureDriverProfile(req.user);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const load = await Load.findOne({ _id: req.params.id, driver: driver._id });
    if (!load) return res.status(404).json({ message: "Load not found" });

    const filename = createSafePODFilename(load, `signature-${file.name}`);
    const uploadPath = path.join(__dirname, "../uploads", filename);
    await file.mv(uploadPath);

    load.signatureUrl = `/uploads/${filename}`;
    load.updatedBy = req.user.email;
    await load.save();

    res.json({ message: "Signature saved", signatureUrl: load.signatureUrl });
  } catch (err) {
    console.error("Error saving signature:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

