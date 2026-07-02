
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

router.get("/", protect, authorize("superadmin", "admin1"), userController.getAllUsers);
router.post("/", protect, authorize("superadmin", "admin1"), userController.createUser);
router.put("/:id", protect, authorize("superadmin", "admin1"), userController.updateUser);
router.delete("/:id", protect, authorize("superadmin", "admin1"), userController.deactivateUser);

module.exports = router;
