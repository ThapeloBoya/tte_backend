const { protect, authorize } = require("../middleware/authMiddleware");
const { getAuditLogs } = require("../controllers/auditController");

console.log("[auditRoutes] loaded at", new Date().toISOString());

module.exports = { protect, authorize, getAuditLogs };
