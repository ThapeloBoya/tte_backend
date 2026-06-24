
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

router.get("/", protect, authorize("superadmin"), userController.getAllUsers);
router.post("/", protect, authorize("superadmin"), userController.createUser);
router.put("/:id", protect, authorize("superadmin"), userController.updateUser);
router.delete("/:id", protect, authorize("superadmin"), userController.deactivateUser);

module.exports = router;
