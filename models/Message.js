const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderEmail: { type: String, required: true },
  senderName: { type: String },
  senderRole: { type: String },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipientEmail: { type: String, required: true },
  recipientRole: { type: String },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipientEmail: 1, read: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
