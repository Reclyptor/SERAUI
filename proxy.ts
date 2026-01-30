import { auth } from "@/lib/auth";

export default auth((req) => {
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    return;
  }

  const isValid = req.auth?.accessToken && !req.auth?.error;

  if (!isValid) {
    return Response.redirect(new URL("/api/auth/signin", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)"],
};
