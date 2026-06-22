const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const MicrosoftStrategy = require("passport-microsoft").Strategy;
const { upsertOAuthUser } = require("../controllers/oauthController");

passport.serializeUser((user, done) => done(null, user._id));

passport.deserializeUser(async (id, done) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await upsertOAuthUser(profile, "google");
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
}

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/microsoft/callback`,
    scope: ["user.read"],
    tenant: "common",
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await upsertOAuthUser(profile, "microsoft");
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
}

module.exports = passport;