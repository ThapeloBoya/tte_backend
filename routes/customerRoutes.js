<<<<<<< HEAD
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const { validateCustomer, validateCustomerUpdate, allowCustomerFields } = require("../middleware/validateEntity");
const { 
  createCustomer, 
  getCustomers, 
  getCustomerById, 
  updateCustomer,
  deleteCustomer
} = require("../controllers/customerController");

router.post("/", protect, authorize("admin1","superadmin"), validateCustomer, allowCustomerFields, createCustomer);
router.get("/", protect, authorize("superadmin", "admin1", "admin2"), getCustomers);
router.get("/:id", protect, authorize("superadmin", "admin1", "admin2"), getCustomerById);
router.put("/:id", protect, authorize("admin1","superadmin"), validateCustomerUpdate, allowCustomerFields, updateCustomer);

// DELETE route
router.delete("/:id", protect, authorize("admin1","superadmin"), deleteCustomer);

module.exports = router;
=======
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
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
