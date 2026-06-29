const cron = require("node-cron");
const Truck = require("../models/Truck");
const { createNotification } = require("./notify");

const checkMaintenanceReminders = async () => {
  try {
    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const dueTrucks = await Truck.find({
      $or: [
        { nextServiceDate: { $lte: in7Days } },
        { nextServiceMileage: { $ne: null }, $expr: { $gte: ["$mileage", "$nextServiceMileage"] } },
      ],
    });

    for (const truck of dueTrucks) {
      let reason = "";
      if (truck.nextServiceDate && truck.nextServiceDate <= in7Days) {
        const days = Math.ceil((truck.nextServiceDate - now) / (1000 * 60 * 60 * 24));
        reason = days <= 0
          ? `Service overdue by ${Math.abs(days)} day(s)`
          : `Service due in ${days} day(s)`;
      } else if (truck.nextServiceMileage && truck.mileage >= truck.nextServiceMileage) {
        reason = `Mileage ${truck.mileage} km has reached service threshold of ${truck.nextServiceMileage} km`;
      }

      if (!reason) continue;

      await createNotification({
        title: "Maintenance Reminder",
        message: `Truck ${truck.registrationNumber}: ${reason}`,
        entity: "Truck",
        entityId: truck._id,
        action: "maintenance_due",
        role: "admin1",
      });

      await createNotification({
        title: "Maintenance Reminder",
        message: `Truck ${truck.registrationNumber}: ${reason}`,
        entity: "Truck",
        entityId: truck._id,
        action: "maintenance_due",
        role: "superadmin",
      });
    }

    if (dueTrucks.length > 0) {
      console.log(`[Maintenance Reminder] Notified about ${dueTrucks.length} truck(s) due for service.`);
    }
  } catch (err) {
    console.error("[Maintenance Reminder] Error:", err);
  }
};

const initMaintenanceReminder = () => {
  cron.schedule("0 8 * * *", checkMaintenanceReminders);
  console.log("[Maintenance Reminder] Cron scheduled for 08:00 daily");
};

module.exports = { initMaintenanceReminder };
