import NextAuth from "next-auth";

async function refreshAccessToken(token: any) {
  const discoveryUrl = `${process.env.AUTHENTIK_ISSUER}/.well-known/openid-configuration`;
  const discovery = await fetch(discoveryUrl).then(r => r.json());
  
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
    throw data;
  }

  console.log("[Auth] Token refreshed successfully");
  return {
    ...token,
    accessToken: data.access_token,
    idToken: data.id_token ?? token.idToken,
    refreshToken: data.refresh_token ?? token.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    error: undefined, // Clear any previous error
  };
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
      // Initial sign in - store tokens from account
      if (account) {
        console.log("[Auth] Initial sign in, storing tokens");
        return {
          ...token,
          accessToken: account.access_token,
          idToken: account.id_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          error: undefined,
        };
      }

      // Don't attempt refresh if we already have an error (prevents loop)
      if (token.error) {
        return token;
      }

      // Return existing token if not expired (with 60s buffer)
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000 - 60000) {
        return token;
      }

      // Token is expired or about to expire, refresh it
      console.log("[Auth] Token expired or expiring soon, refreshing...");
      try {
        return await refreshAccessToken(token);
      } catch (error) {
        console.error("[Auth] Failed to refresh token:", error);
        return { ...token, error: "RefreshError" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.idToken = token.idToken as string;
      session.expiresAt = token.expiresAt as number | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});
