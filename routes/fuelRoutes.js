const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getStats,
} = require("../controllers/fuelController");

router.use(protect);

router.get("/stats", authorize("superadmin", "admin1"), getStats);
router.get("/", authorize("superadmin", "admin1", "admin2"), getRecords);
router.get("/:id", authorize("superadmin", "admin1", "admin2"), getRecordById);
router.post("/", authorize("admin1"), createRecord);
router.patch("/:id", authorize("admin1"), updateRecord);
router.delete("/:id", authorize("superadmin"), deleteRecord);

module.exports = router;
