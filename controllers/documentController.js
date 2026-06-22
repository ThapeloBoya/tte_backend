const Document = require("../models/Document");
const { logAction } = require("../utils/auditLogger");

exports.getDocuments = async (req, res) => {
  try {
    const { type, entityType, entityId, status, expiring, page = 1, limit = 50, sort = "-createdAt" } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (status) filter.status = status;
    if (expiring === "true") {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      filter.expiryDate = { $gte: new Date(), $lte: thirtyDays };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Document.countDocuments(filter);
    const docs = await Document.find(filter).sort(sort).skip(skip).limit(parseInt(limit));
    res.json({ documents: docs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.createDocument = async (req, res) => {
  try {
    const { title, type, entityType, entityId, fileUrl, issueDate, expiryDate, notes } = req.body;
    if (!title || !type) return res.status(400).json({ message: "Title and type are required" });
    const doc = await Document.create({
      title, type, entityType: entityType || "general", entityId, fileUrl,
      issueDate: issueDate ? new Date(issueDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      notes, createdBy: req.user?.email,
    });
    await logAction({ action: "created", entity: "Document", entityId: doc._id, req, details: `Created document ${title} (${type})` });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const allowed = ["title", "type", "entityType", "entityId", "fileUrl", "status", "issueDate", "expiryDate", "notes"];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) {
        doc[f] = f.endsWith("Date") && req.body[f] ? new Date(req.body[f]) : req.body[f];
      }
    });
    doc.updatedBy = req.user?.email;
    await doc.save();
    await logAction({ action: "updated", entity: "Document", entityId: doc._id, req, details: `Updated document ${doc.title}` });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    await doc.softDelete(req.user?.email);
    await logAction({ action: "deleted", entity: "Document", entityId: doc._id, req, details: `Deleted document ${doc.title}` });
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
