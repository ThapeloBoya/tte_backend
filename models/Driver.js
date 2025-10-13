const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  role: { type: String, default: "driver" },
}, { timestamps: true });

module.exports = mongoose.model("Driver", driverSchema);
