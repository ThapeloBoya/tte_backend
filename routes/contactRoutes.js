
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const DemoRequest = require("../models/DemoRequest");
const { sendEmail } = require("../utils/email");

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many requests. Please try again later." },
});

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const validateLength = (value, max) => {
  return !value || value.length <= max;
};

router.post("/", contactLimiter, async (req, res) => {
  try {
    const { name, email, company, message } = req.body;

    if (!name || !email || !company) {
      return res.status(400).json({ message: "Name, email, and company are required" });
    }

    if (!validateLength(name, 100) || !validateLength(company, 200) || !validateLength(message, 2000) || !validateLength(email, 254)) {
      return res.status(400).json({ message: "One or more fields exceed the maximum length" });
    }

    await DemoRequest.create({ name, email, company, message });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company);
    const safeMessage = escapeHtml(message);

    const html = `
      <h2>New Demo Request</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:8px;font-weight:700">Name</td><td style="padding:8px">${safeName}</td></tr>
        <tr><td style="padding:8px;font-weight:700">Email</td><td style="padding:8px">${safeEmail}</td></tr>
        <tr><td style="padding:8px;font-weight:700">Company</td><td style="padding:8px">${safeCompany}</td></tr>
        <tr><td style="padding:8px;font-weight:700">Message</td><td style="padding:8px">${safeMessage || "—"}</td></tr>
      </table>
    `;

    try {
      await sendEmail({
        to: "allielaura83@gmail.com",
        subject: `Demo Request from ${safeName} (${safeCompany})`,
        html,
      });
    } catch (emailErr) {
      console.error("Demo email send failed (saved to DB):", emailErr.message);
    }

    res.json({ message: "Demo request received" });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ message: "Failed to send request" });
  }
});

module.exports = router;
