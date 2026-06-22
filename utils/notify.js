const Notification = require("../models/Notification");
const User = require("../models/User");
const { getIO } = require("./socket");

const createNotification = async ({ title, message, entity, entityId, action, user, role, userEmail }) => {
  try {
    const notification = await Notification.create({
      title, message, entity, entityId, action,
      user: user || null,
      role: role || null,
      userEmail: userEmail || null,
    });

    const io = getIO();

    if (userEmail && io) {
      io.to(`user:${userEmail}`).emit("notification", notification);
    }

    if (role && io) {
      io.to(`role:${role}`).emit("notification", notification);
    }

    return notification;
  } catch (err) {
    console.error("Create notification error:", err);
  }
};

const notifyAdmins = async ({ title, message, entity, entityId, action }) => {
  await createNotification({ title, message, entity, entityId, action, role: "admin1" });
  await createNotification({ title, message, entity, entityId, action, role: "superadmin" });
};

const notifyAdmin1 = async ({ title, message, entity, entityId, action }) => {
  await createNotification({ title, message, entity, entityId, action, role: "admin1" });
};

const notifyAdmin2 = async ({ title, message, entity, entityId, action }) => {
  await createNotification({ title, message, entity, entityId, action, role: "admin2" });
};

const notifySuperAdmin = async ({ title, message, entity, entityId, action }) => {
  await createNotification({ title, message, entity, entityId, action, role: "superadmin" });
};

const notifyDriver = async (driverEmail, { title, message, entity, entityId, action }) => {
  await createNotification({ title, message, entity, entityId, action, userEmail: driverEmail });
};

const notifyAll = async ({ title, message, entity, entityId, action }) => {
  const roles = ["admin1", "admin2", "superadmin"];
  for (const r of roles) {
    await createNotification({ title, message, entity, entityId, action, role: r });
  }
};

module.exports = { createNotification, notifyAdmins, notifyAdmin1, notifyAdmin2, notifySuperAdmin, notifyDriver, notifyAll };
