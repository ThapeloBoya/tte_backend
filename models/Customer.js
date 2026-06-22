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
