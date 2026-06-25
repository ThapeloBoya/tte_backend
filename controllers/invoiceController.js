const path = require("path");
const Invoice = require("../models/Invoice");
const Load = require("../models/Load");
const Customer = require("../models/Customer");
const Driver = require("../models/Driver");
const { logAction } = require("../utils/auditLogger");
const { notifyAdmins, notifySuperAdmin } = require("../utils/notify");
const { generateInvoicePDF } = require("./generateInvoicePDF");
const { sendEmail } = require("../utils/email");

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Invoice.countDocuments({
    invoiceNumber: new RegExp(`^INV-${year}-`),
  });
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
};

exports.getInvoices = async (req, res) => {
  try {
    const { status, customer, driver, page = 1, limit = 20, sort = "-createdAt" } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (driver) filter.driver = driver;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .populate("customer", "name email phone")
      .populate("driver", "name email")
      .populate("load", "ticketNumber pickupLocation deliveryLocation")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ invoices, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer", "name email phone address")
      .populate("driver", "name email phone")
      .populate("load", "ticketNumber pickupLocation deliveryLocation cargoType priority collectionDate deliveryDate");

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const {
      load, customer, driver, billTo, lineItems,
      taxPercent, discount, currency, dueDate,
      notes, status,
    } = req.body;

    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!lineItems || lineItems.length === 0) return res.status(400).json({ message: "At least one line item is required" });
    if (!dueDate) return res.status(400).json({ message: "Due date is required" });

    const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmount = subtotal * ((taxPercent || 0) / 100);
    const total = subtotal - (discount || 0) + taxAmount;

    const invoiceNumber = await generateInvoiceNumber();

    let billToData = billTo;
    if (!billToData) {
      const cust = await Customer.findById(customer);
      billToData = {
        name: cust?.name || "",
        email: cust?.email || "",
        phone: cust?.phone || "",
        address: cust?.address || "",
      };
    }

    const invoice = await Invoice.create({
      invoiceNumber,
      load: load || undefined,
      customer,
      driver: driver || undefined,
      billTo: billToData,
      lineItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxPercent: taxPercent || 0,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discount: discount || 0,
      total: Math.round(total * 100) / 100,
      currency: currency || "USD",
      dueDate: new Date(dueDate),
      notes,
      status: status || "draft",
      createdBy: req.user?.email,
    });

    await logAction({
      action: "created", entity: "Invoice", entityId: invoice._id, req,
      details: `Created invoice ${invoice.invoiceNumber} for ${billToData.name || "unknown"} ($${invoice.total})`,
    });

    await notifyAdmins({
      title: "Invoice Created",
      message: `Invoice ${invoice.invoiceNumber} for ${billToData.name || "unknown"} — $${invoice.total}`,
      entity: "Invoice", entityId: invoice._id, action: "created",
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("customer", "name email phone")
      .populate("load", "ticketNumber");

    const pdfUrl = await generateInvoicePDF(populated);
    populated.pdfUrl = pdfUrl;
    await Invoice.findByIdAndUpdate(invoice._id, { pdfUrl, status: "sent" });
    populated.status = "sent";

    const recipientEmail = billToData.email || populated.customer?.email;
    if (recipientEmail) {
      const pdfPath = path.join(__dirname, "..", pdfUrl);
      await sendEmail({
        to: recipientEmail,
        subject: `Invoice ${invoice.invoiceNumber} from Moova Logistics`,
        html: `<p>Dear ${billToData.name || "Valued Customer"},</p>
<p>Please find attached your invoice <strong>${invoice.invoiceNumber}</strong> for <strong>R${(populated.total || 0).toFixed(2)}</strong>.</p>
<p>Due Date: ${populated.dueDate ? new Date(populated.dueDate).toDateString() : "N/A"}</p>
<p>If you have any questions, please contact us at info@moova.co.za or +27 11 225 2679.</p>
<p>Thank you for choosing Moova Logistics.</p>`,
        attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: pdfPath }],
      }).catch((err) => console.error("Invoice email send failed:", err.message));
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createInvoiceFromLoad = async (req, res) => {
  try {
    const { loadId, dueDate, lineItems, taxPercent, discount } = req.body;

    if (!loadId) return res.status(400).json({ message: "Load ID is required" });

    const load = await Load.findById(loadId)
      .populate("customer", "name email phone address")
      .populate("driver", "name email");

    if (!load) return res.status(404).json({ message: "Load not found" });
    if (!load.customer) return res.status(400).json({ message: "Load has no customer assigned" });

    const existing = await Invoice.findOne({ load: loadId });
    if (existing) return res.status(400).json({ message: "Invoice already exists for this load", invoice: existing });

    let items = lineItems;
    if (!items || items.length === 0) {
      const rate = 500;
      items = [
        { description: `Transport: ${load.pickupLocation || "N/A"} → ${load.deliveryLocation || "N/A"}`, quantity: 1, rate, amount: rate },
      ];
      if (load.cargoType) {
        items.push({ description: `Cargo handling (${load.cargoType})`, quantity: 1, rate: 100, amount: 100 });
      }
    }

    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmt = subtotal * ((taxPercent || 0) / 100);
    const total = subtotal - (discount || 0) + taxAmt;

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      load: loadId,
      customer: load.customer._id,
      driver: load.driver?._id || undefined,
      billTo: {
        name: load.customer.name || "",
        email: load.customer.email || "",
        phone: load.customer.phone || "",
        address: load.customer.address || "",
      },
      lineItems: items,
      subtotal: Math.round(subtotal * 100) / 100,
      taxPercent: taxPercent || 0,
      taxAmount: Math.round(taxAmt * 100) / 100,
      discount: discount || 0,
      total: Math.round(total * 100) / 100,
      dueDate: new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.user?.email,
    });

    await logAction({
      action: "created", entity: "Invoice", entityId: invoice._id, req,
      details: `Created invoice ${invoice.invoiceNumber} from load ${load.ticketNumber}`,
    });

    await notifyAdmins({
      title: "Invoice Created from Load",
      message: `Invoice ${invoice.invoiceNumber} generated from load ${load.ticketNumber} — $${invoice.total}`,
      entity: "Invoice", entityId: invoice._id, action: "created",
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("customer", "name email phone")
      .populate("load", "ticketNumber pickupLocation deliveryLocation")
      .populate("driver", "name email");

    const pdfUrl = await generateInvoicePDF(populated);
    populated.pdfUrl = pdfUrl;
    await Invoice.findByIdAndUpdate(invoice._id, { pdfUrl, status: "sent" });
    populated.status = "sent";

    const recipientEmail = populated.customer?.email || populated.billTo?.email;
    if (recipientEmail) {
      const pdfPath = path.join(__dirname, "..", pdfUrl);
      await sendEmail({
        to: recipientEmail,
        subject: `Invoice ${invoice.invoiceNumber} from Moova Logistics`,
        html: `<p>Dear ${populated.billTo?.name || populated.customer?.name || "Valued Customer"},</p>
<p>Please find attached your invoice <strong>${invoice.invoiceNumber}</strong> for <strong>R${(populated.total || 0).toFixed(2)}</strong>.</p>
<p>Due Date: ${populated.dueDate ? new Date(populated.dueDate).toDateString() : "N/A"}</p>
<p>If you have any questions, please contact us at info@moova.co.za or +27 11 225 2679.</p>
<p>Thank you for choosing Moova Logistics.</p>`,
        attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: pdfPath }],
      }).catch((err) => console.error("Invoice email send failed:", err.message));
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return res.status(400).json({ message: `Cannot update a ${invoice.status} invoice` });
    }

    const allowedFields = [
      "lineItems", "taxPercent", "discount", "dueDate", "notes",
      "billTo", "currency", "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    if (req.body.lineItems) {
      invoice.subtotal = req.body.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      invoice.taxAmount = invoice.subtotal * ((invoice.taxPercent || 0) / 100);
      invoice.total = invoice.subtotal - (invoice.discount || 0) + invoice.taxAmount;
      invoice.subtotal = Math.round(invoice.subtotal * 100) / 100;
      invoice.taxAmount = Math.round(invoice.taxAmount * 100) / 100;
      invoice.total = Math.round(invoice.total * 100) / 100;
    }

    invoice.updatedBy = req.user?.email;
    await invoice.save();

    await logAction({
      action: "updated", entity: "Invoice", entityId: invoice._id, req,
      details: `Updated invoice ${invoice.invoiceNumber} (status: ${invoice.status})`,
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("customer", "name email phone")
      .populate("load", "ticketNumber pickupLocation deliveryLocation")
      .populate("driver", "name email");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.markAsPaid = async (req, res) => {
  try {
    const { paymentMethod, paymentReference, paidDate } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "cancelled") {
      return res.status(400).json({ message: "Cannot mark a cancelled invoice as paid" });
    }

    invoice.status = "paid";
    invoice.paidDate = paidDate ? new Date(paidDate) : new Date();
    invoice.paymentMethod = typeof paymentMethod === "string" ? paymentMethod.trim() : invoice.paymentMethod;
    invoice.paymentReference = typeof paymentReference === "string" ? paymentReference.trim() : invoice.paymentReference;
    invoice.updatedBy = req.user?.email;
    await invoice.save();

    await logAction({
      action: "paid", entity: "Invoice", entityId: invoice._id, req,
      details: `Marked invoice ${invoice.invoiceNumber} as paid (${paymentMethod || "N/A"})`,
    });

    await notifyAdmins({
      title: "Invoice Paid",
      message: `Invoice ${invoice.invoiceNumber} marked as paid — $${invoice.total}`,
      entity: "Invoice", entityId: invoice._id, action: "paid",
    });

    const populated = await Invoice.findById(invoice._id)
      .populate("customer", "name email phone")
      .populate("load", "ticketNumber");

    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.cancelInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Cannot cancel a paid invoice" });
    }

    invoice.status = "cancelled";
    invoice.updatedBy = req.user?.email;
    await invoice.save();

    await logAction({
      action: "cancelled", entity: "Invoice", entityId: invoice._id, req,
      details: `Cancelled invoice ${invoice.invoiceNumber}`,
    });

    res.json({ message: "Invoice cancelled", invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Cannot delete a paid invoice" });
    }

    await invoice.softDelete(req.user?.email);

    await logAction({
      action: "deleted", entity: "Invoice", entityId: invoice._id, req,
      details: `Deleted invoice ${invoice.invoiceNumber}`,
    });

    res.json({ message: "Invoice deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]);

    const totalInvoiced = await Invoice.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    const totalPaid = await Invoice.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    res.json({
      byStatus: stats,
      totalInvoiced: totalInvoiced[0]?.total || 0,
      totalPaid: totalPaid[0]?.total || 0,
      totalOutstanding: (totalInvoiced[0]?.total || 0) - (totalPaid[0]?.total || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
