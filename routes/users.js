
// backend/routes/users.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

// GET /api/users
router.get("/", protect, authorize("superadmin", "admin1"), userController.getAllUsers);

module.exports = router;

