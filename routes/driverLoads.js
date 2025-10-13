const express = require("express");
const router = express.Router();
const Load = require("../models/Load");
const Driver = require("../models/Driver");
const { generatePOD } = require("../controllers/generatePOD");

// GET /api/loads/driver?email=driverEmail
router.get("/driver", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Driver email is required" });

    const driver = await Driver.findOne({ email });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const loads = await Load.find({ driver: driver._id }) // only loads for this driver
      .populate("customer", "name email")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    res.json(loads);
  } catch (err) {
    console.error("Error fetching loads:", err);
    res.status(500).json({ message: err.message });
  }
});



// PATCH /api/loads/:id -> update load (driver/admin)
router.patch("/:id", async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    const { status, notes, podUrl, updatedBy } = req.body;

    if (status !== undefined) load.status = status;
    if (notes !== undefined) load.notes = notes;
    if (podUrl !== undefined) load.podUrl = podUrl;
    if (updatedBy) load.updatedBy = updatedBy;

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("customer", "name email")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    res.json(populatedLoad);
  } catch (err) {
    console.error("Error updating load:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/loads/driver -> driver adds new load
router.post("/driver", async (req, res) => {
  try {
    const {
      customer,
      pickupLocation,
      deliveryLocation,
      truck,
      weight,
      cargoType,
      notes,
      driverEmail,
    } = req.body;

    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!pickupLocation) return res.status(400).json({ message: "Pickup location is required" });
    if (!deliveryLocation) return res.status(400).json({ message: "Delivery location is required" });

    const driver = await Driver.findOne({ email: driverEmail });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const newLoad = await Load.create({
      customer, // comes from dropdown -> already ObjectId
      driver: driver._id,
      pickupLocation,
      deliveryLocation,
      truck: truck || null,
      weight: weight ? Number(weight) : undefined,
      cargoType,
      notes,
      status: "waiting",
      createdBy: driverEmail,
    });

    const populatedLoad = await Load.findById(newLoad._id)
      .populate("customer", "name email")
      .populate("truck", "registrationNumber")
      .populate("driver", "email name");

    res.status(201).json(populatedLoad);
  } catch (err) {
    console.error("Error creating load:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Generate POD for a load
router.post("/:id/generate-pod", generatePOD);

module.exports = router;
