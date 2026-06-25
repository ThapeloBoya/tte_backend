const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { getAuditLogs } = require("../controllers/auditController");

router.get("/", protect, authorize("superadmin", "admin1"), getAuditLogs);

module.exports = router;
