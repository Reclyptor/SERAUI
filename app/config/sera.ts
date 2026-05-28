// Single source of the SERA API base URL. Imported by the server-action
// client. Fails fast at boot when SERA_API_URL is missing in production so
// the server crashes early instead of silently hitting localhost.

function resolveBaseUrl(): string {
  const url = process.env.SERA_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SERA_API_URL must be set in production");
  }
  return "http://localhost:3001";
}

export const SERA_API_URL = resolveBaseUrl();
export const SERA_API_PREFIX = "/api/v1";
