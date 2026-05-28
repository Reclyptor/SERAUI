import { describe, it, expect } from "vitest";
import { formatArgs, formatResult } from "./toolCallFormat";

describe("formatArgs", () => {
  it("returns empty string for an empty object", () => {
    expect(formatArgs({})).toBe("");
  });

  it("inlines a single short string pair as 'key: value'", () => {
    expect(formatArgs({ query: "weather" })).toBe("query: weather");
  });

  it("inlines a single non-string pair via JSON.stringify", () => {
    expect(formatArgs({ count: 42 })).toBe("count: 42");
    expect(formatArgs({ enabled: true })).toBe("enabled: true");
    expect(formatArgs({ items: [1, 2] })).toBe("items: [1,2]");
  });

  it("falls back to pretty JSON when the single string value exceeds 120 chars", () => {
    const long = "a".repeat(121);
    const result = formatArgs({ query: long });
    expect(result).toContain('"query"');
    expect(result).toContain("\n");
  });

  it("falls back to pretty JSON for multi-key objects", () => {
    const result = formatArgs({ a: 1, b: 2 });
    expect(result).toContain('"a": 1');
    expect(result).toContain("\n");
  });

  it("respects the 120-char boundary inclusively", () => {
    const exact = "x".repeat(120);
    expect(formatArgs({ q: exact })).toBe(`q: ${exact}`);
  });
});

describe("formatResult", () => {
  it("returns empty string for null and undefined", () => {
    expect(formatResult(null)).toBe("");
    expect(formatResult(undefined)).toBe("");
  });

  it("returns the string verbatim for string inputs", () => {
    expect(formatResult("plain text")).toBe("plain text");
  });

  it("pretty-prints objects", () => {
    const result = formatResult({ a: 1 });
    expect(result).toContain('"a": 1');
    expect(result).toContain("\n");
  });

  it("pretty-prints arrays", () => {
    const result = formatResult([1, 2, 3]);
    expect(result).toBe("[\n  1,\n  2,\n  3\n]");
  });

  it("coerces numbers and booleans via JSON.stringify", () => {
    expect(formatResult(42)).toBe("42");
    expect(formatResult(true)).toBe("true");
  });
});
