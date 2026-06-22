const request = require("supertest");

// Mock mongoose and server before requiring
jest.mock("mongoose", () => ({
  connect: jest.fn().mockResolvedValue(),
  connection: { readyState: 1, close: jest.fn().mockResolvedValue() },
  Schema: function () { this.plugin = jest.fn(); this.index = jest.fn(); this.pre = jest.fn(); this.add = jest.fn(); this.methods = {}; this.statics = {}; },
  model: jest.fn(() => ({})),
}));

const express = require("express");
const healthRoutes = require("../routes/healthRoutes");

const app = express();
app.use("/api/health", healthRoutes);

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("mongodb");
  });
});
