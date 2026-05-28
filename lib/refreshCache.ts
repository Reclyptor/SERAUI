export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const REFRESH_BUFFER_SECONDS = 120;

export function isRefreshValid(
  expiresAtSeconds: number,
  nowSeconds: number,
  bufferSeconds: number = REFRESH_BUFFER_SECONDS,
): boolean {
  return nowSeconds < expiresAtSeconds - bufferSeconds;
}

// Per-user refresh-token cache. Authentik rotates refresh tokens on every
// use, so concurrent requests for the same user must share one in-flight
// refresh — but two different users must NEVER share state.
export class RefreshCache {
  private cache = new Map<string, RefreshResult>();
  private inflight = new Map<string, Promise<RefreshResult>>();

  getValid(
    userKey: string,
    nowSeconds: number = Math.floor(Date.now() / 1000),
  ): RefreshResult | null {
    const entry = this.cache.get(userKey);
    if (!entry) return null;
    if (!isRefreshValid(entry.expiresAt, nowSeconds)) return null;
    return entry;
  }

  set(userKey: string, result: RefreshResult): void {
    this.cache.set(userKey, result);
  }

  getInflight(userKey: string): Promise<RefreshResult> | undefined {
    return this.inflight.get(userKey);
  }

  setInflight(userKey: string, promise: Promise<RefreshResult>): void {
    this.inflight.set(userKey, promise);
  }

  clearInflight(userKey: string): void {
    this.inflight.delete(userKey);
  }

  clear(userKey: string): void {
    this.cache.delete(userKey);
    this.inflight.delete(userKey);
  }
}

export const refreshCache = new RefreshCache();
