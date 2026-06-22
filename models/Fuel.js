const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

const fuelSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", required: true },
  date: { type: Date, default: Date.now },
  liters: { type: Number, required: true },
  costPerLiter: { type: Number, required: true },
  totalCost: { type: Number },
  mileage: { type: Number },
  vendor: { type: String },
  fuelType: { type: String, enum: ["diesel", "petrol", "electric"], default: "diesel" },
  notes: { type: String },
  receiptUrl: { type: String },
  createdBy: { type: String },
}, { timestamps: true });

fuelSchema.index({ truck: 1, date: -1 });
fuelSchema.index({ date: -1 });

fuelSchema.plugin(softDelete);

module.exports = mongoose.model("Fuel", fuelSchema);
