const crypto = require("crypto");
const base32 = require("thirty-two");

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;

function generateSecret(length = 20) {
  const bytes = crypto.randomBytes(length);
  return base32.encode(bytes).toString("utf8").replace(/=+$/, "");
}

function generateTOTP(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter), 0);

  const decoded = base32.decode(secret);
  const hmac = crypto.createHmac("sha1", decoded).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function verifyTOTP(token, secret, window = 1) {
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const candidate = generateTOTP(secret, now + i * TOTP_PERIOD * 1000);
    if (candidate === token) return true;
  }
  return false;
}

function keyuri(email, issuer, secret) {
  const encoded = encodeURIComponent(secret);
  const encIssuer = encodeURIComponent(issuer);
  const encEmail = encodeURIComponent(email);
  return `otpauth://totp/${encIssuer}:${encEmail}?secret=${encoded}&issuer=${encIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

module.exports = { generateSecret, generateTOTP, verifyTOTP, keyuri };
