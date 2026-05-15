export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  label: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "anthropic/claude-haiku-4-5",
    name: "Haiku 4.5",
    provider: "anthropic",
    label: "Claude",
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Sonnet 4.6",
    provider: "anthropic",
    label: "Claude",
  },
  {
    id: "anthropic/claude-opus-4-7",
    name: "Opus 4.7",
    provider: "anthropic",
    label: "Claude",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    label: "ChatGPT",
  },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai", label: "ChatGPT" },
  { id: "openai/o3", name: "o3", provider: "openai", label: "ChatGPT" },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    label: "Gemini",
  },
  {
    id: "vllm/Qwen3.6-27B-FP8",
    name: "Qwen 3.6 27B FP8",
    provider: "vllm",
    label: "vLLM",
  },
  {
    id: "vllm/Huihui-Qwen3.6-27B-abliterated",
    name: "Qwen 3.6 27B Abliterated",
    provider: "vllm",
    label: "vLLM",
  },
];

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

export function getModelByID(id: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id);
}

export function getModelDisplayName(id: string): string {
  return getModelByID(id)?.name ?? id.split("/").pop() ?? id;
}

export function groupModelsByProvider(): [string, ModelOption[]][] {
  const groups = new Map<string, ModelOption[]>();
  for (const model of MODEL_OPTIONS) {
    const existing = groups.get(model.label) ?? [];
    existing.push(model);
    groups.set(model.label, existing);
  }
  return Array.from(groups.entries());
}
