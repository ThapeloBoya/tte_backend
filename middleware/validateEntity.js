const { validateEntity, pickAllowed } = require("../utils/validateEntity");

const DRIVER_FIELDS = ["name", "email", "phone", "licenseNumber", "status", "password", "location"];
const TRUCK_FIELDS = ["registrationNumber", "make", "model", "year", "fuelType", "status", "color", "vin", "capacity", "truckType"];
const CUSTOMER_FIELDS = ["name", "email", "phone", "address"];

const driverSchema = {
  name: { required: true, type: "string", minLength: 2, maxLength: 100 },
  email: { required: true, type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: { type: "string", maxLength: 20 },
  licenseNumber: { type: "string", maxLength: 50 },
  status: { type: "string", enum: ["available", "on-duty", "inactive"] },
  password: { required: true, type: "string", minLength: 6 },
};

const truckSchema = {
  registrationNumber: { required: true, type: "string", minLength: 2, maxLength: 20 },
  make: { type: "string", maxLength: 50 },
  model: { type: "string", maxLength: 50 },
  year: { type: "number", validate: (v) => (v < 1900 || v > 2100 ? "year must be between 1900 and 2100" : null) },
  fuelType: { type: "string", enum: ["diesel", "petrol", "electric", "hybrid"] },
  status: { type: "string", enum: ["available", "on-duty", "under maintenance", "inactive"] },
  capacity: { type: "number", validate: (v) => (v < 0 ? "capacity cannot be negative" : null) },
};

const customerSchema = {
  name: { required: true, type: "string", minLength: 2, maxLength: 100 },
  email: { type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: { type: "string", maxLength: 20 },
  address: { type: "string", maxLength: 500 },
};

const makeOptional = (schema) => {
  const opt = {};
  for (const [key, rules] of Object.entries(schema)) {
    opt[key] = { ...rules, required: false };
  }
  return opt;
};

const validate = (schema) => (req, res, next) => {
  if (req.method === "GET") return next();
  const error = validateEntity(req.body, schema);
  if (error) return res.status(400).json({ message: error });
  next();
};

const driverUpdateSchema = makeOptional(driverSchema);
const truckUpdateSchema = makeOptional(truckSchema);
const customerUpdateSchema = makeOptional(customerSchema);

const allowFields = (fields) => (req, res, next) => {
  if (req.method === "GET") return next();
  req.body = pickAllowed(req.body, fields);
  next();
};

module.exports = {
  validateDriver: validate(driverSchema),
  validateDriverUpdate: validate(driverUpdateSchema),
  validateTruck: validate(truckSchema),
  validateTruckUpdate: validate(truckUpdateSchema),
  validateCustomer: validate(customerSchema),
  validateCustomerUpdate: validate(customerUpdateSchema),
  allowDriverFields: allowFields(DRIVER_FIELDS),
  allowTruckFields: allowFields(TRUCK_FIELDS),
  allowCustomerFields: allowFields(CUSTOMER_FIELDS),
};
