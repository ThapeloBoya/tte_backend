const cron = require("node-cron");
const Invoice = require("../models/Invoice");
const Maintenance = require("../models/Maintenance");
const Truck = require("../models/Truck");

const run = () => {
  // Daily at 08:00 — mark overdue invoices
  cron.schedule("0 8 * * *", async () => {
    console.log("[cron] Checking overdue invoices...");
    try {
      const result = await Invoice.updateMany(
        { status: "sent", dueDate: { $lt: new Date() } },
        { $set: { status: "overdue" } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[cron] Marked ${result.modifiedCount} invoices as overdue`);
      }
    } catch (err) {
      console.error("[cron] Overdue invoice check failed:", err.message);
    }
  });

  // Daily at 07:00 — flag overdue maintenance
  cron.schedule("0 7 * * *", async () => {
    console.log("[cron] Checking overdue maintenance...");
    try {
      const result = await Maintenance.updateMany(
        { status: "scheduled", scheduledDate: { $lt: new Date() } },
        { $set: { status: "overdue" } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[cron] Flagged ${result.modifiedCount} maintenance tasks as overdue`);
      }
    } catch (err) {
      console.error("[cron] Maintenance overdue check failed:", err.message);
    }
  });

  // Daily at 06:00 — check insurance expiry
  cron.schedule("0 6 * * *", async () => {
    console.log("[cron] Checking insurance expiry...");
    try {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const expiring = await Truck.find({
        insuranceExpiry: { $lte: thirtyDays, $gte: new Date() },
      }).populate("truck", "registrationNumber");

      for (const truck of expiring) {
        console.log(`[cron] Truck ${truck.registrationNumber} insurance expires ${truck.insuranceExpiry}`);
      }
    } catch (err) {
      console.error("[cron] Insurance check failed:", err.message);
    }
  });

  console.log("[cron] Scheduled tasks registered");
};

module.exports = { run };
