import { auth } from "@/lib/auth";

export default auth((req) => {
  // Check if user is authenticated (has session) and no refresh error
  const isAuthenticated = req.auth?.user && !req.auth?.error;

  if (!isAuthenticated) {
    return Response.redirect(new URL("/api/auth/signin", req.nextUrl.origin));
  }
});

// Exclude /api/auth from the proxy entirely — NextAuth must handle its own
// endpoints without the proxy's auth() wrapper running the JWT callback first.
// If both run, the proxy refreshes the token (rotating the refresh token with
// Authentik), then the handler tries to refresh with the now-stale refresh
// token from the original request cookie, fails, and overwrites the proxy's
// good Set-Cookie with a broken session.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|api/auth).*)"],
};
