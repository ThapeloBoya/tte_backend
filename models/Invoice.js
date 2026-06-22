const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");
const encryptPlugin = require("../utils/mongooseEncrypt");

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  load: { type: mongoose.Schema.Types.ObjectId, ref: "Load" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },

  billTo: {
    name: String,
    email: String,
    phone: String,
    address: String,
  },

  lineItems: [lineItemSchema],

  subtotal: { type: Number, required: true },
  taxPercent: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },

  currency: { type: String, default: "USD" },

  status: {
    type: String,
    enum: ["draft", "sent", "paid", "overdue", "cancelled"],
    default: "draft",
  },

  issuedDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date },

  notes: String,
  paymentMethod: String,
  paymentReference: String,

  createdBy: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ load: 1 });

invoiceSchema.plugin(softDelete);
invoiceSchema.plugin(encryptPlugin, { paths: ["billTo.name", "billTo.email", "billTo.phone", "billTo.address"] });

module.exports = mongoose.model("Invoice", invoiceSchema);
