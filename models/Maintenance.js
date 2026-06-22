const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

const maintenanceSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck", required: true },
  serviceType: {
    type: String,
    enum: ["oil change", "tire rotation", "brake service", "engine service", "transmission", "inspection", "registration", "insurance", "other"],
    required: true,
  },
  description: String,

  scheduledDate: { type: Date },
  scheduledMileage: { type: Number },
  completedDate: { type: Date },
  completedMileage: { type: Number },

  status: {
    type: String,
    enum: ["scheduled", "in progress", "completed", "overdue", "cancelled"],
    default: "scheduled",
  },

  cost: { type: Number, default: 0 },
  vendor: String,
  notes: String,
  reminderSent: { type: Boolean, default: false },

  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

maintenanceSchema.index({ truck: 1, status: 1 });
maintenanceSchema.index({ scheduledDate: 1 });
maintenanceSchema.index({ status: 1 });

maintenanceSchema.plugin(softDelete);

module.exports = mongoose.model("Maintenance", maintenanceSchema);
