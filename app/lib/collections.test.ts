import { describe, it, expect } from "vitest";
import { trimMap } from "./collections";

describe("trimMap", () => {
  it("returns the same reference when size <= max", () => {
    const m = new Map([["a", 1], ["b", 2]]);
    expect(trimMap(m, 2)).toBe(m);
    expect(trimMap(m, 10)).toBe(m);
  });

  it("returns a new Map with the most recent entries when over cap", () => {
    const m = new Map([["a", 1], ["b", 2], ["c", 3]]);
    const trimmed = trimMap(m, 2);
    expect(trimmed).not.toBe(m);
    expect(Array.from(trimmed.entries())).toEqual([["b", 2], ["c", 3]]);
  });

  it("preserves insertion order in the result", () => {
    const m = new Map<string, number>();
    for (let i = 1; i <= 60; i++) m.set(`k${i}`, i);
    const trimmed = trimMap(m, 50);
    const keys = Array.from(trimmed.keys());
    expect(keys[0]).toBe("k11");
    expect(keys[keys.length - 1]).toBe("k60");
    expect(trimmed.size).toBe(50);
  });

  it("trimming to exactly the cap is a no-op", () => {
    const m = new Map([["a", 1], ["b", 2]]);
    expect(trimMap(m, 2)).toBe(m);
  });

  it("handles max = 0 by emptying the map", () => {
    const m = new Map([["a", 1]]);
    const trimmed = trimMap(m, 0);
    expect(trimmed.size).toBe(0);
  });
});
