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
    req.user = { _id: "admin2", email: "admin2@test.com", name: "Admin2", role: "admin2" };
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
  notifyAdmin1: jest.fn(),
  notifyAdmin2: jest.fn(),
}));

jest.mock("../utils/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() })),
}));

const admin2Routes = require("../routes/admin2");
const Load = require("../models/Load");

const app = express();
app.use(express.json());
app.use("/api/admin2", admin2Routes);

describe("GET /api/admin2/loads", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns 200 with loads array", async () => {
    Load.find.mockReturnValue(queryChain([
      { _id: "1", ticketNumber: "TMS-001", status: "completed", isApproved: false },
    ]));

    const res = await request(app).get("/api/admin2/loads");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("PUT /api/admin2/loads/:id/approve", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns 404 if load not found", async () => {
    Load.findById.mockReturnValue(queryChain(null));

    const res = await request(app)
      .put("/api/admin2/loads/nonexistent/approve")
      .send({ note: "Looks good" });
    expect(res.status).toBe(404);
  });

  it("returns 400 if load status is not completed", async () => {
    const mockLoad = {
      _id: "load123",
      status: "waiting",
      isApproved: false,
      save: jest.fn().mockResolvedValue(true),
    };
    Load.findById.mockReturnValue(queryChain(mockLoad));

    const res = await request(app)
      .put("/api/admin2/loads/load123/approve")
      .send({ note: "Approved" });
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful approval", async () => {
    const mockLoad = {
      _id: "load123",
      status: "completed",
      isApproved: false,
      podUrl: "/uploads/test-pod.pdf",
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue(true),
    };
    Load.findById
      .mockReturnValueOnce(queryChain(mockLoad))
      .mockReturnValueOnce(queryChain({
        ...mockLoad,
        isApproved: true,
        customer: { name: "Test", email: "test@test.com" },
      }));

    const res = await request(app)
      .put("/api/admin2/loads/load123/approve")
      .send({ note: "Approved" });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/admin2/loads/:id/reject", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("returns 400 if rejection reason is missing", async () => {
    Load.findById.mockReturnValue(queryChain({
      _id: "load123",
      save: jest.fn(),
    }));

    const res = await request(app)
      .put("/api/admin2/loads/load123/reject")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful rejection", async () => {
    const mockLoad = {
      _id: "load123",
      status: "completed",
      isApproved: false,
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockResolvedValue(true),
    };
    Load.findById
      .mockReturnValueOnce(queryChain(mockLoad))
      .mockReturnValueOnce(queryChain({
        ...mockLoad,
        rejectionNote: "Missing documents",
        customer: { name: "Test", email: "test@test.com" },
      }));

    const res = await request(app)
      .put("/api/admin2/loads/load123/reject")
      .send({ reason: "Missing documents" });
    expect(res.status).toBe(200);
  });
});
