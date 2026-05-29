import { describe, it, expect } from "vitest";
import {
  getModelBySpec,
  getModelDisplayName,
  groupModelsByProvider,
  type ModelOption,
} from "./models";

const catalog: ModelOption[] = [
  {
    spec: "anthropic/claude-haiku-4-5",
    provider: "anthropic",
    modelID: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    enabled: true,
  },
  {
    spec: "anthropic/claude-sonnet-4-6",
    provider: "anthropic",
    modelID: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    enabled: true,
  },
  {
    spec: "openai/gpt-4o",
    provider: "openai",
    modelID: "gpt-4o",
    displayName: "GPT-4o",
    enabled: true,
  },
  {
    spec: "vllm/Huihui-Qwen3.6-35B-A3B-Claude-4.7-Opus-abliterated-FP8",
    provider: "vllm",
    modelID: "Huihui-Qwen3.6-35B-A3B-Claude-4.7-Opus-abliterated-FP8",
    displayName: "Huihui Qwen 3.6 35B A3B Claude 4.7 Opus Abliterated FP8",
    enabled: true,
    contextWindow: 262_144,
  },
];

describe("getModelBySpec", () => {
  it("returns the matching ModelOption", () => {
    const m = getModelBySpec(catalog, "anthropic/claude-sonnet-4-6");
    expect(m?.spec).toBe("anthropic/claude-sonnet-4-6");
    expect(m?.provider).toBe("anthropic");
  });

  it("returns undefined for unknown specs", () => {
    expect(getModelBySpec(catalog, "nope/missing")).toBeUndefined();
  });

  it("returns undefined when catalog is empty", () => {
    expect(getModelBySpec([], "anthropic/claude-sonnet-4-6")).toBeUndefined();
  });
});

describe("getModelDisplayName", () => {
  it("returns the catalog displayName for known specs", () => {
    expect(getModelDisplayName(catalog, "anthropic/claude-haiku-4-5")).toBe(
      "Claude Haiku 4.5",
    );
  });

  it("returns null for unknown specs", () => {
    expect(getModelDisplayName(catalog, "foo/bar-baz")).toBeNull();
  });

  it("returns null for an empty catalog", () => {
    expect(
      getModelDisplayName([], "anthropic/claude-opus-4-7"),
    ).toBeNull();
  });
});

describe("groupModelsByProvider", () => {
  it("keys groups by the raw provider string", () => {
    const groups = groupModelsByProvider(catalog);
    const keys = groups.map(([key]) => key);
    expect(keys).toEqual(["anthropic", "openai", "vllm"]);
  });

  it("preserves catalog insertion order across groups", () => {
    const groups = groupModelsByProvider(catalog);
    expect(groups[0][0]).toBe(catalog[0].provider);
  });

  it("preserves model order within each group", () => {
    const groups = groupModelsByProvider(catalog);
    const anthropic = groups.find(([key]) => key === "anthropic")?.[1];
    expect(anthropic?.map((m) => m.displayName)).toEqual([
      "Claude Haiku 4.5",
      "Claude Sonnet 4.6",
    ]);
  });

  it("covers every model exactly once", () => {
    const groups = groupModelsByProvider(catalog);
    const total = groups.reduce((sum, [, models]) => sum + models.length, 0);
    expect(total).toBe(catalog.length);
  });

  it("returns an empty array for an empty catalog", () => {
    expect(groupModelsByProvider([])).toEqual([]);
  });
});
