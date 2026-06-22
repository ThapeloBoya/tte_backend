const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateTruck, validateTruckUpdate, allowTruckFields } = require("../middleware/validateEntity");
const { 
  createTruck, 
  getTrucks, 
  getTruckById, 
  updateTruck, 
  deleteTruck
} = require("../controllers/truckController");

router.post("/", protect, authorize("admin1","superadmin"), validateTruck, allowTruckFields, createTruck);
router.get("/", protect, authorize("superadmin", "admin1"), getTrucks);
router.get("/:id", protect, authorize("superadmin", "admin1"), getTruckById);
router.put("/:id", protect, authorize("admin1","superadmin"), validateTruckUpdate, allowTruckFields, updateTruck);

// 🚨 Missing before — now added
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteTruck);

module.exports = router;
