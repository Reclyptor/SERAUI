import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  getModelByID,
  getModelDisplayName,
  groupModelsByProvider,
} from "./models";

describe("getModelByID", () => {
  it("returns the matching ModelOption", () => {
    const m = getModelByID(DEFAULT_MODEL);
    expect(m?.id).toBe(DEFAULT_MODEL);
    expect(m?.provider).toBe("anthropic");
  });

  it("returns undefined for unknown ids", () => {
    expect(getModelByID("nope/missing")).toBeUndefined();
  });
});

describe("getModelDisplayName", () => {
  it("returns the registry name for known models", () => {
    expect(getModelDisplayName("anthropic/claude-opus-4-7")).toBe("Opus 4.7");
  });

  it("falls back to the path tail for unknown ids with a /", () => {
    expect(getModelDisplayName("foo/bar-baz")).toBe("bar-baz");
  });

  it("returns the input verbatim when there is no /", () => {
    expect(getModelDisplayName("just-a-name")).toBe("just-a-name");
  });
});

describe("groupModelsByProvider", () => {
  it("groups by label", () => {
    const groups = groupModelsByProvider();
    const labels = groups.map(([label]) => label);
    expect(labels).toContain("Claude");
    expect(labels).toContain("ChatGPT");
    expect(labels).toContain("Gemini");
    expect(labels).toContain("vLLM");
  });

  it("preserves registry insertion order across groups", () => {
    const groups = groupModelsByProvider();
    const labels = groups.map(([label]) => label);
    // First model in MODEL_OPTIONS is a Claude — Claude should be first group.
    expect(labels[0]).toBe(MODEL_OPTIONS[0].label);
  });

  it("preserves model order within each group", () => {
    const groups = groupModelsByProvider();
    const claude = groups.find(([label]) => label === "Claude")?.[1];
    expect(claude?.map((m) => m.name)).toEqual([
      "Haiku 4.5",
      "Sonnet 4.6",
      "Opus 4.7",
    ]);
  });

  it("covers every model exactly once", () => {
    const groups = groupModelsByProvider();
    const total = groups.reduce((sum, [, models]) => sum + models.length, 0);
    expect(total).toBe(MODEL_OPTIONS.length);
  });
});
