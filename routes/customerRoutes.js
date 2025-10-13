const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { 
  createCustomer, 
  getCustomers, 
  getCustomerById, 
  updateCustomer,
  deleteCustomer // <-- import delete controller
} = require("../controllers/customerController");

router.post("/", protect, authorize("admin1","superadmin"), createCustomer);
router.get("/", protect, getCustomers);
router.get("/:id", protect, getCustomerById);
router.put("/:id", protect, authorize("admin1","superadmin"), updateCustomer);

// DELETE route
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteCustomer);

module.exports = router;
