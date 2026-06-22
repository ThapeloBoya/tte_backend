const AuditLog = require("../models/AuditLog");

exports.getAuditLogs = async (req, res) => {
  try {
    const { entity, action, userEmail, startDate, endDate, limit, skip } = req.query;

    const filter = {};

    if (entity) filter.entity = entity;
    if (action) filter.action = action;
    if (userEmail) filter.userEmail = { $regex: userEmail, $options: "i" };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageLimit = Math.min(parseInt(limit) || 50, 200);
    const pageSkip = parseInt(skip) || 0;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(pageSkip).limit(pageLimit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, limit: pageLimit, skip: pageSkip });
  } catch (err) {
    console.error("Get audit logs error:", err);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};
