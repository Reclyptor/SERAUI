"use client";

import { useSession } from "next-auth/react";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function useUser() {
  const { data: session, status } = useSession();

  const user = session?.user;
  const name = user?.name ?? "User";
  const email = user?.email ?? null;
  const image = user?.image ?? null;
  const initials = getInitials(user?.name);
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  return {
    user,
    name,
    email,
    image,
    initials,
    isLoading,
    isAuthenticated,
  };
}
