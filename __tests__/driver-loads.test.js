const request = require("supertest");
const express = require("express");

const queryChain = (resolveValue) => ({
  populate: jest.fn().mockReturnThis(),
  then: (onFulfilled) => Promise.resolve(resolveValue).then(onFulfilled),
  catch: (onRejected) => Promise.resolve(resolveValue).catch(onRejected),
});

jest.mock("../models/Load", () => {
  const Load = function (data) { Object.assign(this, data); };
  Load.prototype.save = jest.fn();
  Load.create = jest.fn();
  Load.findById = jest.fn();
  Load.find = jest.fn();
  Load.findByIdAndDelete = jest.fn();
  Load.findOne = jest.fn();
  Load.updateMany = jest.fn();
  Load.countDocuments = jest.fn();
  Load.populate = jest.fn();
  return Load;
});

jest.mock("../models/Driver", () => {
  const Driver = function (data) { Object.assign(this, data); };
  Driver.findOne = jest.fn();
  Driver.findByIdAndUpdate = jest.fn();
  return Driver;
});

jest.mock("../middleware/authMiddleware", () => ({
  protect: (req, res, next) => {
    req.user = { _id: "driver1", email: "driver@test.com", name: "Driver", role: "driver" };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  },
}));

jest.mock("../utils/auditLogger", () => ({
  logAction: jest.fn(),
}));

jest.mock("../utils/notify", () => ({
  notifyAdmins: jest.fn(),
  notifyAdmin2: jest.fn(),
}));

jest.mock("../utils/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() })),
}));

jest.mock("../utils/driverProfile", () => ({
  ensureDriverProfile: jest.fn(() => Promise.resolve({ _id: "driver1", email: "driver@test.com" })),
}));

jest.mock("../utils/fileUploadSafety", () => ({
  validatePODFile: jest.fn(() => ({ isValid: true, message: null })),
  createSafePODFilename: jest.fn((original) => `safe_${original}`),
}));

const driverLoadRoutes = require("../routes/driverLoads");
const Load = require("../models/Load");

const app = express();
app.use(express.json());
app.use("/api/driver-loads", driverLoadRoutes);

describe("GET /api/driver-loads/driver", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns 403 if email query does not match user", async () => {
    const res = await request(app)
      .get("/api/driver-loads/driver?email=other@test.com");
    expect(res.status).toBe(403);
  });

  it("returns 200 with loads array", async () => {
    Load.find.mockReturnValue(queryChain([
      { _id: "1", ticketNumber: "TMS-001", status: "waiting" },
    ]));

    const res = await request(app)
      .get("/api/driver-loads/driver?email=driver@test.com");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("PATCH /api/driver-loads/:id", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns 404 if load not found", async () => {
    Load.findOne.mockReturnValue(queryChain(null));

    const res = await request(app)
      .patch("/api/driver-loads/nonexistent")
      .send({ status: "in transit" });
    expect(res.status).toBe(404);
  });

  it("returns 200 on valid status transition", async () => {
    const mockLoad = {
      _id: "load123",
      driver: "driver1",
      status: "waiting",
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue(true),
    };
    Load.findOne.mockReturnValue(queryChain(mockLoad));
    Load.findById.mockReturnValue(queryChain(mockLoad));

    const res = await request(app)
      .patch("/api/driver-loads/load123")
      .send({ status: "in transit" });
    expect(res.status).toBe(200);
  });

  it("rejects invalid status transition", async () => {
    const mockLoad = {
      _id: "load123",
      driver: "driver1",
      status: "waiting",
      save: jest.fn(),
    };
    Load.findOne.mockReturnValue(queryChain(mockLoad));

    const res = await request(app)
      .patch("/api/driver-loads/load123")
      .send({ status: "completed" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/driver-loads/:id/generate-pod", () => {
  it("returns 404 if load not found", async () => {
    Load.findOne.mockReturnValue(queryChain(null));

    const res = await request(app)
      .post("/api/driver-loads/nonexistent/generate-pod");
    expect(res.status).toBe(404);
  });
});
