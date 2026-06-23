
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getAllLoads,
  getLoadById,
  updateLoad
} = require("../controllers/superadminController");

// ✅ Make sure these functions exist and are exported from superadminController

router.get("/loads", protect, authorize("superadmin"), getAllLoads);
router.get("/loads/:id", protect, authorize("superadmin"), getLoadById);
router.put("/loads/:id", protect, authorize("superadmin"), updateLoad);

module.exports = router;

