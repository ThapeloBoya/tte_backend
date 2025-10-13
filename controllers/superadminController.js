// backend/controllers/superadminController.js
const Load = require("../models/Load");
const User = require("../models/User");

// Get all loads
exports.getAllLoads = async (req, res) => {
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

// Update load (approval, notes, etc.)
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
