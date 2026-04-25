export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  label: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'anthropic/claude-haiku-4-5', name: 'Haiku 4.5', provider: 'anthropic', label: 'Claude' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Sonnet 4.6', provider: 'anthropic', label: 'Claude' },
  { id: 'anthropic/claude-opus-4-7', name: 'Opus 4.7', provider: 'anthropic', label: 'Claude' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', label: 'ChatGPT' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', label: 'ChatGPT' },
  { id: 'openai/o3', name: 'o3', provider: 'openai', label: 'ChatGPT' },
  { id: 'ollama/qwen3.6:35b-a3b-q8_0', name: 'Qwen 3.6 35B-A3B Q8', provider: 'ollama', label: 'Ollama' },
  { id: 'ollama/qwen3.6:27b-q8_0', name: 'Qwen 3.6 27B Q8', provider: 'ollama', label: 'Ollama' },
  { id: 'ollama/qwen3.6:35b-a3b-q4_K_M', name: 'Qwen 3.6 35B-A3B Q4', provider: 'ollama', label: 'Ollama' },
  { id: 'ollama/qwen3.6:27b-q4_K_M', name: 'Qwen 3.6 27B Q4', provider: 'ollama', label: 'Ollama' },
];

export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

export function getModelByID(id: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((m) => m.id === id);
}

export function getModelDisplayName(id: string): string {
  return getModelByID(id)?.name ?? id.split('/').pop() ?? id;
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
