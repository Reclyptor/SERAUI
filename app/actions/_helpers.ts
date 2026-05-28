// Pure helpers shared by the server-action client (`_client.ts`). Kept
// IO-free so they can be unit-tested without mocking next-auth / next/headers.

export type QueryValue = string | number | boolean | null | undefined;

export function buildSearchParams(
  params: Record<string, QueryValue>,
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    usp.set(key, String(value));
  }
  const query = usp.toString();
  return query ? `?${query}` : "";
}

// Builds a human-readable error message from a SERA error response. Body
// is read once as text by the caller (Response bodies are single-use), then
// parsed here. Prefers `body.message` when the payload is JSON; falls back
// to the raw text; finally to `${fallback}: ${statusText}`.
export function parseErrorMessage(
  statusText: string,
  body: string,
  fallback: string,
): string {
  if (!body) {
    return `${fallback}: ${statusText}`;
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
    ) {
      return (parsed as { message: string }).message;
    }
  } catch {
    // Not JSON — fall through to returning the raw text.
  }
  return body;
}
