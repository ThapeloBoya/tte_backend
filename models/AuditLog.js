const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userEmail: { type: String },
  userName: { type: String },
  details: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, action: 1 });
auditLogSchema.index({ userEmail: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
