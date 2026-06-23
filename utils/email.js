const nodemailer = require("nodemailer");

const getTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("==");
    console.log(`EMAIL TO: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${html.replace(/<[^>]*>/g, "")}`);
    console.log("==");
    console.log("No SMTP configured. Email logged to console.");
    return { messageId: "console-only" };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@tms.com",
    to,
    subject,
    html,
  });

  return info;
};

module.exports = { sendEmail };
