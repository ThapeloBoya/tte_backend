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
  Load.updateMany = jest.fn();
  Load.countDocuments = jest.fn();
  Load.populate = jest.fn();
  return Load;
});

jest.mock("../middleware/authMiddleware", () => ({
  protect: (req, res, next) => {
    req.user = { _id: "admin1", email: "admin1@test.com", name: "Admin1", role: "admin1" };
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

jest.mock("../utils/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../utils/notify", () => ({
  notifyDriver: jest.fn(),
  notifyAdmin2: jest.fn(),
  notifyAdmins: jest.fn(),
}));

jest.mock("../utils/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() })),
}));

const loadRoutes = require("../routes/loadRoutes");
const Load = require("../models/Load");

const app = express();
app.use(express.json());
app.use("/api/loads", loadRoutes);

describe("POST /api/loads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 if customer is missing", async () => {
    const res = await request(app)
      .post("/api/loads")
      .send({ truck: "truck1", pickupLocation: "A", deliveryLocation: "B" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/customer/i);
  });

  it("returns 400 if pickupLocation is missing", async () => {
    const res = await request(app)
      .post("/api/loads")
      .send({ customer: "cust1", truck: "truck1", deliveryLocation: "B" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pickup/i);
  });

  it("returns 201 on successful creation", async () => {
    const mockLoad = {
      _id: "load123",
      ticketNumber: "TMS-20260617-001",
      customer: "cust1",
      truck: "truck1",
      pickupLocation: "A",
      deliveryLocation: "B",
      status: "waiting",
    };
    Load.create.mockResolvedValue(mockLoad);
    const populated = {
      ...mockLoad,
      customer: { name: "Test Customer", email: "cust@test.com" },
      driver: null,
      truck: { registrationNumber: "TRK-001" },
    };
    Load.findById.mockReturnValue(queryChain(populated));

    const res = await request(app)
      .post("/api/loads")
      .send({ customer: "cust1", truck: "truck1", pickupLocation: "A", deliveryLocation: "B" });
    expect(res.status).toBe(201);
    expect(res.body.ticketNumber).toMatch(/^TMS-/);
  });
});

describe("GET /api/loads", () => {
  it("returns 200 with array of loads", async () => {
    const loads = [
      { _id: "1", ticketNumber: "TMS-001", status: "waiting" },
    ];
    Load.find.mockReturnValue(queryChain(loads));

    const res = await request(app).get("/api/loads");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("PUT /api/loads/:id", () => {
  it("returns 404 if load not found", async () => {
    Load.findById.mockReturnValue(queryChain(null));

    const res = await request(app)
      .put("/api/loads/nonexistent")
      .send({ status: "in transit" });
    expect(res.status).toBe(404);
  });

  it("returns 200 on successful update", async () => {
    const mockLoad = {
      _id: "load123",
      ticketNumber: "TMS-001",
      status: "waiting",
      save: jest.fn().mockResolvedValue(true),
    };
    Load.findById
      .mockReturnValueOnce(queryChain(mockLoad))
      .mockReturnValueOnce(queryChain(mockLoad));

    const res = await request(app)
      .put("/api/loads/load123")
      .send({ status: "assigned" });
    expect(res.status).toBe(200);
  });

  it("rejects invalid status", async () => {
    const mockLoad = {
      _id: "load123",
      ticketNumber: "TMS-001",
      status: "waiting",
      save: jest.fn().mockResolvedValue(true),
    };
    Load.findById
      .mockReturnValueOnce(queryChain(mockLoad))
      .mockReturnValueOnce(queryChain(mockLoad));

    const res = await request(app)
      .put("/api/loads/load123")
      .send({ status: "invalid_status" });
    expect(res.status).toBe(400);
  });
});
