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
