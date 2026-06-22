const Driver = require("../models/Driver");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findDriverByEmail = (email) => {
  if (!email) return null;

  return Driver.findOne({
    email: new RegExp(`^${escapeRegExp(email.trim())}$`, "i"),
  });
};

const ensureDriverProfile = async (user) => {
  if (!user || user.role !== "driver") return null;

  let driver = await Driver.findOne({ user: user._id });

  if (!driver) {
    driver = await findDriverByEmail(user.email);
  }

  if (!driver) {
    return Driver.create({
      user: user._id,
      name: user.name || user.email,
      email: user.email,
      role: "driver",
      status: "available",
    });
  }

  let needsSave = false;

  if (!driver.user || String(driver.user) !== String(user._id)) {
    driver.user = user._id;
    needsSave = true;
  }

  if (!driver.name && user.name) {
    driver.name = user.name;
    needsSave = true;
  }

  if (!driver.email && user.email) {
    driver.email = user.email;
    needsSave = true;
  }

  return needsSave ? driver.save() : driver;
};

module.exports = {
  ensureDriverProfile,
  findDriverByEmail,
};
