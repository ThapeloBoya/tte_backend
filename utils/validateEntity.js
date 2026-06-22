const validateEntity = (body, schema) => {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];

    if (rules.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (rules.type === "string" && typeof value !== "string") {
      errors.push(`${field} must be a string`);
    }

    if (rules.type === "number" && (typeof value !== "number" || Number.isNaN(value))) {
      errors.push(`${field} must be a number`);
    }

    if (rules.type === "boolean" && typeof value !== "boolean") {
      errors.push(`${field} must be a boolean`);
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(", ")}`);
    }

    if (rules.minLength && typeof value === "string" && value.trim().length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }

    if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
      errors.push(`${field} must be at most ${rules.maxLength} characters`);
    }

    if (rules.pattern && typeof value === "string" && !rules.pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }

    if (rules.validate) {
      const customErr = rules.validate(value, body);
      if (customErr) errors.push(customErr);
    }
  }

  return errors.length ? errors.join("; ") : null;
};

const pickAllowed = (body, allowedFields) => {
  const picked = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
};

module.exports = { validateEntity, pickAllowed };
