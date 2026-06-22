<<<<<<< HEAD
const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["superadmin","admin1","admin2","driver"], default: "driver" },
  isActive: { type: Boolean, default: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  mfaSecret: { type: String },
  mfaEnabled: { type: Boolean, default: false },
  mfaVerified: { type: Boolean, default: false },
  mfaSessionToken: { type: String },
  googleId: { type: String },
  microsoftId: { type: String },
  mfaRecoveryCodes: [{ type: String }],
}, { timestamps: true });

userSchema.plugin(softDelete);

module.exports = mongoose.model("User", userSchema);
=======
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["superadmin","admin1","admin2","driver"], default: "driver" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
