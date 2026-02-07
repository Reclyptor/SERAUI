import { NextRequest, NextResponse } from "next/server";

const SERA_API_URL = process.env.SERA_API_URL ?? "http://localhost:3001";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = pathname.replace(/^\/api\/copilotkit/, "/copilotkit");
  return NextResponse.rewrite(new URL(`${SERA_API_URL}${target}${search}`));
}

export const config = {
  matcher: "/api/copilotkit/:path*",
};
