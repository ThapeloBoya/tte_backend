const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getProfitability,
  getDriverScorecard,
} = require("../controllers/reportController");

router.get("/profitability", protect, authorize("superadmin", "admin1"), getProfitability);
router.get("/driver-scorecard/:driverId", protect, authorize("superadmin", "admin1"), getDriverScorecard);

module.exports = router;
