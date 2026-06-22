<<<<<<< HEAD
const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");
const encryptPlugin = require("../utils/mongooseEncrypt");

const driverSchema = new mongoose.Schema(
  {
    // LINK TO USER ACCOUNT
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
    },

    role: {
      type: String,
      default: "driver",
    },

    licenseNumber: {
      type: String,
    },

    location: {
      type: {
        type: String,
        default: "Point",
      },

      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
      },
    },

    status: {
      type: String,
      enum: ["available", "on-duty", "inactive"],
      default: "available",
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// REQUIRED FOR GEO QUERIES
driverSchema.index({ location: "2dsphere" });

driverSchema.plugin(softDelete);
driverSchema.plugin(encryptPlugin, { paths: ["licenseNumber"] });

module.exports = mongoose.model("Driver", driverSchema);
=======
const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  role: { type: String, default: "driver" },
}, { timestamps: true });

module.exports = mongoose.model("Driver", driverSchema);
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
