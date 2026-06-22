const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { logAction } = require("../utils/auditLogger");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

const upsertOAuthUser = async (profile, provider) => {
  const idField = provider === "google" ? "googleId" : "microsoftId";
  const oauthId = profile.id;

  let user = await User.findOne({ [idField]: oauthId });

  if (user) return user;

  user = await User.findOne({ email: profile.emails?.[0]?.value });

  if (user) {
    user[idField] = oauthId;
    await user.save();
    return user;
  }

  const [firstName, ...lastNameParts] = (profile.displayName || profile.name?.givenName || "User").split(" ");
  const lastName = lastNameParts.join(" ") || "";

  user = await User.create({
    name: `${firstName} ${lastName}`.trim(),
    email: profile.emails?.[0]?.value || `${oauthId}@${provider}.oauth`,
    password: require("crypto").randomBytes(32).toString("hex"),
    role: "driver",
    [idField]: oauthId,
    isActive: true,
  });

  return user;
};

const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    await logAction({
      action: "oauth_login", entity: "User", entityId: user._id, req,
      details: `User ${user.email} logged in via Google`,
    });
    const token = generateToken(user._id);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/oauth-callback?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&role=${user.role}`);
  } catch (err) {
    console.error("Google callback error:", err);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=oauth_failed`);
  }
};

const microsoftCallback = async (req, res) => {
  try {
    const user = req.user;
    await logAction({
      action: "oauth_login", entity: "User", entityId: user._id, req,
      details: `User ${user.email} logged in via Microsoft`,
    });
    const token = generateToken(user._id);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/oauth-callback?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&role=${user.role}`);
  } catch (err) {
    console.error("Microsoft callback error:", err);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=oauth_failed`);
  }
};

module.exports = { upsertOAuthUser, googleCallback, microsoftCallback };