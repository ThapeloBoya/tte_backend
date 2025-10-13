const Driver = require("../models/Driver");

exports.createDriver = async (req, res) => {
  try {
    const driver = await Driver.create(req.body);
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDrivers = async (req, res) => {
  const drivers = await Driver.find();
  res.json(drivers);
};

exports.getDriverById = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json(driver);
};

exports.updateDriver = async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!driver) return res.status(404).json({ message: "Driver not found" });
  res.json(driver);
};

// DELETE DRIVER
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await driver.deleteOne();
    res.json({ message: "Driver removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
