"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithAuthentik() {
  await signIn("authentik");
}

export async function signOutUser() {
  await signOut();
}
