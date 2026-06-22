require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(process.env.MONGO_URI))
  .catch(err => console.log(err));

const users = [
  { name: "Super Admin", email: "superadmin@moova.co.za", password: "WelcomeSuperA@2022", role: "superadmin", username: "superadmin" },
  { name: "Admin One", email: "admin1@moova.co.za", password: "WelcomeAdmin1@2023", role: "admin1", username: "admin1" },
  { name: "Admin Two", email: "admin2@moova.co.za", password: "WelcomeaDmin2@2024", role: "admin2", username: "admin2" },
  { name: "Driver One", email: "driver1@moova.co.za", password: "Welcomedriver1@2025", role: "driver", username: "driver1" },
];


async function fixNullUsernames() {
  const usersWithNull = await User.find({ username: null });
  for (let u of usersWithNull) {
    u.username = "temp_" + Date.now() + Math.floor(Math.random() * 1000);
    await u.save();
    console.log(`Fixed null username for user: ${u.email}`);
  }
}

async function createUsers() {
  try {
    // Step 1: fix existing null usernames
    await fixNullUsernames();

    // Step 2: create initial users
    for (let u of users) {
      const exists = await User.findOne({ $or: [{ email: u.email }, { username: u.username }] });
      if (exists) {
        console.log(`${u.email} already exists, skipping...`);
        continue;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(u.password, salt);

      await User.create({ ...u, password: hashedPassword });
      console.log(`Created user: ${u.email}`);
    }

    console.log("All users processed!");
    mongoose.connection.close();
  } catch (err) {
    console.error(err);
    mongoose.connection.close();
  }
}

createUsers();
