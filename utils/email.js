const nodemailer = require("nodemailer");
const dns = require("dns");
const axios = require("axios");
const fs = require("fs");

// --- nodemailer fallback (local dev) ---
const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    lookup: (hostname, options, cb) => {
      dns.lookup(hostname, { ...options, family: 4 }, cb);
    },
  });
};

const sendViaSMTP = async ({ to, subject, html, attachments }) => {
  const transporter = getTransporter();
  if (!transporter) return null;
  return transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@tms.com",
    to, subject, html, attachments,
  });
};

// --- Brevo API (Render / production) ---
const BREVO_SENDER = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || "noreply@tms.com";

const sendViaBrevo = async ({ to, subject, html, attachments }) => {
  const payload = {
    sender: { email: BREVO_SENDER },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  if (attachments?.length) {
    payload.attachment = await Promise.all(attachments.map(async (a) => ({
      name: a.filename,
      content: (await fs.promises.readFile(a.path)).toString("base64"),
    })));
  }

  await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
    headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
  });
};

// --- unified send ---
const sendEmail = async (opts) => {
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(opts);
  }
  return sendViaSMTP(opts);
};

module.exports = { sendEmail };
