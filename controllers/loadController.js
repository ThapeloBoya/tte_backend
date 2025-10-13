const Load = require("../models/Load");
const Driver = require("../models/Driver");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

// Create load (admin)
exports.createLoad = async (req, res) => {
  try {
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

    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!truck) return res.status(400).json({ message: "Truck is required" });
    if (!pickupLocation) return res.status(400).json({ message: "Pickup location is required" });
    if (!deliveryLocation) return res.status(400).json({ message: "Delivery location is required" });

    const ticketNumber = "TICKET-" + uuidv4().split("-")[0].toUpperCase();

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
      status: status || "waiting",
      weight: weight ? Number(weight) : undefined,
      ticketNumber,
    });

    res.status(201).json(
      await Load.findById(load._id).populate("driver", "name email").populate("truck", "registrationNumber").populate("customer", "name")
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Create load by driver
exports.createLoadByDriver = async (req, res) => {
  try {
    const { pickupLocation, deliveryLocation, truck, weight, cargoType, notes, customer, driverEmail } = req.body;

    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!driverEmail) return res.status(400).json({ message: "Driver email is required" });

    // Look up driver by email
    const driver = await Driver.findOne({ email: driverEmail });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    // Generate ticket number
    const ticketNumber = "TICKET-" + uuidv4().split("-")[0].toUpperCase();

    // Create load
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
      podUrl: null, // ensure POD is null initially
      ticketNumber,
    });

    // Return populated load
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




// Get all loads
exports.getLoads = async (req, res) => {
  try {
    const loads = await Load.find()
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");
    res.json(loads);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
  }
};

// Update load
exports.updateLoad = async (req, res) => {
  try {
    const load = await Load.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");
    if (!load) return res.status(404).json({ message: "Load not found" });
    res.json(load);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Upload POD
// Upload POD
exports.uploadPOD = async (req, res) => {
  try {
    if (!req.files || !req.files.pod) return res.status(400).json({ message: "No POD file uploaded" });

    const file = req.files.pod;

    // ✅ Use ticketNumber or _id to generate unique POD filename
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    const extension = path.extname(file.name);
    const filename = `POD-${load.ticketNumber || load._id}${extension}`;
    const uploadPath = path.join(__dirname, "../uploads", filename);

    await file.mv(uploadPath);

    // ✅ Update load with correct POD URL
    load.podUrl = `/uploads/${filename}`;
    load.status = "completed";
    load.updatedBy = req.user?.email || load.driver?.email;
    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    // ✅ Notify socket clients
    const io = req.app.get("io");
    io.emit("podUploaded", populatedLoad);

    res.json({ message: "POD uploaded successfully", load: populatedLoad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};



// Approve load (Admin2)
exports.approveLoad = async (req, res) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    const { note } = req.body;

    // Mark as approved without changing completed status
    load.isApproved = true;
    load.verificationNote = note || "";
    load.updatedBy = req.user.email; // req.user comes from protect middleware

    await load.save();

    const populatedLoad = await Load.findById(load._id)
      .populate("driver", "name email")
      .populate("truck", "registrationNumber")
      .populate("customer", "name");

    res.json(populatedLoad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


// Delete load by ID
exports.deleteLoad = async (req, res) => {
  try {
    const load = await Load.findByIdAndDelete(req.params.id);
    if (!load) return res.status(404).json({ message: "Load not found" });

    res.json({ message: "Load deleted successfully" });
  } catch (err) {
    console.error("Error deleting load:", err);
    res.status(500).json({ message: err.message });
  }
};
