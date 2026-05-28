import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  buildSearchParams,
  parseErrorMessage,
  type QueryValue,
} from "./_helpers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  // auth() verifies a real NextAuth session — replaces the old "any cookie
  // present means authenticated" gate that let unrelated cookies (theme,
  // csrf) pass through unauthenticated.
  const session = await auth();
  if (!session) {
    throw new UnauthorizedError();
  }
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  return {
    Cookie: all.map((c) => `${c.name}=${c.value}`).join("; "),
  };
}

export interface SeraFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  errorContext: string;
  signal?: AbortSignal;
}

export async function seraFetch<T>(
  path: string,
  options: SeraFetchOptions,
): Promise<T> {
  const headers = await authHeaders();
  const query = options.query ? buildSearchParams(options.query) : "";
  const url = `${API_BASE_URL}${API_PREFIX}${path}${query}`;
  const method = options.method ?? "GET";

  const init: RequestInit = {
    method,
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else {
      init.body = JSON.stringify(options.body);
      (init.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }
  }

  if (method === "GET") {
    init.cache = "no-store";
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      parseErrorMessage(response.statusText, text, options.errorContext),
    );
  }

  if (response.status === 204 || method === "DELETE") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
