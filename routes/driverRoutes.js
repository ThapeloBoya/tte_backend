
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
router.patch("/duty-status", protect, authorize("driver"), driverController.updateDutyStatus);
router.get("/my-truck", protect, authorize("driver"), driverController.getMyTruck);
router.get("/my-documents", protect, authorize("driver"), driverController.getMyDocuments);
router.delete("/:id", protect, authorize("admin1", "superadmin"), driverController.deleteDriver);

module.exports = router;

