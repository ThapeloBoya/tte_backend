const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getInvoices,
  getInvoiceById,
  createInvoice,
  createInvoiceFromLoad,
  updateInvoice,
  markAsPaid,
  cancelInvoice,
  deleteInvoice,
  getInvoiceStats,
} = require("../controllers/invoiceController");

router.use(protect);

router.get("/stats", authorize("superadmin", "admin1"), getInvoiceStats);
router.get("/", authorize("superadmin", "admin1", "admin2"), getInvoices);
router.get("/:id", authorize("superadmin", "admin1", "admin2"), getInvoiceById);
router.post("/", authorize("admin1"), createInvoice);
router.post("/from-load", authorize("admin1"), createInvoiceFromLoad);
router.patch("/:id", authorize("admin1"), updateInvoice);
router.patch("/:id/paid", authorize("admin1"), markAsPaid);
router.patch("/:id/cancel", authorize("admin1"), cancelInvoice);
router.delete("/:id", authorize("superadmin", "admin1"), deleteInvoice);

module.exports = router;
