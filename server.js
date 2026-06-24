const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
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

dotenv.config();

const app = express();
const server = http.createServer(app);

// ---------------- ENV CHECK ----------------
if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error("FATAL: JWT_SECRET and MONGO_URI must be set");
  process.exit(1);
}

// ---------------- BASIC MIDDLEWARE ----------------
app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.FRONTEND_URL || "https://tte-frontend-seven.vercel.app"
  ].filter(Boolean),
  credentials: true
}));

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
  cors: {
    origin: [
      "http://localhost:3000",
      "https://tte-frontend-seven.vercel.app"
    ],
    credentials: true
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

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

// ---------------- HEALTH ----------------
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// ---------------- 404 for unknown API routes ----------------
app.use("/api/{*path}", (req, res) => {
  res.status(404).json({ message: "API route not found" });
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