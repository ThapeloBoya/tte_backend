<<<<<<< HEAD
const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

const driverIssueSchema = new mongoose.Schema({
  type: { type: String, enum: ["delay", "breakdown", "accident", "wrong address", "rejected delivery", "paperwork", "other"] },
  description: { type: String },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  reportedAt: { type: Date },
  resolutionNote: { type: String },
  resolvedAt: { type: Date },
  resolvedBy: { type: String },
}, { _id: false });

const stopSchema = new mongoose.Schema({
  location: { type: String, required: true },
  lat: Number,
  lng: Number,
  type: { type: String, enum: ["pickup", "delivery", "waypoint"], default: "waypoint" },
  sequence: { type: Number, required: true },
  scheduledAt: Date,
  arrivedAt: Date,
  departedAt: Date,
  notes: String,
}, { _id: false });

const loadSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck" },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },

  collectionDate: { type: Date },
  pickupLocation: String,
  pickupLat: Number,
  pickupLng: Number,
  deliveryLocation: String,
  deliveryLat: Number,
  deliveryLng: Number,
  deliveryDate: { type: Date },
  deliveryDay: String,
  cargoType: String,
  priority: { type: String, enum: ["normal","high","urgent"], default: "normal" },
  customerRef: String,
  notes: String,

  milestones: {
    arrivedPickupAt: Date,
    loadedAt: Date,
    arrivedDeliveryAt: Date,
    completedAt: Date,
  },

  driverIssue: driverIssueSchema,

  stops: [stopSchema],

  deliveries: [{
    deliveryNumber: String,
    amount: Number,
    weight: Number,
    status: { type: String, enum: ["checked","in transit","delivered"], default: "checked" }
  }],

  status: {
    type: String,
    enum: ["waiting", "assigned", "in transit", "completed", "approved", "rejected", "canceled"],
    default: "waiting"
  },

  ticketNumber: { type: String, required: true, unique: true },

  routeDistance: Number,
  routeDuration: Number,
  routePolyline: String,

  podUrl: { type: String },

  isApproved: { type: Boolean, default: false },
  reviewStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  approvalNote: { type: String, default: "" },
  approvedAt: Date,
  approvedBy: String,
  rejectionNote: { type: String, default: "" },
  rejectedAt: Date,
  rejectedBy: String,

  createdBy: String,
  updatedBy: String,
}, { timestamps: true });


loadSchema.pre("validate", async function () {
  if (this.ticketNumber) return;
  const now = new Date();
  const y = now.getFullYear().toString();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const dateStr = `${y}${m}${d}`;
  const prefix = `TMS-${dateStr}-`;

  const lastLoad = await mongoose.model("Load")
    .findOne({ ticketNumber: { $regex: `^${prefix}` } })
    .sort({ ticketNumber: -1 })
    .select("ticketNumber")
    .lean();

  let seq = 1;
  if (lastLoad) {
    const parts = lastLoad.ticketNumber.split("-");
    seq = parseInt(parts[2], 10) + 1;
  }

  this.ticketNumber = `${prefix}${seq.toString().padStart(3, "0")}`;
});

loadSchema.plugin(softDelete);

module.exports = mongoose.model("Load", loadSchema);
=======
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
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
