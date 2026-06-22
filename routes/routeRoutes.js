const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  geocode,
  calculateRoute,
  calculateMultiStopRoute,
  batchGeocode,
  getLoadRoute,
  checkGeofence,
} = require("../controllers/routeController");

router.get("/geocode", protect, authorize("superadmin", "admin1", "admin2", "driver"), geocode);
router.post("/calculate", protect, authorize("superadmin", "admin1", "admin2", "driver"), calculateRoute);
router.post("/trip", protect, authorize("superadmin", "admin1", "admin2", "driver"), calculateMultiStopRoute);
router.post("/batch-geocode", protect, authorize("superadmin", "admin1"), batchGeocode);
router.get("/load/:id", protect, authorize("superadmin", "admin1", "admin2", "driver"), getLoadRoute);
router.post("/geofence/check", protect, authorize("superadmin", "admin1", "driver"), checkGeofence);

module.exports = router;
