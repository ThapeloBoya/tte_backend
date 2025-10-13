const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fileUpload = require("express-fileupload");
const usersRouter = require("./routes/users");
dotenv.config();
const app = express();
const server = http.createServer(app);
const driverLoadsRouter = require("./routes/driverLoads");
const admin2Routes = require("./routes/admin2");
const superadminRoutes = require("./routes/superadminRoutes");


// Middleware
app.use(cors({
  origin: [
    "tte-frontend-seven.vercel.app",
    "http://localhost:5173" // for local testing
  ],
  credentials: true,
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/drivers", require("./routes/driverRoutes"));
app.use("/api/trucks", require("./routes/truckRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/loads", require("./routes/loadRoutes"));       // admin/general load routes
app.use("/api/driver-loads", driverLoadsRouter);            // driver-specific routes
app.use(fileUpload());
app.use("/api/users", usersRouter);
app.use("/api/admin2", admin2Routes);
app.use("/api/superadmin", superadminRoutes);


// MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

// Socket.IO
const io = new Server(server, { cors: { origin: "*" } });
io.on("connection", socket => {
  console.log("New client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});
app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
