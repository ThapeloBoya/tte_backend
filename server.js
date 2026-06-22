<<<<<<< HEAD
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const { Server } = require("socket.io");
const path = require("path");
const fileUpload = require("express-fileupload");
const session = require("express-session");
const passport = require("./config/passport");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

dotenv.config();

// --- Validate critical env vars ---
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error("FATAL: JWT_SECRET and MONGO_URI must be set in .env");
  process.exit(1);
}

// --- Initialize field-level encryption ---
const { initEncryptionKey } = require("./utils/fieldEncrypt");
initEncryptionKey(process.env.ENCRYPTION_KEY);

const app = express();

// --- TLS / HTTPS setup ---
const certDir = path.join(__dirname, "certs");
const tlsEnabled = process.env.TLS_ENABLED === "true";
let server;

if (tlsEnabled) {
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const tlsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      secureOptions:
        crypto.constants.SSL_OP_NO_SSLv3 |
        crypto.constants.SSL_OP_NO_TLSv1 |
        crypto.constants.SSL_OP_NO_TLSv1_1,
      ciphers:
        "TLS_AES_256_GCM_SHA384:" +
        "TLS_CHACHA20_POLY1305_SHA256:" +
        "ECDHE-RSA-AES256-GCM-SHA384:" +
        "ECDHE-ECDSA-AES256-GCM-SHA384",
      honorCipherOrder: true,
      minVersion: "TLSv1.2",
    };
    server = https.createServer(tlsOptions, app);
    console.log("TLS enabled — using HTTPS");
  } else {
    console.warn("TLS_ENABLED=true but cert files not found at", certDir);
    console.warn("Run: node scripts/generate-dev-certs.js");
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

// --- Allowed frontend origins ---
const allowedOrigins = [
  "http://localhost:3000",
  "https://tte-frontend-seven.vercel.app",
];

// --- Middleware ---
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(new Error("CORS: no origin provided"), false);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS policy does not allow access from ${origin}`), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: tlsEnabled ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));
app.use(morgan("short"));
app.use(express.json({ limit: "10mb" }));
// Uploads — filenames use crypto.randomBytes (unguessable), no directory listing
app.use("/uploads", (req, res, next) => {
  console.log(`Download: ${req.method} ${req.originalUrl} — ${req.ip}`);
  next();
}, express.static(path.join(__dirname, "uploads")));
app.use(fileUpload());

// Passport (minimal session for serialization, OAuth flow)
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// --- Input sanitization + NoSQL injection protection ---
const { sanitizeBody } = require("./utils/sanitize");
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object" && !req._body) {
    req.body = sanitizeBody(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeBody(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeBody(req.params);
  }
  next();
});

// Strip $ and . from keys in body/query/params (NoSQL injection prevention)
app.use(mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    console.warn(`NoSQL injection attempt detected on ${req.method} ${req.originalUrl} — key: ${key}`);
  },
}));

// --- Request timeout ---
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(408).json({ message: "Request timeout" });
  });
  next();
});

// --- Rate limiting ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

// --- General API rate limiter (all authenticated routes) ---
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// --- MFA endpoint rate limiter (stricter — brute force protection) ---
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many MFA attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/mfa/verify-challenge", mfaLimiter);
app.use("/api/auth/mfa/verify-recovery", mfaLimiter);
app.use("/api/auth/mfa/verify-enable", mfaLimiter);
app.use("/api/auth/mfa/generate-recovery", mfaLimiter);

// --- Track endpoint rate limiter (public, stricter) ---
const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many tracking requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/track", trackLimiter);

// --- Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

// attach io early so routes can use it
app.set("io", io);

// socket events
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("register", ({ role, email }) => {
    if (role) socket.join(`role:${role}`);
    if (email) socket.join(`user:${email}`);
    console.log(`Socket ${socket.id} registered as role:${role}, user:${email}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// --- Import socket helper AFTER io exists ---
const { initSocket } = require("./utils/socket");
initSocket(io);

// --- Swagger (disabled in production) ---
if (process.env.NODE_ENV !== "production") {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "TMS API",
        version: "1.0.0",
        description: "Transport Management System API",
      },
      servers: [{ url: "/api" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    apis: ["./routes/*.js", "./swagger/*.js"],
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// --- Health check ---
app.use("/api/health", require("./routes/healthRoutes"));

// --- Scheduled tasks ---
const { run: runCron } = require("./utils/cron");
runCron();

// --- Run migrations ---
const { run: runMigrations } = require("./utils/migrate");
mongoose.connection.once("open", runMigrations);

// --- Routes ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));
app.use("/api/trucks", require("./routes/truckRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/loads", require("./routes/loadRoutes"));
app.use("/api/driver-loads", require("./routes/driverLoads"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin2", require("./routes/admin2"));
app.use("/api/superadmin", require("./routes/superadminRoutes"));
app.use("/api/track", require("./routes/trackRoutes"));
const { protect: auditProtect, authorize: auditAuthorize, getAuditLogs } = require("./routes/auditRoutes");
app.get("/api/audit-logs", auditProtect, auditAuthorize("superadmin", "admin1"), getAuditLogs);
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/routes", require("./routes/routeRoutes"));
app.use("/api/maintenance", require("./routes/maintenanceRoutes"));
app.use("/api/fuel", require("./routes/fuelRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));

// --- MongoDB ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
});

// --- Global Express error handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// --- Process-level error handlers ---
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION — shutting down:", err);
  gracefulShutdown(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION — shutting down:", reason);
  gracefulShutdown(1);
});

const gracefulShutdown = (exitCode) => {
  mongoose.connection.close(false).then(() => {
    server.close(() => {
      console.log("Server shut down gracefully");
      process.exit(exitCode);
    });
  });
};

process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully");
  gracefulShutdown(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received — shutting down gracefully");
  gracefulShutdown(0);
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
=======
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fileUpload = require("express-fileupload");

dotenv.config();
const app = express();
const server = http.createServer(app);

// Routers
const usersRouter = require("./routes/users");
const driverLoadsRouter = require("./routes/driverLoads");
const admin2Routes = require("./routes/admin2");
const superadminRoutes = require("./routes/superadminRoutes");

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:3000", // local dev
  "https://tte-frontend-seven.vercel.app",
  "https://tte-frontend-git-main-foxsugarprotonmes-projects.vercel.app",
  "https://tte-frontend-m089znnx5-foxsugarprotonmes-projects.vercel.app",
];

// --- Middleware ---
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests (Postman, etc.)
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`CORS policy does not allow access from ${origin}`), false);
    }
    return callback(null, true);
  },
  credentials: true, // allow cookies / auth headers
}));

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(fileUpload());

// --- Routes ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));
app.use("/api/trucks", require("./routes/truckRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/loads", require("./routes/loadRoutes"));       // admin/general load routes
app.use("/api/driver-loads", driverLoadsRouter);            // driver-specific routes
app.use("/api/users", usersRouter);
app.use("/api/admin2", admin2Routes);
app.use("/api/superadmin", superadminRoutes);

// --- MongoDB ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

// --- Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // whitelist frontends
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

app.set("io", io);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
>>>>>>> 55959f3276306c10d1f85d755c132fda848ed0a1
