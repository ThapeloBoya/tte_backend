const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

jest.mock("../models/User", () => {
  const mockUser = {
    _id: "user123",
    name: "Test Admin",
    email: "admin@test.com",
    password: "hashedpass",
    role: "admin1",
    comparePassword: jest.fn(),
    save: jest.fn(),
  };
  const User = function (data) { Object.assign(this, data); };
  User.findOne = jest.fn();
  User.create = jest.fn();
  User.prototype.save = jest.fn();
  return User;
});

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "fake-jwt-token"),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(() => "hashedpass"),
  compare: jest.fn(),
}));

jest.mock("../utils/totp", () => ({
  generateSecret: jest.fn(() => "mocked-secret"),
  keyuri: jest.fn(() => "otpauth://totp/test"),
  verifyTOTP: jest.fn(() => true),
}));

jest.mock("qrcode", () => ({
  toDataURL: jest.fn(() => "data:image/png;base64,mocked"),
}));

jest.mock("../utils/auditLogger", () => ({
  logAction: jest.fn(() => Promise.resolve()),
}));

jest.mock("../utils/driverProfile", () => ({
  ensureDriverProfile: jest.fn(() => Promise.resolve()),
}));

jest.mock("../utils/notify", () => ({
  notifyAdmins: jest.fn(() => Promise.resolve()),
}));

jest.mock("../utils/email", () => ({
  sendEmail: jest.fn(() => Promise.resolve()),
}));

const User = require("../models/User");

const authRoutes = require("../routes/authRoutes");
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 if name is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@test.com", password: "123456", role: "driver" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  it("returns 400 if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test", password: "123456", role: "driver" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it("returns 400 if password is too short", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test", email: "test@test.com", password: "123", role: "driver" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  it("returns 201 on successful registration", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: "newuser",
      name: "Test",
      email: "test@test.com",
      role: "driver",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test", email: "test@test.com", password: "StrongPass1!", role: "driver" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "123456" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid credentials", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@test.com", password: "StrongPass1!" });
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful login", async () => {
    bcrypt.compare.mockResolvedValue(true);
    const mockUser = {
      _id: "user123",
      name: "Admin",
      email: "admin@test.com",
      role: "admin1",
      isActive: true,
      mfaEnabled: false,
      save: jest.fn(),
    };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "StrongPass1!" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});
