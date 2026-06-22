const mongoose = require("mongoose");

const migrations = [];

const register = (name, fn) => {
  migrations.push({ name, fn });
};

const run = async () => {
  const db = mongoose.connection.db;
  if (!db) {
    console.log("[migrate] No DB connection — skipping migrations");
    return;
  }

  const collection = db.collection("_migrations");

  for (const { name, fn } of migrations) {
    const existing = await collection.findOne({ name });
    if (existing) {
      console.log(`[migrate] ${name} — already applied, skipping`);
      continue;
    }

    console.log(`[migrate] ${name} — running...`);
    try {
      await fn(db);
      await collection.insertOne({ name, appliedAt: new Date() });
      console.log(`[migrate] ${name} — done`);
    } catch (err) {
      console.error(`[migrate] ${name} — FAILED:`, err.message);
    }
  }
};

module.exports = { register, run };
