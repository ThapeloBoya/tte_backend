const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("0")) return `+27${cleaned.slice(1)}`;
  if (!cleaned.startsWith("+")) return `+${cleaned}`;
  return cleaned;
};

const getClient = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
};

const sendSMS = async ({ to, body }) => {
  const client = getClient();
  const normalized = normalizePhone(to);

  if (!normalized) {
    console.log("MESSAGING: No valid phone number provided.");
    return;
  }

  if (!client) {
    console.log("==");
    console.log(`SMS TO: ${normalized}`);
    console.log(`BODY: ${body}`);
    console.log("==");
    console.log("No Twilio configured. Message logged to console.");
    return { sid: "console-only" };
  }

  const msg = await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: normalized,
  });

  return msg;
};

const sendWhatsApp = async ({ to, body }) => {
  const client = getClient();
  const normalized = normalizePhone(to);

  if (!normalized) {
    console.log("MESSAGING: No valid phone number provided.");
    return;
  }

  if (!client) {
    console.log("==");
    console.log(`WHATSAPP TO: ${normalized}`);
    console.log(`BODY: ${body}`);
    console.log("==");
    console.log("No Twilio configured. Message logged to console.");
    return { sid: "console-only" };
  }

  const from = process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

  const msg = await client.messages.create({
    body,
    from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    to: `whatsapp:${normalized}`,
  });

  return msg;
};

const sendMessage = async ({ to, body, channel = "sms" }) => {
  if (channel === "whatsapp") {
    return sendWhatsApp({ to, body });
  }
  return sendSMS({ to, body });
};

module.exports = { sendSMS, sendWhatsApp, sendMessage, normalizePhone };
