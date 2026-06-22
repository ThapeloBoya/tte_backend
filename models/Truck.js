<<<<<<< HEAD
const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

const truckSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true },
  model: { type: String, required: true },
  capacity: { type: Number, required: true },

  make: { type: String, default: "" },
  year: { type: Number },
  fuelType: { type: String, enum: ["diesel", "petrol", "electric", "hybrid"], default: "diesel" },
  status: { type: String, enum: ["available", "in service", "under maintenance"], default: "available" },
  insuranceExpiry: { type: Date },
  mileage: { type: Number, default: 0 },

  // ✅ Make `type` optional to prevent validation error
  type: { type: String, default: "" } 
}, { timestamps: true });

truckSchema.plugin(softDelete);

module.exports = mongoose.model("Truck", truckSchema);
=======
const mongoose = require("mongoose");

const truckSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true },
  model: { type: String, required: true },
  capacity: { type: Number, required: true },

  make: { type: String, default: "" },
  year: { type: Number },
  fuelType: { type: String, enum: ["diesel", "petrol", "electric", "hybrid"], default: "diesel" },
  status: { type: String, enum: ["available", "in service", "under maintenance"], default: "available" },
  insuranceExpiry: { type: Date },
  mileage: { type: Number, default: 0 },

  // ✅ Make `type` optional to prevent validation error
  type: { type: String, default: "" } 
}, { timestamps: true });

module.exports = mongoose.model("Truck", truckSchema);
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
