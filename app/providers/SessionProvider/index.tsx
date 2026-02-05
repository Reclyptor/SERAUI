"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      // Refetch session periodically to trigger server-side token refresh
      // via the JWT callback. Uses GET (not update/POST) to avoid a known
      // next-auth v5 bug where update() fires the JWT callback multiple
      // times, causing refresh token rotation failures.
      refetchInterval={2 * 60}
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
