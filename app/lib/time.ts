// Human-readable relative timestamp. Clamps negative diffs (clock skew or
// future-dated entries) to "just now" so we never render "-12m ago".
export function formatTimestamp(iso: string, nowMs: number = Date.now()): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";

  const diffSec = Math.floor((nowMs - ms) / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(ms).toLocaleDateString();
}
