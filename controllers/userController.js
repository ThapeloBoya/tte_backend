
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { validatePassword } = require("../utils/password");
const { logAction } = require("../utils/auditLogger");

const SALT_ROUNDS = 12;
const VALID_ROLES = ["superadmin", "admin1", "admin2", "driver"];

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "name email role isActive");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching users" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    const pwdError = validatePassword(password);
    if (pwdError) return res.status(400).json({ message: pwdError });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User with this email already exists" });

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ name, email, password: hashedPassword, role });

    await logAction({
      action: "createUser", entity: "User", entityId: user._id, req,
      details: `Admin ${req.user.email} created user ${user.email} as ${user.role}`,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating user" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
      if (user._id.toString() === req.user._id.toString() && role !== req.user.role) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      user.role = role;
    }

    if (isActive !== undefined) {
      if (user._id.toString() === req.user._id.toString() && isActive === false) {
        return res.status(400).json({ message: "Cannot deactivate yourself" });
      }
      user.isActive = isActive;
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    await user.save();

    await logAction({
      action: "updateUser", entity: "User", entityId: user._id, req,
      details: `Admin ${req.user.email} updated user ${user.email}`,
    });

    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error updating user" });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot deactivate yourself" });
    }

    user.isActive = false;
    await user.save();

    await logAction({
      action: "deactivateUser", entity: "User", entityId: user._id, req,
      details: `Admin ${req.user.email} deactivated user ${user.email}`,
    });

    res.json({ message: "User deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deactivating user" });
  }
};
