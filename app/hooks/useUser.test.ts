import { describe, it, expect } from "vitest";
import { getInitials } from "./useUser";

describe("getInitials", () => {
  it("returns ? for null, undefined, or empty", () => {
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
    expect(getInitials("")).toBe("?");
  });

  it("returns one uppercase character for a single-word name", () => {
    expect(getInitials("alice")).toBe("A");
    expect(getInitials("Alice")).toBe("A");
  });

  it("uses first and last parts for multi-word names", () => {
    expect(getInitials("alice bob")).toBe("AB");
    expect(getInitials("Alice Beatrice Carol")).toBe("AC");
  });

  it("collapses internal whitespace", () => {
    expect(getInitials("alice    bob")).toBe("AB");
    expect(getInitials("\talice\nbob ")).toBe("AB");
  });

  it("treats a whitespace-only string as a single empty part", () => {
    // trim().split(/\s+/) on "  " yields [""] — first char is "" → "".toUpperCase() === ""
    expect(getInitials("   ")).toBe("");
  });
});
