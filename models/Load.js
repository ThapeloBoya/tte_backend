const mongoose = require("mongoose");

const { v4: uuidv4 } = require("uuid");

const loadSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },

  collectionDate: { type: Date },
  pickupLocation: String,
  deliveryLocation: String,
  deliveryDate: { type: Date },
  deliveryDay: String,
  cargoType: String,
  priority: { type: String, enum: ["normal","high","urgent"], default: "normal" },
  customerRef: String,
  notes: String,

  deliveries: [{
    deliveryNumber: String,
    amount: Number,
    weight: Number,
    status: { type: String, enum: ["checked","in transit","delivered"], default: "checked" }
  }],

  status: { type: String, enum: ["waiting","in transit","completed","canceled"], default: "waiting" },

  // ✅ Enforced ticket number
  ticketNumber: { type: String, required: true, unique: true, default: () => "TICKET-" + uuidv4().split("-")[0].toUpperCase() },

  podUrl: { type: String },

  isApproved: { type: Boolean, default: false },
  approvalNote: { type: String, default: "" },

  createdBy: String,
  updatedBy: String,
}, { timestamps: true });


module.exports = mongoose.model("Load", loadSchema);
