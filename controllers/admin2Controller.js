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

