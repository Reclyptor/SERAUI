import NextAuth from "next-auth";
import { refreshCache } from "@/lib/refreshCache";

// --- OIDC discovery cache ---
// The discovery document rarely changes. Cache for 1 hour to avoid a
// round-trip to Authentik on every token refresh.
let discoveryCache: { tokenEndpoint: string; expiresAt: number } | null = null;

async function getTokenEndpoint(): Promise<string> {
  if (discoveryCache && Date.now() < discoveryCache.expiresAt) {
    return discoveryCache.tokenEndpoint;
  }
  const res = await fetch(
    `${process.env.AUTHENTIK_ISSUER}/.well-known/openid-configuration`,
  );
  const data = await res.json();
  discoveryCache = {
    tokenEndpoint: data.token_endpoint,
    expiresAt: Date.now() + 3_600_000,
  };
  return data.token_endpoint;
}

interface RefreshableToken {
  sub?: string;
  refreshToken?: string;
  [key: string]: unknown;
}

async function refreshAccessToken<T extends RefreshableToken>(
  token: T,
  userKey: string,
) {
  const cached = refreshCache.getValid(userKey);
  if (cached) {
    return { ...token, ...cached };
  }

  if (!token.refreshToken) {
    throw new Error("Missing refresh token");
  }
  const refreshToken = token.refreshToken;

  const existing = refreshCache.getInflight(userKey);
  if (existing) {
    try {
      const result = await existing;
      return { ...token, ...result };
    } catch {
      const fallback = refreshCache.getValid(userKey);
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
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[Auth] Token refresh failed");
      throw new Error("Token refresh failed");
    }

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token ?? token.refreshToken) as string,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
    };
  };

  const promise = doRefresh();
  refreshCache.setInflight(userKey, promise);
  try {
    const result = await promise;
    refreshCache.set(userKey, result);
    return { ...token, ...result };
  } catch (error) {
    const fallback = refreshCache.getValid(userKey);
    if (fallback) return { ...token, ...fallback };
    throw error;
  } finally {
    refreshCache.clearInflight(userKey);
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
        if (token.sub) refreshCache.clear(token.sub);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      const expiresAt = token.expiresAt as number | undefined;
      const refreshToken = token.refreshToken as string | undefined;

      if (expiresAt && Date.now() < expiresAt * 1000 - 120_000) {
        return token;
      }

      // Already in failed-refresh state — short-circuit so we don't loop
      // forever throwing "Missing refresh token" on every JWT callback.
      if (!refreshToken) {
        return token;
      }

      // Without a stable user key, concurrent refreshes could leak state
      // across users. Fail closed.
      if (!token.sub) {
        return {
          ...token,
          accessToken: undefined,
          refreshToken: undefined,
          expiresAt: undefined,
        };
      }

      try {
        return await refreshAccessToken(token, token.sub);
      } catch {
        console.error("[Auth] Refresh failed, clearing session");
        return {
          ...token,
          accessToken: undefined,
          refreshToken: undefined,
          expiresAt: undefined,
        };
      }
    },
    async session({ session, token }) {
      if (!token.accessToken) {
        session.error = "RefreshError";
      }
      if (token.expiresAt) {
        session.expiresAt = token.expiresAt as number;
      }
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
