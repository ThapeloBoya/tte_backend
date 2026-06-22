<<<<<<< HEAD
const Customer = require("../models/Customer");
const { logAction } = require("../utils/auditLogger");
const { getIO } = require("../utils/socket");

exports.createCustomer = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ message: "Address is required" });
    }

    const customer = await Customer.create({ name: name.trim(), email, phone, address: address.trim() });

    await logAction({
      action: "created", entity: "Customer", entityId: customer._id, req,
      details: `Created customer ${customer.name}`,
    });

    const io = getIO();
    if (io) io.emit("customerCreated", customer);

    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const allowed = ["name", "email", "phone", "address"];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        customer[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
      }
    }

    await customer.save();

    await logAction({
      action: "updated", entity: "Customer", entityId: customer._id, req,
      details: `Updated customer ${customer.name}`,
      metadata: { changes: Object.keys(req.body) },
    });

    const io = getIO();
    if (io) io.emit("customerUpdated", customer);

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADD THIS DELETE FUNCTION
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    await customer.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Customer", entityId: req.params.id, req,
      details: `Deleted customer ${customer.name}`,
    });

    const io = getIO();
    if (io) io.emit("customerDeleted", { id: req.params.id });

    res.json({ message: "Customer removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
=======
const Customer = require("../models/Customer");

exports.createCustomer = async (req, res) => {
  const customer = await Customer.create(req.body);
  res.status(201).json(customer);
};

exports.getCustomers = async (req, res) => {
  const customers = await Customer.find();
  res.json(customers);
};

exports.getCustomerById = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  res.json(customer);
};

exports.updateCustomer = async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  res.json(customer);
};

// ADD THIS DELETE FUNCTION
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    await customer.deleteOne();
    res.json({ message: "Customer removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
