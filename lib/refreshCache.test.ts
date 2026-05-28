import { describe, it, expect, beforeEach } from "vitest";
import { isRefreshValid, RefreshCache, type RefreshResult } from "./refreshCache";

const sample = (expiresAt: number): RefreshResult => ({
  accessToken: `at-${expiresAt}`,
  refreshToken: `rt-${expiresAt}`,
  expiresAt,
});

describe("isRefreshValid", () => {
  it("returns true when well outside the buffer", () => {
    expect(isRefreshValid(2000, 1000)).toBe(true);
  });

  it("returns false at the exact buffer boundary", () => {
    expect(isRefreshValid(1120, 1000, 120)).toBe(false);
  });

  it("returns true one second outside the buffer", () => {
    expect(isRefreshValid(1121, 1000, 120)).toBe(true);
  });

  it("returns false when already expired", () => {
    expect(isRefreshValid(900, 1000)).toBe(false);
  });

  it("respects a custom buffer override", () => {
    expect(isRefreshValid(1050, 1000, 60)).toBe(false);
    expect(isRefreshValid(1100, 1000, 60)).toBe(true);
  });
});

describe("RefreshCache", () => {
  let cache: RefreshCache;

  beforeEach(() => {
    cache = new RefreshCache();
  });

  it("returns null for an unknown user", () => {
    expect(cache.getValid("alice", 1000)).toBeNull();
  });

  it("returns a cached entry while outside the buffer", () => {
    const result = sample(2000);
    cache.set("alice", result);
    expect(cache.getValid("alice", 1000)).toBe(result);
  });

  it("returns null when the cached entry is inside the buffer", () => {
    cache.set("alice", sample(1100));
    expect(cache.getValid("alice", 1000)).toBeNull();
  });

  it("isolates cache entries between users", () => {
    cache.set("alice", sample(2000));
    cache.set("bob", sample(3000));
    expect(cache.getValid("alice", 1000)?.accessToken).toBe("at-2000");
    expect(cache.getValid("bob", 1000)?.accessToken).toBe("at-3000");
  });

  it("isolates in-flight refreshes between users", async () => {
    const alicePromise = Promise.resolve(sample(2000));
    const bobPromise = Promise.resolve(sample(3000));
    cache.setInflight("alice", alicePromise);
    cache.setInflight("bob", bobPromise);

    expect(cache.getInflight("alice")).toBe(alicePromise);
    expect(cache.getInflight("bob")).toBe(bobPromise);
    expect(await cache.getInflight("alice")).toEqual(sample(2000));
  });

  it("clearInflight removes only the target user", () => {
    const alicePromise = Promise.resolve(sample(2000));
    const bobPromise = Promise.resolve(sample(3000));
    cache.setInflight("alice", alicePromise);
    cache.setInflight("bob", bobPromise);

    cache.clearInflight("alice");
    expect(cache.getInflight("alice")).toBeUndefined();
    expect(cache.getInflight("bob")).toBe(bobPromise);
  });

  it("clear removes both cached and in-flight state for one user", () => {
    cache.set("alice", sample(2000));
    cache.set("bob", sample(2000));
    cache.setInflight("alice", Promise.resolve(sample(2000)));

    cache.clear("alice");
    expect(cache.getValid("alice", 1000)).toBeNull();
    expect(cache.getInflight("alice")).toBeUndefined();
    expect(cache.getValid("bob", 1000)).not.toBeNull();
  });
});
