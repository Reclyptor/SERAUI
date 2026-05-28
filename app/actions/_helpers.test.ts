import { describe, it, expect } from "vitest";
import { buildSearchParams, parseErrorMessage } from "./_helpers";

describe("buildSearchParams", () => {
  it("returns empty string for an empty object", () => {
    expect(buildSearchParams({})).toBe("");
  });

  it("returns empty string when all values are nullish", () => {
    expect(buildSearchParams({ a: null, b: undefined })).toBe("");
  });

  it("prefixes a leading ?", () => {
    expect(buildSearchParams({ k: "v" })).toBe("?k=v");
  });

  it("joins multiple params with &", () => {
    const out = buildSearchParams({ a: "1", b: "2" });
    expect(out === "?a=1&b=2" || out === "?b=2&a=1").toBe(true);
  });

  it("skips null and undefined but keeps falsy primitives", () => {
    expect(buildSearchParams({ a: 0, b: false, c: "", d: null, e: undefined }))
      .toBe("?a=0&b=false&c=");
  });

  it("URL-encodes special characters", () => {
    expect(buildSearchParams({ q: "a b&c=d" })).toBe("?q=a+b%26c%3Dd");
  });

  it("coerces numbers and booleans to strings", () => {
    expect(buildSearchParams({ n: 42, b: true })).toBe("?n=42&b=true");
  });
});

describe("parseErrorMessage", () => {
  it("returns fallback + statusText for empty body", () => {
    expect(parseErrorMessage("Not Found", "", "Failed to fetch chat"))
      .toBe("Failed to fetch chat: Not Found");
  });

  it("returns body.message when JSON has a string message", () => {
    expect(parseErrorMessage("Bad Request", '{"message":"Slug already exists"}', "Failed to save prompt"))
      .toBe("Slug already exists");
  });

  it("returns raw body when JSON has no message field", () => {
    const body = '{"code":"E_NOPE"}';
    expect(parseErrorMessage("Bad Request", body, "Failed to save prompt"))
      .toBe(body);
  });

  it("returns raw body when JSON.message is not a string", () => {
    const body = '{"message":42}';
    expect(parseErrorMessage("Bad Request", body, "Failed")).toBe(body);
  });

  it("returns raw body when payload is not JSON", () => {
    expect(parseErrorMessage("Internal Server Error", "upstream timeout", "Failed"))
      .toBe("upstream timeout");
  });

  it("ignores fallback once a body is present", () => {
    expect(parseErrorMessage("X", "literal text", "Failed to do thing"))
      .toBe("literal text");
  });
});
