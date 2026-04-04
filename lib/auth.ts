import NextAuth from "next-auth";

// --- OIDC discovery cache ---
// The discovery document rarely changes. Cache for 1 hour to avoid a
// round-trip to Authentik on every token refresh.
let discoveryCache: { tokenEndpoint: string; expiresAt: number } | null = null;

async function getTokenEndpoint(): Promise<string> {
  if (discoveryCache && Date.now() < discoveryCache.expiresAt) {
    return discoveryCache.tokenEndpoint;
  }
  const res = await fetch(
    `${process.env.AUTHENTIK_ISSUER}/.well-known/openid-configuration`
  );
  const data = await res.json();
  discoveryCache = {
    tokenEndpoint: data.token_endpoint,
    expiresAt: Date.now() + 3_600_000,
  };
  return data.token_endpoint;
}

// --- Token refresh cache ---
// Authentik rotates refresh tokens on every use. If two requests arrive
// with the same cookie, the first refresh succeeds and rotates the token;
// the second tries the now-invalid old token and gets `invalid_grant`.
//
// To prevent this: cache the refresh result until the NEW access token
// enters the refresh window (expiresAt - 120s). Any request within that
// window reuses the cached tokens — no redundant Authentik calls, no
// rotation race.
interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let cachedRefresh: RefreshResult | null = null;
let inflightRefresh: Promise<RefreshResult> | null = null;

function getValidCache(): typeof cachedRefresh {
  if (!cachedRefresh) return null;
  if (Date.now() / 1000 >= cachedRefresh.expiresAt - 120) return null;
  return cachedRefresh;
}

async function refreshAccessToken(token: any) {
  const cached = getValidCache();
  if (cached) {
    return { ...token, ...cached };
  }

  if (inflightRefresh) {
    try {
      const result = await inflightRefresh;
      return { ...token, ...result };
    } catch {
      const fallback = getValidCache();
      if (fallback) return { ...token, ...fallback };
      throw new Error("Token refresh failed");
    }
  }

  const doRefresh = async () => {
    const tokenEndpoint = await getTokenEndpoint();

    const response = await fetch(tokenEndpoint, {
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
    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token ?? token.refreshToken) as string,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
    };
  };

  inflightRefresh = doRefresh();
  try {
    const result = await inflightRefresh;
    cachedRefresh = result;
    return { ...token, ...result };
  } catch (error) {
    // Another request path may have refreshed and cached while we failed
    const fallback = getValidCache();
    if (fallback) return { ...token, ...fallback };
    throw error;
  } finally {
    inflightRefresh = null;
  }
}

// --- NextAuth configuration ---

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
      if (account) {
        cachedRefresh = null;
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000 - 120_000) {
        return token;
      }

      console.log("[Auth] Token expired or expiring, refreshing...");
      try {
        return await refreshAccessToken(token);
      } catch {
        console.error("[Auth] Refresh failed, clearing session");
        return { ...token, accessToken: undefined, refreshToken: undefined };
      }
    },
    async session({ session, token }) {
      if (!token.accessToken) {
        session.error = "RefreshError";
      }
      if (token.expiresAt) {
        session.expiresAt = token.expiresAt as number;
      }
      return session;
    },
  },
});
