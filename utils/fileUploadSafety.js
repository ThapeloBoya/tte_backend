const crypto = require("crypto");
const path = require("path");

const MAX_POD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_POD_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_POD_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

const MAGIC_BYTES = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [0x52, 0x49, 0x46, 0x46],
};

const checkMagicBytes = (buffer, signature) => {
  if (!buffer || buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
};

const detectActualType = (buffer) => {
  if (!buffer || buffer.length < 4) return null;
  if (checkMagicBytes(buffer, MAGIC_BYTES.pdf)) return "pdf";
  if (checkMagicBytes(buffer, MAGIC_BYTES.jpeg)) return "jpeg";
  if (checkMagicBytes(buffer, MAGIC_BYTES.png)) return "png";
  if (checkMagicBytes(buffer, MAGIC_BYTES.webp)) return "webp";
  return null;
};

const validatePODFile = (file) => {
  if (!file) {
    return "No POD file uploaded";
  }

  if (Array.isArray(file)) {
    return "Only one POD file can be uploaded at a time";
  }

  if (file.size > MAX_POD_SIZE_BYTES) {
    return "POD file must be 10MB or smaller";
  }

  const ext = path.extname(file.name || "").toLowerCase();
  const mimetype = (file.mimetype || "").toLowerCase();

  if (!ALLOWED_POD_EXTENSIONS.has(ext) || !ALLOWED_POD_TYPES.has(mimetype)) {
    return "POD must be a PDF, JPG, PNG, or WebP file";
  }

  const actualType = detectActualType(file.data);
  const extToType = { ".pdf": "pdf", ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp" };
  if (actualType && actualType !== extToType[ext]) {
    return `File content does not match extension. Expected ${extToType[ext]}, detected ${actualType}`;
  }

  return null;
};

const createSafePODFilename = (load, originalName = "pod.pdf") => {
  const ext = path.extname(originalName).toLowerCase();
  const ticket = String(load.ticketNumber || load._id || "load").replace(/[^a-zA-Z0-9-]/g, "");
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  return `POD-${ticket}-${unique}${ext}`;
};

module.exports = {
  MAX_POD_SIZE_BYTES,
  validatePODFile,
  createSafePODFilename,
};
