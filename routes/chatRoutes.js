const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getConversations, getMessages, getChatUsers, sendMessage } = require("../controllers/chatController");

router.use(protect);

router.get("/users", getChatUsers);
router.get("/conversations", getConversations);
router.get("/messages/:otherUserId", getMessages);
router.post("/messages", sendMessage);

module.exports = router;
