
const Truck = require("../models/Truck");
const { logAction } = require("../utils/auditLogger");
const { getIO } = require("../utils/socket");

exports.createTruck = async (req, res) => {
  try {
    const { registrationNumber, model, capacity } = req.body;

    // ✅ Validate required fields
    if (!registrationNumber || !model || !capacity) {
      return res.status(400).json({ message: "Registration number, model, and capacity are required" });
    }

    // ✅ Convert numbers
    const truckData = {
      ...req.body,
      capacity: Number(capacity),
      year: req.body.year ? Number(req.body.year) : undefined,
      mileage: req.body.mileage ? Number(req.body.mileage) : undefined,
      insuranceExpiry: req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : undefined
    };

    const truck = await Truck.create(truckData);

    await logAction({
      action: "created", entity: "Truck", entityId: truck._id, req,
      details: `Created truck ${truck.registrationNumber} — ${truck.model}`,
    });

    const io = getIO();
    if (io) io.emit("truckCreated", truck);

    res.status(201).json(truck);
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Truck with this registration number already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTrucks = async (req, res) => {
  try {
    const trucks = await Truck.find();
    res.json(trucks);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTruckById = async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateTruck = async (req, res) => {
  try {
    const truckData = {
      ...req.body,
      capacity: req.body.capacity ? Number(req.body.capacity) : undefined,
      year: req.body.year ? Number(req.body.year) : undefined,
      mileage: req.body.mileage ? Number(req.body.mileage) : undefined,
      insuranceExpiry: req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : undefined
    };

    const truck = await Truck.findByIdAndUpdate(req.params.id, truckData, { new: true });
    if (!truck) return res.status(404).json({ message: "Truck not found" });

    await logAction({
      action: "updated", entity: "Truck", entityId: truck._id, req,
      details: `Updated truck ${truck.registrationNumber}`,
      metadata: { changes: Object.keys(req.body) },
    });

    const io = getIO();
    if (io) io.emit("truckUpdated", truck);

    res.json(truck);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
// DELETE TRUCK
exports.deleteTruck = async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);
    if (!truck) return res.status(404).json({ message: "Truck not found" });

    await truck.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Truck", entityId: req.params.id, req,
      details: `Deleted truck ${truck.registrationNumber}`,
    });

    const io = getIO();
    if (io) io.emit("truckDeleted", { id: req.params.id });

    res.json({ message: "Truck removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


