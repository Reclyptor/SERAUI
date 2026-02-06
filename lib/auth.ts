import NextAuth from "next-auth";

// Cache the last successful refresh result for 30 seconds.
// This prevents concurrent requests (e.g. page reload triggering multiple
// proxy auth() calls) from each trying to refresh the token independently.
// Authentik rotates refresh tokens, so only the first concurrent refresh
// succeeds — the rest would fail with a stale refresh token. By caching
// the result, subsequent calls within 30s reuse the already-refreshed token.
let cachedRefresh: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  time: number;
} | null = null;

// Dedup truly concurrent refresh calls sharing a single in-flight promise.
let inflightRefresh: Promise<any> | null = null;

async function refreshAccessToken(token: any) {
  // Reuse cached result if we refreshed within the last 30 seconds
  if (cachedRefresh && Date.now() - cachedRefresh.time < 30_000) {
    console.log("[Auth] Using cached refresh result");
    return {
      ...token,
      accessToken: cachedRefresh.accessToken,
      refreshToken: cachedRefresh.refreshToken,
      expiresAt: cachedRefresh.expiresAt,
    };
  }

  // If a refresh is already in flight, wait for it instead of starting another
  if (inflightRefresh) {
    console.log("[Auth] Waiting for in-flight refresh");
    const result = await inflightRefresh;
    return { ...token, ...result };
  }

  // Perform the actual refresh
  const doRefresh = async () => {
    const discoveryUrl = `${process.env.AUTHENTIK_ISSUER}/.well-known/openid-configuration`;
    const discovery = await fetch(discoveryUrl).then((r) => r.json());

    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTHENTIK_CLIENT_ID!,
        client_secret: process.env.AUTHENTIK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[Auth] Token refresh failed:", data);
      throw new Error("Token refresh failed");
    }

    console.log("[Auth] Token refreshed successfully");
    const result = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };

    // Cache for 30s to protect against subsequent concurrent requests
    cachedRefresh = { ...result, time: Date.now() };
    return result;
  };

  inflightRefresh = doRefresh();
  try {
    const result = await inflightRefresh;
    return { ...token, ...result };
  } finally {
    inflightRefresh = null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      issuer: process.env.AUTHENTIK_ISSUER,
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile offline_access",
        },
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign in - store tokens
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      // Return token if not expired (with 120s buffer)
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000 - 120000) {
        return token;
      }

      // Token expired or expiring soon - refresh it
      console.log("[Auth] Token expired or expiring, refreshing...");
      try {
        return await refreshAccessToken(token);
      } catch {
        // Refresh failed - clear tokens so user gets redirected to login
        console.error("[Auth] Refresh failed, clearing session");
        return { ...token, accessToken: undefined, refreshToken: undefined };
      }
    },
    async session({ session, token }) {
      // Don't expose tokens to client - they stay in the encrypted cookie
      // Backend extracts them by decrypting the cookie with shared AUTH_SECRET
      // Only expose error state so frontend can handle re-auth
      if (!token.accessToken) {
        session.error = "RefreshError";
      }
      // Expose token expiry so the client can show a countdown timer
      if (token.expiresAt) {
        session.expiresAt = token.expiresAt as number;
      }
      return session;
    },
  },
});
