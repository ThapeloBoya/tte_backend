<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getAllLoads,
  getLoadById,
  updateLoad
} = require("../controllers/superadminController");

// ✅ Make sure these functions exist and are exported from superadminController

router.get("/loads", protect, authorize("superadmin"), getAllLoads);
router.get("/loads/:id", protect, authorize("superadmin"), getLoadById);
router.put("/loads/:id", protect, authorize("superadmin"), updateLoad);

module.exports = router;
=======
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getAllLoads,
  getLoadById,
  updateLoad
} = require("../controllers/superadminController");

// ✅ Make sure these functions exist and are exported from superadminController

router.get("/loads", protect, authorize("superadmin"), getAllLoads);
router.get("/loads/:id", protect, authorize("superadmin"), getLoadById);
router.put("/loads/:id", protect, authorize("superadmin"), updateLoad);

module.exports = router;
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
