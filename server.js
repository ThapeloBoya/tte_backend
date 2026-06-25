const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const { Server } = require("socket.io");
const path = require("path");
const fileUpload = require("express-fileupload");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const passport = require("./config/passport");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { initSocket } = require("./utils/socket");
const { initMaintenanceReminder } = require("./utils/maintenanceReminder");

dotenv.config();

const app = express();
const server = http.createServer(app);

// ---------------- ENV CHECK ----------------
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error("FATAL: JWT_SECRET and MONGO_URI must be set");
  process.exit(1);
}

// ---------------- ALLOWED ORIGINS ----------------
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL || "https://tte-frontend-seven.vercel.app"
];

const corsCheck = (origin, cb) => {
  if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
  cb(null, false);
};

// ---------------- BASIC MIDDLEWARE ----------------
// Manual CORS headers (guaranteed to run before any route)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const normalizedOrigin = origin.replace(/\/+$/, '');
    const allowed = allowedOrigins.some(a => a.replace(/\/+$/, '') === normalizedOrigin);
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    } else {
      console.log("CORS DEBUG: origin='%s' | allowed=%j", origin, allowedOrigins);
    }
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(helmet());
app.use(morgan("short"));
app.use(express.json({ limit: "10mb" }));
app.use(fileUpload());

// ---------------- STATIC FILES ----------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------- SESSION ----------------
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { sameSite: "lax" }
}));

app.use(passport.initialize());
app.use(passport.session());

// ---------------- RATE LIMITING ----------------
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

// ---------------- SANITIZATION ----------------
// Sanitize middleware (custom wrapper for Express 5 compatibility)
const sanitizeValue = (val) => {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.map(sanitizeValue);
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      const sanitizedKey = k.replace(/^\$/, '').replace(/\./g, '');
      out[sanitizedKey] = sanitizeValue(v);
    }
    return out;
  }
  if (typeof val === 'string') return val.replace(/^\$/, '');
  return val;
};

const sanitizeMiddleware = (options = {}) => (req, res, next) => {
  ['body', 'params', 'headers'].forEach((key) => {
    if (req[key]) req[key] = sanitizeValue(req[key]);
  });
  if (req.query) {
    Object.defineProperty(req, 'query', { value: sanitizeValue(req.query), writable: true, configurable: true });
  }
  next();
};

app.use(sanitizeMiddleware());

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
  cors: { origin: corsCheck, credentials: true }
});
initSocket(io);
initMaintenanceReminder();

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("register", ({ role, email }) => {
    if (email) socket.join(`user:${email}`);
    if (role) socket.join(`role:${role}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ---------------- SWAGGER ----------------
if (process.env.NODE_ENV !== "production") {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: { title: "TMS API", version: "1.0.0" }
    },
    apis: ["./routes/*.js"]
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ---------------- ROUTES ----------------
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));
app.use("/api/trucks", require("./routes/truckRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/loads", require("./routes/loadRoutes"));
app.use("/api/driver-loads", require("./routes/driverLoads"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin2", require("./routes/admin2"));
app.use("/api/superadmin", require("./routes/superadminRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/routes", require("./routes/routeRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/fuel", require("./routes/fuelRoutes"));
app.use("/api/maintenance", require("./routes/maintenanceRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));
app.use("/api/audit-logs", require("./routes/auditRoutes"));
app.use("/api/track", require("./routes/trackRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));

// ---------------- HEALTH ----------------
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// ---------------- 404 for unknown API routes ----------------
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found" });
  }
  next();
});

// ---------------- ERROR HANDLER ----------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

// ---------------- MONGO ----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});