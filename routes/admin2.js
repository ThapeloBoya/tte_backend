const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { getAllLoads, approveLoad } = require("../controllers/admin2Controller");

// All routes are protected and only admin2 can access
router.use(protect, authorize("admin2"));

// GET all loads
router.get("/loads", getAllLoads);

// PUT approve a load
router.put("/loads/:id/approve", approveLoad);

module.exports = router;
