const sanitizeValue = (value) => {
  if (typeof value === "string") {
    return value
      .replace(/<[^>]*>?/gm, "")
      .replace(/[{}$]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return value;
};

const sanitizeBody = (body) => {
  const out = {};
  for (const [key, val] of Object.entries(body)) {
    if (Array.isArray(val)) {
      out[key] = val.map(sanitizeValue);
    } else if (val && typeof val === "object") {
      out[key] = sanitizeBody(val);
    } else {
      out[key] = sanitizeValue(val);
    }
  }
  return out;
};

module.exports = { sanitizeBody, sanitizeValue };
