const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const os = require("os");

router.get("/", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const states = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  res.json({
    status: mongoState === 1 ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
    platform: os.platform(),
    node: process.version,
    mongodb: states[mongoState] || "unknown",
    env: process.env.NODE_ENV || "development",
  });
});

module.exports = router;
