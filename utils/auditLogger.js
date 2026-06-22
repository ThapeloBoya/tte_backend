const AuditLog = require("../models/AuditLog");

const logAction = async ({ action, entity, entityId, req, details, metadata }) => {
  try {
    await AuditLog.create({
      action,
      entity,
      entityId,
      user: req?.user?._id || null,
      userEmail: req?.user?.email || "system",
      userName: req?.user?.name || "System",
      details,
      metadata,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
};

module.exports = { logAction };
