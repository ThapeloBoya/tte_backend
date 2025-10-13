const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { createDriver, getDrivers, getDriverById, updateDriver, deleteDriver } = require("../controllers/driverController");

// Create driver
router.post("/", protect, authorize("admin1","superadmin"), createDriver);

// Get all drivers
router.get("/", protect, getDrivers);

// Get single driver by ID
router.get("/:id", protect, getDriverById);

// Update driver
router.put("/:id", protect, authorize("admin1","superadmin"), updateDriver);

// Delete driver
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteDriver);

module.exports = router;
