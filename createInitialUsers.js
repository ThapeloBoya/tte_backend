require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => { console.error(err); process.exit(1); });

async function createUsers() {
  try {
    const name = process.env.SUPERADMIN_NAME || "Super Admin";
    const email = process.env.SUPERADMIN_EMAIL || "superadmin@moova.co.za";
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!password) {
      console.error("FATAL: SUPERADMIN_PASSWORD not set in .env");
      process.exit(1);
    }

    const exists = await User.findOne({ email });
    if (exists) {
      console.log(`${email} already exists, skipping...`);
    } else {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);
      await User.create({ name, email, password: hashedPassword, role: "admin1" });
      console.log(`Created admin: ${email}`);
    }

    console.log("Done!");
    mongoose.connection.close();
  } catch (err) {
    console.error(err);
    mongoose.connection.close();
  }
}

createUsers();
