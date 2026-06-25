const crypto = require("crypto");

const SANDBOX_URL = "https://sandbox.payfast.co.za/eng/process";
const LIVE_URL = "https://www.payfast.co.za/eng/process";

const isSandbox = () => process.env.PAYFAST_SANDBOX !== "false";

const getMerchantId = () => process.env.PAYFAST_MERCHANT_ID || "10000100";
const getMerchantKey = () => process.env.PAYFAST_MERCHANT_KEY || "46f0cd694581a";
const getPassphrase = () => process.env.PAYFAST_PASSPHRASE || "";

const generateSignature = (params) => {
  const pfOutput = [];
  Object.keys(params)
    .sort()
    .forEach((key) => {
      if (params[key] !== "") {
        pfOutput.push(`${key}=${encodeURIComponent(params[key]).replace(/%20/g, "+")}`);
      }
    });
  const pfParamString = pfOutput.join("&");
  const pfSignature = crypto.createHash("md5").update(pfParamString + getPassphrase()).digest("hex");
  return { pfParamString, pfSignature };
};

const getPaymentUrl = (invoice) => {
  const params = {
    merchant_id: getMerchantId(),
    merchant_key: getMerchantKey(),
    return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/invoices/${invoice._id}`,
    cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/invoices`,
    notify_url: `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/payments/payfast/notify`,
    name_first: invoice.billTo?.name || "Customer",
    email_address: invoice.billTo?.email || "",
    m_payment_id: invoice._id.toString(),
    amount: (invoice.total || 0).toFixed(2),
    item_name: `Invoice ${invoice.invoiceNumber}`,
    custom_str1: invoice._id.toString(),
  };

  const { pfParamString, pfSignature } = generateSignature(params);

  const baseUrl = isSandbox() ? SANDBOX_URL : LIVE_URL;
  return `${baseUrl}?${pfParamString}&signature=${pfSignature}`;
};

const validateSignature = (data) => {
  const { signature, ...params } = data;
  const { pfSignature } = generateSignature(params);
  return pfSignature === signature;
};

module.exports = { getPaymentUrl, validateSignature, isSandbox };
