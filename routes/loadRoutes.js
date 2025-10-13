const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { 
  createLoad, 
  getLoads, 
  getLoadById, 
  updateLoad, 
  uploadPOD, 
  createLoadByDriver,
  deleteLoad // <-- import delete controller
} = require("../controllers/loadController");

// Admin routes
router.post("/", protect, authorize("admin1","superadmin"), createLoad);
router.get("/", protect, getLoads);
router.get("/:id", protect, getLoadById);
router.put("/:id", protect, authorize("driver","admin2"), updateLoad);
router.post("/:id/pod", protect, authorize("admin2","superadmin"), uploadPOD);

// DELETE route
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteLoad);

// DRIVER route to create a load
router.post("/driver", protect, authorize("driver"), createLoadByDriver);

module.exports = router;
