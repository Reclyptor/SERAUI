import { describe, it, expect } from "vitest";
import { formatTimestamp } from "./time";

const ISO = "2026-05-27T12:00:00Z";
const NOW = new Date(ISO).getTime();

describe("formatTimestamp", () => {
  it('returns "just now" for the most recent minute', () => {
    expect(formatTimestamp(ISO, NOW)).toBe("just now");
    expect(formatTimestamp(ISO, NOW + 59_000)).toBe("just now");
  });

  it("flips to Xm ago at the 60-second boundary", () => {
    expect(formatTimestamp(ISO, NOW + 60_000)).toBe("1m ago");
    expect(formatTimestamp(ISO, NOW + 30 * 60_000)).toBe("30m ago");
  });

  it("flips to Xh ago at the 60-minute boundary", () => {
    expect(formatTimestamp(ISO, NOW + 60 * 60_000)).toBe("1h ago");
    expect(formatTimestamp(ISO, NOW + 23 * 60 * 60_000)).toBe("23h ago");
  });

  it("flips to Xd ago at the 24-hour boundary", () => {
    expect(formatTimestamp(ISO, NOW + 24 * 60 * 60_000)).toBe("1d ago");
    expect(formatTimestamp(ISO, NOW + 6 * 24 * 60 * 60_000)).toBe("6d ago");
  });

  it("falls back to localeDateString at the 7-day boundary", () => {
    const result = formatTimestamp(ISO, NOW + 7 * 24 * 60 * 60_000);
    expect(result).not.toMatch(/ago/);
    expect(result).toBeTruthy();
  });

  it('clamps future-dated entries to "just now"', () => {
    expect(formatTimestamp(ISO, NOW - 60_000)).toBe("just now");
    expect(formatTimestamp(ISO, NOW - 60 * 60_000)).toBe("just now");
  });

  it("returns empty string for invalid ISO", () => {
    expect(formatTimestamp("not-a-date", NOW)).toBe("");
  });
});
