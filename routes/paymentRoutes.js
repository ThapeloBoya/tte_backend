const express = require("express");
const router = express.Router();
const { payfastNotify } = require("../controllers/paymentController");

router.post("/payfast/notify", payfastNotify);

module.exports = router;
