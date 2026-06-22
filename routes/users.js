<<<<<<< HEAD
// backend/routes/users.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

// GET /api/users
router.get("/", protect, authorize("superadmin", "admin1"), userController.getAllUsers);

module.exports = router;
=======
// backend/routes/users.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// GET /api/users
router.get("/", userController.getAllUsers);

module.exports = router;
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
