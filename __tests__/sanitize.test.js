const { sanitizeBody, sanitizeValue } = require("../utils/sanitize");

describe("sanitizeValue", () => {
  it("strips HTML tags", () => {
    expect(sanitizeValue("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("removes $ and {} symbols", () => {
    expect(sanitizeValue('{$ne: "admin"}')).toBe('ne: "admin"');
  });

  it("collapses whitespace", () => {
    expect(sanitizeValue("  hello   world  ")).toBe("hello world");
  });

  it("returns non-strings as-is", () => {
    expect(sanitizeValue(123)).toBe(123);
    expect(sanitizeValue(null)).toBe(null);
  });
});

describe("sanitizeBody", () => {
  it("sanitizes nested objects", () => {
    const input = { name: "<b>Bob</b>", deep: { query: '{$gt: 0}' } };
    const out = sanitizeBody(input);
    expect(out.name).toBe("Bob");
    expect(out.deep.query).toBe('gt: 0');
  });

  it("sanitizes arrays", () => {
    const input = { tags: ["<script>", "<img>"] };
    const out = sanitizeBody(input);
    expect(out.tags[0]).toBe("");
    expect(out.tags[1]).toBe("");
  });
});
