const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getAllLoads,
  approveLoad,
  rejectLoad,
} = require("../controllers/admin2Controller");

// protect + role lock
router.use(protect, authorize("admin2", "superadmin"));

// GET all loads
router.get("/loads", getAllLoads);

// APPROVE load
router.put("/loads/:id/approve", approveLoad);

// REJECT load
router.put("/loads/:id/reject", rejectLoad);

module.exports = router;
