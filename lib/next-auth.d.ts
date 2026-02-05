import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    // Access token stored in encrypted cookie, validated by backend against Authentik JWKS
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
