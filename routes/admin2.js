<<<<<<< HEAD
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
=======
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
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
