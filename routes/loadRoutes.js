<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createLoad,
  getLoads,
  getLoadById,
  updateLoad,
  deleteLoad,
  resolveLoadIssue,
  bulkUpdateStatus,
  bulkAssignDriver,
  bulkDeleteLoads,
} = require("../controllers/loadController");
const { generatePODAdmin } = require("../controllers/generatePOD");

// Admin routes
// Bulk operations first (before :id routes)
router.post("/bulk/status", protect, authorize("admin1", "superadmin"), bulkUpdateStatus);
router.post("/bulk/assign", protect, authorize("admin1", "superadmin"), bulkAssignDriver);
router.post("/bulk/delete", protect, authorize("admin1", "superadmin"), bulkDeleteLoads);

// DELETE route (specific middleware protected)
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteLoad);

// Generate POD (admin1/superadmin)
router.post("/:id/generate-pod", protect, authorize("admin1", "superadmin"), generatePODAdmin);

// Resolve driver issue (admin1 only)
router.patch("/:id/resolve-issue", protect, authorize("admin1","superadmin"), resolveLoadIssue);

// CRUD routes last (generic ones)
router.post("/", protect, authorize("admin1","superadmin"), createLoad);
router.get("/", protect, authorize("superadmin", "admin1", "admin2"), getLoads);

// IMPORTANT: keep :id last
router.get("/:id", protect, authorize("superadmin", "admin1", "admin2"), getLoadById);
router.put("/:id", protect, authorize("admin1","superadmin"), updateLoad);

module.exports = router;
=======
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
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
