const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  completeRecord,
  deleteRecord,
  getUpcoming,
} = require("../controllers/maintenanceController");

router.use(protect);

router.get("/upcoming", authorize("superadmin", "admin1"), getUpcoming);
router.get("/", authorize("superadmin", "admin1", "admin2"), getRecords);
router.get("/:id", authorize("superadmin", "admin1", "admin2"), getRecordById);
router.post("/", authorize("admin1"), createRecord);
router.patch("/:id", authorize("admin1"), updateRecord);
router.patch("/:id/complete", authorize("admin1"), completeRecord);
router.delete("/:id", authorize("superadmin", "admin1"), deleteRecord);

module.exports = router;
