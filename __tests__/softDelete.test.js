const mongoose = require("mongoose");
const softDelete = require("../utils/softDelete");

describe("softDelete plugin", () => {
  let schema;

  beforeEach(() => {
    schema = new mongoose.Schema({ name: String });
    softDelete(schema);
  });

  it("adds isDeleted, deletedAt, deletedBy fields", () => {
    const paths = Object.keys(schema.paths);
    expect(paths).toContain("isDeleted");
    expect(paths).toContain("deletedAt");
    expect(paths).toContain("deletedBy");
  });

  it("adds softDelete method", () => {
    expect(schema.methods.softDelete).toBeDefined();
  });

  it("adds restore method", () => {
    expect(schema.methods.restore).toBeDefined();
  });

  it("adds findNotDeleted static", () => {
    expect(schema.statics.findNotDeleted).toBeDefined();
  });
});
