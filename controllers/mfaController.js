const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const totp = require("../utils/totp");
const QRCode = require("qrcode");
const { logAction } = require("../utils/auditLogger");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

exports.generateSecret = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.mfaEnabled) {
      return res.status(400).json({ message: "MFA is already enabled" });
    }

    const secret = totp.generateSecret();
    const otpauth = totp.keyuri(user.email, "TMS", secret);

    user.mfaSecret = secret;
    await user.save();

    const qrCode = await QRCode.toDataURL(otpauth);

    res.json({ secret, qrCode });
  } catch (err) {
    console.error("MFA generate error:", err);
    res.status(500).json({ message: "Failed to generate MFA secret" });
  }
};

exports.verifyAndEnable = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.mfaSecret) return res.status(400).json({ message: "MFA not initialized. Generate a secret first." });
    if (user.mfaEnabled) return res.status(400).json({ message: "MFA is already enabled" });

    const isValid = totp.verifyTOTP(token, user.mfaSecret);
    if (!isValid) return res.status(400).json({ message: "Invalid token. Please try again." });

    user.mfaEnabled = true;
    user.mfaVerified = true;
    user.mfaSessionToken = undefined;
    await user.save();

    await logAction({
      action: "mfa_enabled", entity: "User", entityId: user._id, req,
      details: `User ${user.email} enabled MFA`,
    });

    res.json({ message: "MFA enabled successfully" });
  } catch (err) {
    console.error("MFA verify error:", err);
    res.status(500).json({ message: "Failed to verify MFA token" });
  }
};

exports.disable = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Password is required to disable MFA" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.mfaEnabled) return res.status(400).json({ message: "MFA is not enabled" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    user.mfaSecret = undefined;
    user.mfaEnabled = false;
    user.mfaVerified = false;
    user.mfaSessionToken = undefined;
    user.mfaRecoveryCodes = [];
    await user.save();

    await logAction({
      action: "mfa_disabled", entity: "User", entityId: user._id, req,
      details: `User ${user.email} disabled MFA`,
    });

    res.json({ message: "MFA disabled successfully" });
  } catch (err) {
    console.error("MFA disable error:", err);
    res.status(500).json({ message: "Failed to disable MFA" });
  }
};

exports.status = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("mfaEnabled");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ mfaEnabled: user.mfaEnabled || false });
  } catch (err) {
    console.error("MFA status error:", err);
    res.status(500).json({ message: "Failed to get MFA status" });
  }
};

exports.verifyMfaChallenge = async (req, res) => {
  try {
    const { mfaSessionToken, token } = req.body;
    if (!mfaSessionToken || !token) {
      return res.status(400).json({ message: "Session token and verification code are required" });
    }

    const hashedSessionToken = crypto.createHash("sha256").update(mfaSessionToken).digest("hex");

    const user = await User.findOne({
      mfaSessionToken: hashedSessionToken,
      mfaEnabled: true,
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired session" });

    const isValid = totp.verifyTOTP(token, user.mfaSecret);
    if (!isValid) return res.status(400).json({ message: "Invalid verification code" });

    user.mfaVerified = true;
    user.mfaSessionToken = undefined;
    await user.save();

    await logAction({
      action: "mfa_verified", entity: "User", entityId: user._id, req,
      details: `User ${user.email} completed MFA challenge`,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("MFA challenge error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
};

exports.generateRecoveryCodes = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.mfaEnabled) return res.status(400).json({ message: "MFA is not enabled" });

    const plainCodes = [];
    const hashedCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      plainCodes.push(code);
      hashedCodes.push(crypto.createHash("sha256").update(code).digest("hex"));
    }

    user.mfaRecoveryCodes = hashedCodes;
    await user.save();

    await logAction({
      action: "mfa_recovery_codes_generated", entity: "User", entityId: user._id, req,
      details: `User ${user.email} generated new recovery codes`,
    });

    res.json({ recoveryCodes: plainCodes, message: "Store these codes in a safe place. Each can be used only once." });
  } catch (err) {
    console.error("MFA recovery codes error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyRecoveryCode = async (req, res) => {
  try {
    const { mfaSessionToken, recoveryCode } = req.body;
    if (!mfaSessionToken || !recoveryCode) {
      return res.status(400).json({ message: "Session token and recovery code are required" });
    }

    const hashedSessionToken = crypto.createHash("sha256").update(mfaSessionToken).digest("hex");

    const user = await User.findOne({
      mfaSessionToken: hashedSessionToken,
      mfaEnabled: true,
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired session" });

    const hashedCode = crypto.createHash("sha256").update(recoveryCode).digest("hex");
    const idx = user.mfaRecoveryCodes.findIndex((c) => c === hashedCode);

    if (idx === -1) return res.status(400).json({ message: "Invalid or already used recovery code" });

    user.mfaRecoveryCodes.splice(idx, 1);
    user.mfaVerified = true;
    user.mfaSessionToken = undefined;
    await user.save();

    await logAction({
      action: "mfa_recovery_code_used", entity: "User", entityId: user._id, req,
      details: `User ${user.email} used a recovery code (${user.mfaRecoveryCodes.length} remaining)`,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("MFA recovery verification error:", err);
    res.status(500).json({ message: "Server error" });
  }
};