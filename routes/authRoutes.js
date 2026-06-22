const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const { register, login, forgotPassword, resetPassword, changePassword } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  generateSecret,
  verifyAndEnable,
  disable,
  status,
  verifyMfaChallenge,
  generateRecoveryCodes,
  verifyRecoveryCode,
} = require("../controllers/mfaController");
const { googleCallback, microsoftCallback } = require("../controllers/oauthController");

// Register — public (driver only) or protected (admins choose role)
router.post("/register", (req, res, next) => {
  if (req.headers.authorization) {
    return protect(req, res, () => authorize("admin1", "superadmin")(req, res, next));
  }
  next();
}, register);

// Login
router.post("/login", login);

// Forgot password
router.post("/forgot-password", forgotPassword);

// Reset password
router.post("/reset-password/:token", resetPassword);

// Change password (authenticated)
router.post("/change-password", protect, changePassword);

// MFA routes
router.post("/mfa/generate", protect, generateSecret);
router.post("/mfa/verify-enable", protect, verifyAndEnable);
router.post("/mfa/disable", protect, disable);
router.get("/mfa/status", protect, status);

// MFA recovery codes
router.post("/mfa/generate-recovery", protect, generateRecoveryCodes);
router.post("/mfa/verify-recovery", verifyRecoveryCode);

// MFA challenge (second step after login with mfaRequired)
router.post("/mfa/verify-challenge", verifyMfaChallenge);

// OAuth routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=oauth_failed` }), googleCallback);

router.get("/microsoft", passport.authenticate("microsoft", { session: false }));
router.get("/microsoft/callback", passport.authenticate("microsoft", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=oauth_failed` }), microsoftCallback);

module.exports = router;