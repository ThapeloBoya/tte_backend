const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validateCustomer,
  validateCustomerUpdate,
  allowCustomerFields
} = require("../middleware/validateEntity");

const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
} = require("../controllers/customerController");

// CREATE
router.post(
  "/",
  protect,
  authorize("admin1", "superadmin"),
  validateCustomer,
  allowCustomerFields,
  createCustomer
);

// READ ALL
router.get(
  "/",
  protect,
  authorize("superadmin", "admin1", "admin2"),
  getCustomers
);

// READ ONE
router.get(
  "/:id",
  protect,
  authorize("superadmin", "admin1", "admin2"),
  getCustomerById
);

// UPDATE
router.put(
  "/:id",
  protect,
  authorize("admin1", "superadmin"),
  validateCustomerUpdate,
  allowCustomerFields,
  updateCustomer
);

// DELETE
router.delete(
  "/:id",
  protect,
  authorize("admin1", "superadmin"),
  deleteCustomer
);

module.exports = router;