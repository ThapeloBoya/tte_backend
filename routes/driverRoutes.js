<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateDriver, validateDriverUpdate, allowDriverFields } = require("../middleware/validateEntity");
const driverController = require("../controllers/driverController");

router.post("/", protect, authorize("admin1", "superadmin"), validateDriver, allowDriverFields, driverController.createDriver);
router.get("/", protect, authorize("superadmin", "admin1"), driverController.getDrivers);
router.put("/:id", protect, authorize("admin1", "superadmin"), validateDriverUpdate, allowDriverFields, driverController.updateDriver);
router.get("/profile", protect, authorize("driver"), driverController.getDriverProfile);
router.patch("/profile", protect, authorize("driver"), driverController.updateDriverProfile);
router.patch("/location", protect, authorize("driver"), driverController.updateDriverLocation);
router.delete("/:id", protect, authorize("admin1", "superadmin"), driverController.deleteDriver);

module.exports = router;
=======
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
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
