const express = require("express");
const router = express.Router();
const { getTrackByTicket } = require("../controllers/trackController");

// Public tracking — no auth required
router.get("/:ticketNumber", getTrackByTicket);

module.exports = router;
