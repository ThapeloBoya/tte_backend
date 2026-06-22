const LOAD_STATUSES = ["waiting", "assigned", "in transit", "completed", "approved", "rejected", "canceled"];
const CREATE_STATUSES = ["waiting", "assigned"];
const ADMIN_UPDATE_FIELDS = [
  "customer",
  "driver",
  "truck",
  "collectionDate",
  "deliveryDate",
  "pickupLocation",
  "pickupLat",
  "pickupLng",
  "deliveryLocation",
  "deliveryLat",
  "deliveryLng",
  "deliveryDay",
  "cargoType",
  "priority",
  "customerRef",
  "notes",
  "status",
  "weight",
  "stops",
  "routeDistance",
  "routeDuration",
  "routePolyline",
];
const DRIVER_MILESTONE_FIELDS = ["arrivedPickupAt", "loadedAt", "arrivedDeliveryAt", "completedAt"];
const DRIVER_ISSUE_TYPES = ["delay", "breakdown", "accident", "wrong address", "rejected delivery", "paperwork", "other"];

const pickAllowed = (body, allowedFields) => {
  const picked = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
};

const toOptionalDate = (value, field) => {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }
  return date;
};

const requireFields = (body, fields) => {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");
  if (missing.length) {
    return `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`;
  }
  return null;
};

const validateCreateLoadBody = (body) => {
  const requiredError = requireFields(body, ["customer", "truck", "pickupLocation", "deliveryLocation"]);
  if (requiredError) return requiredError;
  if (body.status && !CREATE_STATUSES.includes(body.status)) {
    return "Load can only be created as waiting or assigned";
  }
  if (body.priority && !["normal", "high", "urgent"].includes(body.priority)) {
    return "Invalid priority";
  }
  return null;
};

const normalizeAdminLoadUpdate = (body) => {
  const updates = pickAllowed(body, ADMIN_UPDATE_FIELDS);

  if (updates.status && !LOAD_STATUSES.includes(updates.status)) {
    throw new Error("Invalid status");
  }

  if (updates.priority && !["normal", "high", "urgent"].includes(updates.priority)) {
    throw new Error("Invalid priority");
  }

  for (const field of ["collectionDate", "deliveryDate"]) {
    if (field in updates) updates[field] = toOptionalDate(updates[field], field);
  }

  for (const field of ["pickupLat", "pickupLng", "deliveryLat", "deliveryLng", "weight", "routeDistance", "routeDuration"]) {
    if (updates[field] !== undefined && updates[field] !== "") {
      const number = Number(updates[field]);
      if (Number.isNaN(number)) throw new Error(`${field} must be a number`);
      updates[field] = number;
    }
  }

  return updates;
};

const normalizeDriverMilestones = (milestones) => {
  if (!milestones || typeof milestones !== "object" || Array.isArray(milestones)) return {};
  const safe = {};

  for (const field of DRIVER_MILESTONE_FIELDS) {
    if (milestones[field] !== undefined) {
      safe[field] = toOptionalDate(milestones[field], field);
    }
  }

  return safe;
};

const normalizeDriverIssue = (driverIssue) => {
  if (!driverIssue || typeof driverIssue !== "object" || Array.isArray(driverIssue)) return null;
  const type = driverIssue.type || "other";
  const description = (driverIssue.description || "").trim();

  if (!DRIVER_ISSUE_TYPES.includes(type)) {
    throw new Error("Invalid issue type");
  }

  if (!description) {
    throw new Error("Issue description is required");
  }

  return {
    type,
    description,
    reportedAt: new Date(),
    status: "open",
  };
};

module.exports = {
  LOAD_STATUSES,
  validateCreateLoadBody,
  normalizeAdminLoadUpdate,
  normalizeDriverMilestones,
  normalizeDriverIssue,
};
