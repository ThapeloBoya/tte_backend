const Invoice = require("../models/Invoice");
const { validateSignature, isSandbox } = require("../utils/payfast");
const { logAction } = require("../utils/auditLogger");

exports.payfastNotify = async (req, res) => {
  try {
    const data = req.body;

    if (!validateSignature(data)) {
      console.error("[PayFast] Invalid signature");
      return res.status(400).send("INVALID SIGNATURE");
    }

    const invoiceId = data.custom_str1 || data.m_payment_id;
    if (!invoiceId) {
      console.error("[PayFast] No invoice ID in notification");
      return res.status(400).send("MISSING INVOICE ID");
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      console.error("[PayFast] Invoice not found:", invoiceId);
      return res.status(404).send("INVOICE NOT FOUND");
    }

    if (invoice.status === "paid") {
      return res.status(200).send("OK");
    }

    const paymentStatus = data.payment_status;
    if (paymentStatus === "COMPLETE") {
      invoice.status = "paid";
      invoice.paidDate = new Date();
      invoice.paymentMethod = "payfast";
      invoice.paymentReference = data.pf_payment_id || `PAYFAST-${Date.now()}`;
      await invoice.save();

      await logAction({
        action: "paid",
        entity: "Invoice",
        entityId: invoice._id,
        details: `Invoice ${invoice.invoiceNumber} paid via PayFast (${data.pf_payment_id})`,
      });

      console.log(`[PayFast] Invoice ${invoice.invoiceNumber} marked as paid`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("[PayFast] ITN error:", err);
    res.status(500).send("SERVER ERROR");
  }
};
