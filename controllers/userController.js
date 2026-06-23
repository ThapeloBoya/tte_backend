
// backend/controllers/userController.js
const User = require("../models/User");

exports.getAllUsers = async (req, res) => {
  try {
    // return only relevant info (username/email/role)
    const users = await User.find({}, "name email role");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error fetching users" });
  }
};
