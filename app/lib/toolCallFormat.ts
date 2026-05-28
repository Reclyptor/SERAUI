// Compact summary of a tool call's args used as the collapsed-row preview.
// A single short key/value pair is rendered inline (`key: value`); anything
// longer falls back to a pretty-printed JSON dump.
const SINGLE_PAIR_INLINE_LIMIT = 120;

export function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  if (entries.length === 1) {
    const [key, value] = entries[0];
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= SINGLE_PAIR_INLINE_LIMIT) return `${key}: ${str}`;
  }
  return JSON.stringify(args, null, 2);
}

export function formatResult(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}
