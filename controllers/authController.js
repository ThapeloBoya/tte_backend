
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { ensureDriverProfile } = require("../utils/driverProfile");
const { sendEmail } = require("../utils/email");
const { logAction } = require("../utils/auditLogger");
const { notifyAdmins } = require("../utils/notify");
const { validatePassword } = require("../utils/password");

const SALT_ROUNDS = 12;

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const pwdError = validatePassword(password);
    if (pwdError) return res.status(400).json({ message: pwdError });

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // Unauthenticated requests can only register as "driver"
    const assignedRole = (!req.user && role !== "driver") ? "driver" : (role || "driver");

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: assignedRole
    });

    if (user.role === "driver") {
      await ensureDriverProfile(user);
    }

    await logAction({
      action: "register", entity: "User", entityId: user._id, req,
      details: `User ${user.email} registered as ${user.role}`,
    });

    if (user.role === "driver") {
      await notifyAdmins({
        title: "New Driver Registered",
        message: `Driver ${user.name} (${user.email}) has signed up.`,
        entity: "User", entityId: user._id, action: "register",
      });
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isActive) return res.status(403).json({ message: "Account is deactivated. Contact your administrator." });

    if (user.lockUntil && user.lockUntil > new Date()) {
      const remaining = Math.ceil((user.lockUntil - new Date()) / 1000 / 60);
      return res.status(429).json({ message: `Account temporarily locked. Try again in ${remaining} minute(s).` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(400).json({ message: "Invalid credentials" });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await logAction({
      action: "login", entity: "User", entityId: user._id, req,
      details: `User ${user.email} logged in as ${user.role}`,
    });

    if (user.mfaEnabled) {
      const mfaSessionToken = crypto.randomBytes(32).toString("hex");
      const hashedSessionToken = crypto.createHash("sha256").update(mfaSessionToken).digest("hex");
      user.mfaSessionToken = hashedSessionToken;
      user.mfaVerified = false;
      await user.save();

      return res.json({
        mfaRequired: true,
        mfaSessionToken,
        _id: user._id,
        email: user.email,
        name: user.name,
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// Forgot password — sends reset link via email
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: "If that email exists, a reset link has been sent." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`;

    await logAction({
      action: "forgot_password", entity: "User", entityId: user._id, req,
      details: `Password reset requested for ${user.email}`,
    });

    await sendEmail({
      to: user.email,
      subject: "TMS — Password Reset Request",
      html: `<p>Hi ${user.name},</p>
<p>You requested a password reset for your TMS account.</p>
<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, please ignore this email.</p>`,
    });

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// Reset password — validates token and updates password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ message: pwdErr });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired reset token." });

    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await logAction({
      action: "reset_password", entity: "User", entityId: user._id, req,
      details: `Password reset completed for ${user.email}`,
    });

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// Change password — authenticated user changes their own password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }

    const pwdErr = validatePassword(newPassword);
    if (pwdErr) return res.status(400).json({ message: pwdErr });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    await logAction({
      action: "change_password", entity: "User", entityId: user._id, req,
      details: `User ${user.email} changed their password`,
    });

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


