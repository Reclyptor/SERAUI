import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const SERA_API_URL = process.env.SERA_API_URL ?? "http://localhost:3001";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Rewrite agent API calls to the backend
  if (pathname.startsWith("/api/v1/agent")) {
    const target = pathname.replace(/^\/api\/v1\/agent/, "/api/v1/agent");
    return NextResponse.rewrite(new URL(`${SERA_API_URL}${target}${search}`));
  }

  // Redirect unauthenticated users to login before any HTML is sent
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/v1/agent/:path*",
    "/((?!api/auth|_next/static|_next/image|favicon.ico|health).*)",
  ],
};
