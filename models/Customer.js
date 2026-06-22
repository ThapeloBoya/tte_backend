<<<<<<< HEAD
const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");
const encryptPlugin = require("../utils/mongooseEncrypt");

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: { type: String, required: true },
}, { timestamps: true });

customerSchema.plugin(softDelete);
customerSchema.plugin(encryptPlugin, { paths: ["phone", "address"] });

module.exports = mongoose.model("Customer", customerSchema);
=======
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Customer", customerSchema);
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
