import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const SERA_API_URL = process.env.SERA_API_URL ?? "http://localhost:3001";

// Use auth() as a wrapper — NOT a bare function call.
// The wrapper pattern ensures NextAuth writes the updated session cookie
// onto the response when the JWT callback refreshes tokens. Without this,
// a refreshed token stays in server memory but the browser keeps the old
// cookie, causing `invalid_grant` on the next request.
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/v1/agent")) {
    if (!req.auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.rewrite(new URL(`${SERA_API_URL}${pathname}${search}`));
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/api/v1/agent/:path*",
    "/((?!api/auth|_next/static|_next/image|favicon.ico|health).*)",
  ],
};
