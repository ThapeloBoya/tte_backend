const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { 
  createTruck, 
  getTrucks, 
  getTruckById, 
  updateTruck, 
  deleteTruck   // <-- import delete controller
} = require("../controllers/truckController");

router.post("/", protect, authorize("admin1","superadmin"), createTruck);
router.get("/", protect, getTrucks);
router.get("/:id", protect, getTruckById);
router.put("/:id", protect, authorize("admin1","superadmin"), updateTruck);

// 🚨 Missing before — now added
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteTruck);

module.exports = router;
