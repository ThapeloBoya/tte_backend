const Message = require("../models/Message");
const User = require("../models/User");

exports.getConversations = async (req, res) => {
  try {
    const userEmail = req.user.email;

    const messages = await Message.find({
      $or: [{ senderEmail: userEmail }, { recipientEmail: userEmail }],
    })
      .sort({ createdAt: -1 })
      .limit(200);

    const seen = new Set();
    const conversations = [];
    for (const msg of messages) {
      const otherEmail = msg.senderEmail === userEmail ? msg.recipientEmail : msg.senderEmail;
      if (seen.has(otherEmail)) continue;
      seen.add(otherEmail);
      const otherUser = await User.findOne({ email: otherEmail }).select("name email role");
      conversations.push({
        user: otherUser ? { _id: otherUser._id, email: otherUser.email, name: otherUser.name, role: otherUser.role } : { email: otherEmail, _id: null },
        lastMessage: msg.text,
        lastTime: msg.createdAt,
        unread: msg.recipientEmail === userEmail && !msg.read ? 1 : 0,
      });
    }

    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userEmail = req.user.email;

    const otherUser = await User.findById(otherUserId).select("email");
    if (!otherUser) return res.status(404).json({ message: "User not found" });

    const messages = await Message.find({
      $or: [
        { senderEmail: userEmail, recipientEmail: otherUser.email },
        { senderEmail: otherUser.email, recipientEmail: userEmail },
      ],
    }).sort({ createdAt: 1 }).limit(100);

    await Message.updateMany(
      { senderEmail: otherUser.email, recipientEmail: userEmail, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getChatUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { _id: { $ne: req.user._id } };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }
    const users = await User.find(filter).select("name email role").lean();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { recipientEmail, text } = req.body;
    if (!recipientEmail || !text) return res.status(400).json({ message: "Recipient and text required" });

    const recipient = await User.findOne({ email: recipientEmail }).select("name email role");
    if (!recipient) return res.status(404).json({ message: "Recipient not found" });

    const message = await Message.create({
      sender: req.user._id,
      senderEmail: req.user.email,
      senderName: req.user.name,
      senderRole: req.user.role,
      recipient: recipient._id,
      recipientEmail: recipient.email,
      recipientRole: recipient.role,
      text,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${recipientEmail}`).emit("newMessage", message);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
