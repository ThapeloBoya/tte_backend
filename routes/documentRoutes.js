const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getDocuments, createDocument, updateDocument, deleteDocument,
} = require("../controllers/documentController");

router.get("/", protect, authorize("superadmin", "admin1"), getDocuments);
router.post("/", protect, authorize("superadmin", "admin1"), createDocument);
router.put("/:id", protect, authorize("superadmin", "admin1"), updateDocument);
router.delete("/:id", protect, authorize("superadmin", "admin1"), deleteDocument);

module.exports = router;
