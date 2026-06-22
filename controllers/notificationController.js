const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  try {
    const { limit, skip } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 20, 100);
    const pageSkip = parseInt(skip) || 0;

    const filter = {
      $or: [
        { user: req.user._id },
        { role: req.user.role },
        { userEmail: req.user.email },
      ],
    };

    const [notifications, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(pageSkip).limit(pageLimit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    res.json({ notifications, total, unread, limit: pageLimit, skip: pageSkip });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const filter = {
      $or: [
        { user: req.user._id },
        { role: req.user.role },
        { userEmail: req.user.email },
      ],
      read: false,
    };

    const count = await Notification.countDocuments(filter);
    res.json({ unread: count });
  } catch (err) {
    console.error("Unread count error:", err);
    res.status(500).json({ unread: 0 });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, $or: [{ user: req.user._id }, { role: req.user.role }, { userEmail: req.user.email }] },
      { read: true }
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { $or: [{ user: req.user._id }, { role: req.user.role }, { userEmail: req.user.email }], read: false },
      { read: true }
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};
