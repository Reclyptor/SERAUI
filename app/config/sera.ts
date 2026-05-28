// Lazy SERA base-URL resolution. Throwing at module load broke `next build`
// because Next.js evaluates server modules in production mode while collecting
// page data, and the build environment legitimately doesn't have
// SERA_API_URL set. Deferring the check to first call still fails fast at
// runtime (the first request hits this before doing anything else), but
// keeps the build itself environment-agnostic.

export const SERA_API_PREFIX = "/api/v1";

export function getSeraApiUrl(): string {
  const url = process.env.SERA_API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SERA_API_URL must be set in production");
  }
  return "http://localhost:3001";
}
