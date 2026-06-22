const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ["insurance", "contract", "license", "registration", "permit", "inspection", "other"],
    required: true,
  },
  entityType: {
    type: String,
    enum: ["truck", "driver", "customer", "load", "general"],
    default: "general",
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  fileUrl: { type: String },
  status: {
    type: String,
    enum: ["active", "expiring", "expired", "archived"],
    default: "active",
  },
  issueDate: { type: Date },
  expiryDate: { type: Date },
  notes: { type: String },
  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

documentSchema.index({ entityType: 1, entityId: 1 });
documentSchema.index({ expiryDate: 1 });
documentSchema.index({ type: 1 });

documentSchema.plugin(softDelete);

module.exports = mongoose.model("Document", documentSchema);
