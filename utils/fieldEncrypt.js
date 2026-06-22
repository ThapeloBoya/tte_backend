const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_VERSION = "v1";
const SEPARATOR = ":";

let encryptionKey = null;

exports.initEncryptionKey = (hexKey) => {
  if (!hexKey) {
    console.warn("ENCRYPTION_KEY not set — field encryption is disabled");
    encryptionKey = null;
    return;
  }
  const raw = Buffer.from(hexKey, "hex");
  if (raw.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  encryptionKey = raw;
};

exports.encrypt = (plaintext) => {
  if (plaintext == null || plaintext === "") return plaintext;
  if (!encryptionKey) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  const payload = [KEY_VERSION, iv.toString("hex"), tag, encrypted].join(SEPARATOR);
  return Buffer.from(payload, "utf8").toString("base64");
};

exports.decrypt = (encoded) => {
  if (encoded == null || encoded === "") return encoded;
  if (!encryptionKey) return encoded;

  let payload;
  try {
    payload = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return encoded;
  }

  const parts = payload.split(SEPARATOR);
  if (parts.length !== 4 || parts[0] !== KEY_VERSION) return encoded;

  const [, ivHex, tagHex, ciphertext] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encoded;
  }
};

exports.isEncrypted = (value) => {
  if (value == null || value === "") return false;
  try {
    const payload = Buffer.from(value, "base64").toString("utf8");
    return payload.startsWith(KEY_VERSION + SEPARATOR);
  } catch {
    return false;
  }
};