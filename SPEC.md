# SERAUI Application Specification

> **Version:** 1.0
> **Last Updated:** 2026-05-14
> **Source of Truth** for routing, authentication, state management, streaming, and component behavior.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Environment & Configuration](#2-environment--configuration)
3. [Routing & Navigation](#3-routing--navigation)
4. [Authentication](#4-authentication)
5. [Backend Proxy](#5-backend-proxy)
6. [Server Actions](#6-server-actions)
7. [Provider Tree](#7-provider-tree)
8. [Contexts](#8-contexts)
9. [Hooks](#9-hooks)
10. [Streaming & Event Handling](#10-streaming--event-handling)
11. [Component Catalog](#11-component-catalog)
12. [Models](#12-models)
13. [Attachment Handling](#13-attachment-handling)
14. [Styling & Theming](#14-styling--theming)
15. [Build & Deployment](#15-build--deployment)

---

## 1. System Overview

SERAUI is the Next.js frontend for the SERA agentic AI platform. It renders the chat interface, manages user authentication against Authentik (OIDC), proxies agent API calls to the SERA backend, and consumes server-sent agent events to render thinking, text, tool calls, subagents, and confirmation prompts in real time.

| Component              | Framework          | Role                       |
| ---------------------- | ------------------ | -------------------------- |
| **SERA**               | NestJS (Node.js)   | Backend API server         |
| **SERAUI** (this spec) | Next.js            | Frontend web application   |
| **SERAEX**             | Temporal (Node.js) | Background workflow worker |

### Runtime

- **Language:** TypeScript (target ES2017, module ESNext, JSX react-jsx, bundler resolution, `strict: true`)
- **Framework:** Next.js 16.1 (App Router)
- **UI Library:** React 19.2
- **Auth:** `next-auth` v5 beta (Auth.js) with Authentik OIDC provider
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`), `@tailwindcss/typography`, custom theme via `@theme inline`
- **Markdown:** `react-markdown` with `remark-gfm`, `remark-breaks`, and `rehype-highlight` (`github-dark-dimmed` theme)
- **Icons:** `lucide-react` plus a small in-house SVG icon set in `app/components/Icons`
- **Class utility:** `clsx`
- **Streaming:** Native `EventSource` (SSE) for agent events
- **Build output:** `output: "standalone"` (Docker-friendly self-contained server)
- **Default port:** 3000

### File Layout

```
/
+-- proxy.ts              # Next.js Proxy (formerly middleware) — protects routes, rewrites /api/v1/agent/* to SERA
+-- next.config.ts        # Next config (output: standalone)
+-- next-env.d.ts         # Next type references
+-- eslint.config.mjs     # Flat config: next core-web-vitals + next/typescript
+-- postcss.config.mjs    # @tailwindcss/postcss plugin
+-- tsconfig.json         # ES2017 target, bundler resolution, "@/*" path alias
+-- Dockerfile            # 3-stage build (deps -> builder -> production on node:22-alpine)
+-- lib/                  # Server-only library code outside the App Router tree
|   +-- auth.ts           # NextAuth config + OIDC discovery cache + refresh cache
|   +-- auth-actions.ts   # signInWithAuthentik / signOutUser server actions
|   +-- next-auth.d.ts    # Module augmentation for Session / JWT types
+-- public/               # Static assets (sera.png, favicon, etc.)
+-- app/                  # Next.js App Router root
    +-- layout.tsx        # Root HTML, fonts, theme color, top-level providers
    +-- page.tsx          # `/` route: redirects to `/new`
    +-- globals.css       # Tailwind import, theme tokens, scrollbar styles, keyframes
    +-- favicon.ico
    +-- api/
    |   +-- auth/[...nextauth]/route.ts  # NextAuth GET/POST handlers
    +-- health/
    |   +-- route.ts                     # GET /health -> { status: "ok" }
    +-- (chat)/                          # Route group — applies sidebar layout
    |   +-- layout.tsx                   # Sidebar + main flex container
    |   +-- new/page.tsx                 # Welcome view (no chatID)
    |   +-- chat/[chatID]/page.tsx       # Existing chat (server-loaded)
    |   +-- manage/page.tsx              # Tabbed Manage page (prompts | skills | memories | agents | heartbeats | crons)
    +-- actions/                         # Server actions ("use server")
    |   +-- chat.ts                      # Chat CRUD + image upload
    |   +-- prompts.ts                   # Prompt CRUD
    |   +-- skills.ts                    # Skill CRUD
    |   +-- memories.ts                  # Memory list/delete
    |   +-- agents.ts                    # Agent CRUD
    |   +-- heartbeats.ts                # Heartbeat config CRUD
    |   +-- crons.ts                     # Cron job CRUD
    +-- providers/                       # React provider components
    |   +-- SessionProvider/index.tsx    # Wraps next-auth/react SessionProvider
    |   +-- AuthProvider/index.tsx       # Redirect on unauth / refresh error; mounts ImageCacheProvider
    +-- contexts/                        # React contexts
    |   +-- ChatContext/index.tsx        # Recent chats list, refreshChats, sessionId, startNewChat
    |   +-- ImageCacheContext/index.tsx  # In-memory preview cache (max 50 entries)
    +-- hooks/                           # Client hooks
    |   +-- useAgentChat.ts              # Core streaming + state machine
    |   +-- useSessionTimer.ts           # Live countdown to session expiry
    |   +-- useUser.ts                   # Convenience wrapper over useSession()
    +-- lib/                             # Client-safe shared library code
    |   +-- models.ts                    # Model registry, defaults, grouping helpers
    +-- components/                      # All UI components (each in `<Name>/index.tsx`)
        +-- AgentsPanel
        +-- ChatContainer
        +-- ChatMessage
        +-- ConfirmationCard
        +-- CronsPanel
        +-- HeartbeatsPanel
        +-- IconButton
        +-- Icons
        +-- ImageThumbnail
        +-- ImageUploadInput
        +-- Markdown
        +-- ModelSelector
        +-- MemoriesPanel
        +-- PromptsPanel
        +-- SeraChat
        +-- Sidebar
        +-- SkillsPanel
        +-- SubagentMessage
        +-- ThinkingMessage
        +-- ToolCallMessage
        +-- WelcomeView
```

### Path Alias

`tsconfig.json` maps `@/*` to `./*` (repo root). Imports such as `@/lib/auth`, `@/app/actions/chat`, and `@/app/lib/models` are used throughout.

---

## 2. Environment & Configuration

### Required Variables

| Variable                  | Description                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`             | Secret used by Auth.js to sign/encrypt the session cookie (HKDF-derived A256CBC-HS512 by Auth.js) |
| `AUTHENTIK_ISSUER`        | OIDC issuer URL (e.g., `https://auth.example.com/application/o/sera/`)                            |
| `AUTHENTIK_CLIENT_ID`     | Authentik OIDC client ID                                                                          |
| `AUTHENTIK_CLIENT_SECRET` | Authentik OIDC client secret                                                                      |
| `SERA_API_URL`            | Base URL of the SERA backend (default `http://localhost:3001`)                                    |

### Optional Variables

| Variable                  | Default   | Description                                                              |
| ------------------------- | --------- | ------------------------------------------------------------------------ |
| `PORT`                    | `3000`    | Server listen port                                                       |
| `AUTH_TRUST_HOST`         | _(unset)_ | Required behind a reverse proxy so Auth.js trusts forwarded host headers |
| `AUTH_URL`                | _(unset)_ | Canonical origin used to construct callback URLs                         |
| `NEXT_TELEMETRY_DISABLED` | _(unset)_ | Set to `1`/`true` to opt out of Next.js telemetry                        |

### Build-time Behavior

The root layout (`app/layout.tsx`) declares `export const dynamic = "force-dynamic"`. This forces every page through dynamic rendering at runtime so that environment variables (`SERA_API_URL`, `AUTHENTIK_*`) are read on each request rather than baked into the static build.

---

## 3. Routing & Navigation

SERAUI uses the App Router. All authenticated UI lives under the `(chat)` route group so the sidebar layout is shared.

| Path                      | Source                                | Auth     | Notes                                                                                           |
| ------------------------- | ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `/`                       | `app/page.tsx`                        | Required | Server component; calls `redirect("/new")`                                                      |
| `/new`                    | `app/(chat)/new/page.tsx`             | Required | Client component; mounts `<ChatContainer chatID={null} initialMessages={[]} />`                 |
| `/chat/[chatID]`          | `app/(chat)/chat/[chatID]/page.tsx`   | Required | Server component; awaits `params`, server-fetches via `getChat`, redirects to `/new` on failure |
| `/manage`                 | `app/(chat)/manage/page.tsx`          | Required | Client component; reads `?tab=` query (`prompts` \| `skills` \| `memories` \| `agents` \| `heartbeats` \| `crons`), defaults to `prompts` |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | Public   | Re-exports `GET` and `POST` from `lib/auth` `handlers`                                          |
| `/health`                 | `app/health/route.ts`                 | Public   | `GET` only; returns `{ status: "ok" }` JSON                                                     |

### Route Group Layout

`app/(chat)/layout.tsx` is a `"use client"` layout that renders:

```tsx
<div className="flex h-screen w-full bg-background">
  <Sidebar />
  <main className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-[48px]">
    {children}
  </main>
</div>
```

The `ml-[48px]` offset accommodates the mobile sidebar's collapsed footprint; at `lg` and above the sidebar sits inline and `ml-0` removes the offset.

### Manage Tabs

`/manage` renders a `<Suspense>` boundary (required because the page reads `useSearchParams`) around a tab strip that updates the URL via `router.replace`. Recognized tabs: `prompts` (default), `skills`, `memories`, `agents`, `heartbeats`, `crons`. The active tab is validated against the `TABS` tuple — any unrecognized value falls back to `prompts`. The render dispatches via a `Record<Tab, React.ComponentType>` table (`PANELS`) rather than a chained ternary, so adding a tab requires editing two co-located constants.

### Post-send Navigation

When the user sends the first message on `/new`, the chat ID arrives on the SSE handshake (`POST /agent/chat` response). After the run completes, `SeraChat` rewrites the URL in place via `window.history.replaceState(null, "", `/chat/${activeChatID}`)` (no client navigation, no remount).

---

## 4. Authentication

### Provider

Single OIDC provider declared in `lib/auth.ts`:

```ts
{
  id: "authentik",
  name: "Authentik",
  type: "oidc",
  issuer: process.env.AUTHENTIK_ISSUER,
  clientId: process.env.AUTHENTIK_CLIENT_ID,
  clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
  authorization: { params: { scope: "openid email profile offline_access" } },
}
```

`offline_access` is requested so that Authentik returns a refresh token alongside the access token.

### Session & JWT Shape

Module augmentation in `lib/next-auth.d.ts`:

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    error?: string; // "RefreshError" when refresh fails
    expiresAt?: number; // Unix seconds when the access token expires
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // Unix seconds
  }
}
```

The access token is **not** sent to the client. It is stored inside the encrypted JWT session cookie and forwarded to SERA only via server-side cookie passthrough (see [Backend Proxy](#5-backend-proxy)).

### JWT Callback

On first sign-in, the `account` argument is populated. The callback clears the user's cached refresh entry (keyed by `token.sub`) and stores `accessToken`, `refreshToken`, and `expiresAt` on the JWT.

On subsequent requests:

- If `expiresAt * 1000 - 120_000 > Date.now()` (more than 2 minutes of life remaining), the token is returned unchanged.
- If `refreshToken` is missing, the token is returned unchanged. This short-circuits the JWT callback when refresh has already failed and avoids a per-request "Missing refresh token" loop. The session callback sees the cleared `accessToken` and surfaces `session.error = "RefreshError"`.
- If `token.sub` is missing, the callback clears `accessToken`, `refreshToken`, and `expiresAt` and fails closed — without a stable user key the per-user refresh cache cannot guarantee isolation.
- Otherwise the callback invokes `refreshAccessToken(token, token.sub)`. If refresh fails, `accessToken`, `refreshToken`, **and `expiresAt`** are all cleared so the next callback hits the early-return above. The session callback then sets `session.error = "RefreshError"` so the client can react.

### Session Callback

`session({ session, token })` sets:

- `session.error = "RefreshError"` whenever `token.accessToken` is missing.
- `session.expiresAt = token.expiresAt` so the UI can render a live countdown.
- `session.user.id = token.sub` (the Authentik subject claim) so consumers can identify the user.

### OIDC Discovery Cache

`getTokenEndpoint()` caches `token_endpoint` from `${AUTHENTIK_ISSUER}/.well-known/openid-configuration` in module memory for 1 hour (`3_600_000` ms). Avoids a discovery round trip on every refresh.

### Token Refresh Cache (Race-condition Guard)

Authentik rotates refresh tokens on every use. To avoid double-refresh races when concurrent requests arrive for the **same user**, `lib/refreshCache.ts` exports a `RefreshCache` class with **per-user** state keyed by the JWT `sub` claim:

| Method                          | Purpose                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `getValid(userKey, now?)`       | Returns the cached `{ accessToken, refreshToken, expiresAt }` for this user only while outside the 120s buffer; `null` otherwise. |
| `set(userKey, result)`          | Stores a successful refresh result for this user.                                      |
| `getInflight(userKey)`          | Returns the in-flight refresh promise for this user (so concurrent callers join it instead of double-refreshing). |
| `setInflight(userKey, promise)` | Registers an in-flight refresh for this user.                                          |
| `clearInflight(userKey)`        | Removes only the in-flight entry for this user.                                        |
| `clear(userKey)`                | Removes both cached and in-flight entries for this user (used on fresh sign-in).       |

Keying by `sub` is essential: a single module-scoped cache would leak one user's tokens onto another user's JWT under concurrent traffic. The pure helper `isRefreshValid(expiresAtSeconds, nowSeconds, bufferSeconds = 120)` is exported alongside the class and unit-tested in `lib/refreshCache.test.ts`. If a concurrent refresh is in flight for the same user, callers await it; on failure they retry against any newly-cached result before throwing.

### Sign-in / Sign-out

`Sidebar` invokes `signOut({ callbackUrl: "/api/auth/signin" })` from `next-auth/react` directly (client-side) and lets the NextAuth signin route handler render the initial sign-in page. There are no server-side wrappers — the previous `lib/auth-actions.ts` was unused and has been removed.

### Client-side Reauth

`AuthProvider` triggers a hard navigation to `/api/auth/signin` when either:

- `useSession().status === "unauthenticated"`, or
- `session.error === "RefreshError"`.

A `useRef` guard (`reauthTriggered`) prevents the redirect from firing more than once per session. The component returns `null` while redirecting so child trees never see an unauthenticated state.

### Periodic Session Refetch

`SessionProvider` configures `next-auth/react`'s `SessionProvider` with:

- `refetchInterval={2 * 60}` (120 seconds)
- `refetchOnWindowFocus={true}`

The 2-minute cadence pairs with the 2-minute pre-expiry refresh window in `lib/auth.ts` so the JWT callback rotates the access token before it actually expires. The comment in source explicitly avoids `update()` due to a known next-auth v5 bug that fires the JWT callback multiple times and breaks refresh-token rotation.

---

## 5. Backend Proxy

`proxy.ts` at the repo root is the Next.js 16 proxy (the successor to `middleware.ts`). It wraps the matcher with the `auth()` higher-order function so that token refreshes written into the session cookie by the JWT callback land on the response.

```ts
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/v1/agent")) {
    if (!req.auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.rewrite(new URL(`${SERA_API_URL}${pathname}${search}`));
  }

  if (!req.auth)
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/api/v1/agent/:path*",
    "/((?!api/auth|_next/static|_next/image|favicon.ico|health).*)",
  ],
};
```

| Path Pattern                                                           | Behavior                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/api/v1/agent/:path*`                                                 | Unauthenticated → 401 JSON; otherwise rewritten to `${SERA_API_URL}${pathname}${search}` |
| `/api/auth/*`, `_next/static`, `_next/image`, `favicon.ico`, `/health` | Excluded — pass straight through to the framework or route handler                       |
| Everything else                                                        | Unauthenticated → 302 to `/api/auth/signin?callbackUrl=<original>`; authenticated → continue |

### Why `auth()` Wraps the Proxy

The leading comment in `proxy.ts` notes that calling `auth()` as a wrapper (rather than `await auth()` inside the function body) is mandatory: only the wrapper pattern ensures NextAuth writes the refreshed session cookie back onto the response. Without it, a refreshed token lives in server memory while the browser keeps the old cookie, producing `invalid_grant` on the next refresh attempt.

### Cookie Passthrough

When the proxy rewrites a request to `${SERA_API_URL}/...`, the original `Cookie` header travels with it. SERA's `SessionAuthGuard` decrypts the same session cookie (using the shared `AUTH_SECRET`), validates the embedded access token against Authentik's JWKS, and attaches the resulting `SessionUser` to its request.

---

## 6. Server Actions

All server actions live under `app/actions/*` and start with `"use server"`. They route every call through a single shared client in `app/actions/_client.ts`:

```ts
seraFetch<T>(path: string, options: {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;             // FormData passes through untouched
  query?: Record<string, QueryValue>;
  errorContext: string;       // "Failed to fetch chats"
  signal?: AbortSignal;
}): Promise<T>
```

`seraFetch`:

1. Calls `auth()` and throws `UnauthorizedError("Not authenticated")` if there is no NextAuth session. This replaces the old "any cookie present means authenticated" check, which allowed unrelated cookies (theme, csrf) to pass the gate.
2. Forwards every cookie via `Cookie:` so SERA's `SessionAuthGuard` can decrypt and validate the session token.
3. Hits `${getSeraApiUrl()}${SERA_API_PREFIX}${path}${query}`. The base URL is resolved lazily inside `app/config/sera.ts` so module load stays environment-agnostic (important during `next build`, which evaluates server modules in production mode). The first server-action call in production throws if `SERA_API_URL` is unset, which fails fast at runtime startup without breaking the build. The query string is built with `buildSearchParams` (URL-encoded, nullish values skipped).
4. Sets `cache: "no-store"` for GETs.
5. JSON-stringifies plain-object bodies and sets `Content-Type: application/json`. `FormData` bodies pass through so the runtime can set the multipart boundary itself.
6. On non-OK responses, reads the body once and runs it through `parseErrorMessage(statusText, body, errorContext)`, which prefers `body.message` when the payload is JSON, falls back to the raw text, then to `${errorContext}: ${statusText}`. This unified format applies to **every** action, including `uploadAttachment`.
7. Returns `undefined` for `204 No Content` and `DELETE` responses; otherwise parses JSON into `T`.

Pure helpers (`buildSearchParams`, `parseErrorMessage`) live in `app/actions/_helpers.ts` and are unit-tested in `app/actions/_helpers.test.ts`.

### 6.1 `app/actions/chat.ts`

Types exported (also consumed by `useAgentChat` and message components):

```ts
interface SubagentMeta {
  runID: string;
  threadID: string;
  agentID: string;
  goal: string;
}
interface ToolCallBlock {
  toolCallID: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: "started" | "executing" | "completed" | "failed";
  isSubagent?: boolean;
  subagentMeta?: SubagentMeta;
}
interface Attachment {
  id: string;
  kind: "image" | "file";
  mimeType: string;
  size: number;
  filename?: string;
  createdAt: string;
}
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  toolCalls?: ToolCallBlock[];
  attachments?: Attachment[];
  createdAt?: string | Date; // SERA serializes stored dates as ISO strings; local optimistic messages use Date
}
interface Chat {
  _id: string;
  userID: string;
  title: string;
  model?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
interface ChatListItem {
  _id: string;
  userID: string;
  title: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}
```

| Action                                   | Method | SERA endpoint               | Used by                             |
| ---------------------------------------- | ------ | --------------------------- | ----------------------------------- |
| `getChats(): ChatListItem[]`             | GET    | `/api/v1/chats`             | `ChatContext.refreshChats`          |
| `getChat(chatID): Chat`                  | GET    | `/api/v1/chats/:id`         | `app/(chat)/chat/[chatID]/page.tsx` |
| `uploadAttachment(formData): Attachment` | POST   | `/api/v1/agent/attachments` | `ImageUploadInput`                  |

Note: `uploadAttachment` is invoked as a server action with cookie forwarding directly to SERA, not via the browser proxy rewrite. The multipart field name is `file`. The UI stores returned image attachment IDs alongside local previews, while durable bytes are fetched from `/api/v1/agent/attachments/:id/content` on reload.

### 6.2 `app/actions/prompts.ts`

```ts
interface PromptListItem {
  slug: string;
  extends?: string;
  seedHash?: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
interface PromptDetail {
  slug: string;
  extends?: string;
  seedHash?: string;
  content: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

| Action                                 | Method | SERA endpoint           | Used by        |
| -------------------------------------- | ------ | ----------------------- | -------------- |
| `listPrompts(): PromptListItem[]`      | GET    | `/api/v1/prompts`       | `PromptsPanel` |
| `getPrompt(slug): PromptDetail`        | GET    | `/api/v1/prompts/:slug` | `PromptsPanel` |
| `savePrompt(slug, data): PromptDetail` | PUT    | `/api/v1/prompts/:slug` | `PromptsPanel` |

`savePrompt` body shape: `{ content: string; extends?: string; description?: string; metadata?: Record<string, unknown> }`. Slug is URL-encoded.

### 6.3 `app/actions/skills.ts`

```ts
interface SkillListItem {
  name: string;
  description: string;
  status: "active" | "stale" | "archived";
  allowedTools: string[];
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}
interface SkillFile {
  path: string;
  content: string;
}
interface SkillDetail {
  name: string;
  description: string;
  content: string;
  license?: string;
  compatibility?: string;
  allowedTools: string[];
  metadata: Record<string, unknown>;
  files: SkillFile[];
  seedHash?: string;
  origin?: "seed" | "agent" | "user";
  absorbedInto?: string;
  status: "active" | "stale" | "archived";
  lastUsedAt?: string;
  usageCount: number;
  curatorNotes?: string;
  createdAt: string;
  updatedAt: string;
}
```

| Action                               | Method | SERA endpoint          | Used by       |
| ------------------------------------ | ------ | ---------------------- | ------------- |
| `listSkills(): SkillListItem[]`      | GET    | `/api/v1/skills`       | `SkillsPanel` |
| `getSkill(name): SkillDetail`        | GET    | `/api/v1/skills/:name` | `SkillsPanel` |
| `saveSkill(name, data): SkillDetail` | PUT    | `/api/v1/skills/:name` | `SkillsPanel` |

`saveSkill` body shape: `{ content?: string; description?: string; allowedTools?: string[]; metadata?: Record<string, unknown> }`. Name is URL-encoded.

### 6.4 `app/actions/memories.ts`

```ts
interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

| Action                          | Method | SERA endpoint          | Used by         |
| ------------------------------- | ------ | ---------------------- | --------------- |
| `listMemories(): MemoryEntry[]` | GET    | `/api/v1/memories`     | `MemoriesPanel` |
| `deleteMemory(id): void`        | DELETE | `/api/v1/memories/:id` | `MemoriesPanel` |

No create/update action exists — memories are populated by the agent (manually via `save_memory` or automatically via Mem0's `extractAndStore`). Manual editing would invalidate the stored embedding, so the UI is read + delete only.

### 6.5 `app/actions/agents.ts`

```ts
interface ToolPolicy { mode: "allow" | "deny"; tools: string[] }
interface ModelOptions { preferredProvider?, preferredModel?, maxOutputTokens?, temperature? }
interface MessagingPolicy { enabled: boolean; allowedAgents: string[] }
interface SandboxConfig { enabled, image, memoryMb, cpuShares, networkEnabled, envVars }
interface AgentConfig {
  agentID; name; description; promptSlug?; modelOptions?;
  toolPolicy; messagingPolicy; sandboxConfig?; enabled;
  createdAt; updatedAt;
}
```

| Action                                       | Method | SERA endpoint              | Used by       |
| -------------------------------------------- | ------ | -------------------------- | ------------- |
| `listAgents(): AgentConfig[]`                | GET    | `/api/v1/agents`           | `AgentsPanel` |
| `getAgent(agentID): AgentConfig`             | GET    | `/api/v1/agents/:agentID`  | `AgentsPanel` |
| `createAgent(input): AgentConfig`            | POST   | `/api/v1/agents`           | `AgentsPanel` |
| `saveAgent(agentID, input): AgentConfig`     | PUT    | `/api/v1/agents/:agentID`  | `AgentsPanel` |
| `deleteAgent(agentID): void`                 | DELETE | `/api/v1/agents/:agentID`  | `AgentsPanel` |

Agent bindings (`/api/v1/agents/bindings/*`) are exposed by the backend but not wired into the Manage UI in this iteration.

### 6.6 `app/actions/heartbeats.ts`

```ts
interface ActiveHours { start: number; end: number; timezone?: string }
interface HeartbeatConfig {
  agentID; enabled; intervalMinutes; activeHours?;
  checklist: string[]; maxTokens;
  lastRunAt?; nextRunAt?; createdAt; updatedAt;
}
```

| Action                                                | Method | SERA endpoint                  | Used by           |
| ----------------------------------------------------- | ------ | ------------------------------ | ----------------- |
| `listHeartbeats(): HeartbeatConfig[]`                 | GET    | `/api/v1/heartbeats`           | `HeartbeatsPanel` |
| `getHeartbeat(agentID): HeartbeatConfig`              | GET    | `/api/v1/heartbeats/:agentID`  | `HeartbeatsPanel` |
| `createHeartbeat(input): HeartbeatConfig`             | POST   | `/api/v1/heartbeats`           | `HeartbeatsPanel` |
| `saveHeartbeat(agentID, input): HeartbeatConfig`      | PUT    | `/api/v1/heartbeats/:agentID`  | `HeartbeatsPanel` |
| `deleteHeartbeat(agentID): void`                      | DELETE | `/api/v1/heartbeats/:agentID`  | `HeartbeatsPanel` |

`agentID` is the immutable key (one heartbeat per agent — schema has `unique: true`).

### 6.7 `app/actions/crons.ts`

```ts
interface CronJob {
  jobID; agentID; schedule; command; description;
  enabled; script; contextFromJobID; lastRunID;
  lastRunAt?; nextRunAt?; createdAt; updatedAt;
}
```

| Action                                | Method | SERA endpoint           | Used by      |
| ------------------------------------- | ------ | ----------------------- | ------------ |
| `listCrons(agentID?): CronJob[]`      | GET    | `/api/v1/crons`         | `CronsPanel` |
| `getCron(jobID): CronJob`             | GET    | `/api/v1/crons/:jobID`  | `CronsPanel` |
| `createCron(input): CronJob`          | POST   | `/api/v1/crons`         | `CronsPanel` |
| `saveCron(jobID, input): CronJob`     | PUT    | `/api/v1/crons/:jobID`  | `CronsPanel` |
| `deleteCron(jobID): void`             | DELETE | `/api/v1/crons/:jobID`  | `CronsPanel` |

`listCrons` forwards the optional `agentID` filter as a query param. `jobID` is a UUID minted server-side on create — clients only supply `agentID`, `schedule`, `command`, and optional fields.

---

## 7. Provider Tree

`app/layout.tsx` declares the global provider stack:

```
<html lang="en" class="dark">
  <body class="${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground">
    <SessionProvider>            # next-auth/react SessionProvider (refetchInterval: 120s)
      <AuthProvider>             # Reauth guard + ImageCacheProvider
        <ChatProvider>           # Recent chats + sessionId
          {children}
```

Notable layout details:

- The root `<html>` is hard-coded with `className="dark"`. There is no theme switcher.
- `viewport.themeColor` is `#1a1915` (matches the dark background).
- `metadata`: `{ title: "SERA", description: "AI Assistant" }`.
- Geist Sans and Geist Mono are loaded via `next/font/google`, exposed as CSS custom properties `--font-geist-sans` and `--font-geist-mono`, and consumed by `globals.css` `@theme inline`.

### 7.1 `SessionProvider`

Thin wrapper around `next-auth/react`'s `SessionProvider`. Configures `refetchInterval={2 * 60}` and `refetchOnWindowFocus={true}`. The 2-minute interval is intentionally less than the access-token lifetime minus the 2-minute pre-expiry guard so the JWT callback triggers refresh in time. Uses GET-based refetch only (no `update()` calls) because of the documented v5 beta double-firing bug.

### 7.2 `AuthProvider`

Renders `null` while the redirect is in flight, otherwise renders its children inside `ImageCacheProvider`. Effects:

1. **Reauth effect:** if `status === "unauthenticated"` or `session.error === "RefreshError"`, set `reauthTriggered.current = true` and call `window.location.replace("/api/auth/signin")`. Skipped while already on `/api/auth/*` to avoid loops.
2. **Reset effect:** when `status === "authenticated"` and there is no refresh error, clear `reauthTriggered.current` so a future expiry can re-trigger.

---

## 8. Contexts

### 8.1 `ChatContext` (`app/contexts/ChatContext/index.tsx`)

Mounted at the root layout. Exposes:

```ts
interface ChatContextValue {
  recentChats: ChatListItem[];
  isLoading: boolean;
  error: string | null;
  refreshChats: () => Promise<void>;
  sessionId: string; // Randomized per "New chat" click; used as React `key`
  startNewChat: () => void; // Mints a fresh sessionId
}
```

Behavior:

- On mount, `isLoading` starts as `true`; an effect schedules `refreshChats()` (which invokes the `getChats` server action) and clears `isLoading` after the initial refresh settles.
- `sessionId` is initialized lazily via `useState(() => crypto.randomUUID())`. Clicking "New chat" calls `startNewChat()` to regenerate it, which forces `SeraChat` to remount and wipe its internal `useAgentChat` state.
- Errors are surfaced as `"Failed to load chats"` and logged via `console.error`.

Consumers: `ChatContainer`, `SeraChat`, `Sidebar`.

### 8.2 `ImageCacheContext` (`app/contexts/ImageCacheContext/index.tsx`)

Mounted inside `AuthProvider`. Exposes:

```ts
interface ImageCacheContextType {
  addImage: (id: string, preview: string, mimeType: string) => void;
  getImage: (id: string) => CachedImage | undefined;
  enforceImageCap: () => void;
}
```

Storage is a `Map<string, CachedImage>` held in `useState`, mirrored to an `imagesRef` (synced in an effect) so `getImage` reads the latest map even when called from a callback that closed over an older `images`. All three callbacks are wrapped in `useCallback` and the context value in `useMemo`, so consumer memoization isn't busted on every provider render.

`enforceImageCap()` is a memory ceiling, not a TTL — it delegates to `trimMap(prev, 50)` from `app/lib/collections.ts`, which keeps the most recently inserted 50 entries by insertion order. `trimMap` is unit-tested in `app/lib/collections.test.ts` (the test surfaced a `slice(-0)` bug — `length - max` is used instead). Throws if used outside the provider.

Consumers: `ImageUploadInput` (writes image previews on send, calls `enforceImageCap` after batch upload) and `ChatMessage` user variant (reads previews when rendering image attachments).

---

## 9. Hooks

### 9.1 `useUser` (`app/hooks/useUser.ts`)

Wraps `next-auth/react`'s `useSession()`. Returns:

```ts
{
  user,                  // session.user object (or undefined)
  name: string,          // user.name ?? "User"
  email: string | null,  // user.email ?? null
  image: string | null,  // user.image ?? null
  initials: string,      // First letter of first + last whitespace-split name parts, uppercased; "?" if no name
  isLoading: boolean,    // status === "loading"
  isAuthenticated: boolean, // status === "authenticated"
  expiresAt: number | null, // Forwarded from session.expiresAt
}
```

`getInitials` collapses on internal whitespace and returns a single character if only one name part is present.

### 9.2 `useSessionTimer(expiresAt: number | null)`

Maintains a live `secondsLeft` countdown derived from `expiresAt - now`, where `now` comes from `useSyncExternalStore` over a 1-second `setInterval`. Returns `{ secondsLeft, formatted }`:

- `formatTimeLeft(seconds)` formats `H:MM:SS` if `seconds >= 3600`, else `M:SS`. Clamps to `0:00` on non-positive input.
- `secondsLeft` and `formatted` are `null` when `expiresAt` is `null`.
- The subscription is managed by `useSyncExternalStore`, so `now` is read outside render (React-blessed pattern for wall-clock sources) and never goes stale when `expiresAt` populates after mount.
- SSR snapshot is `0`; consumers gate on `expiresAt !== null` so the placeholder never reaches the DOM.

Consumer: `Sidebar` (renders next to the Log out button).

### 9.3 `useAgentChat` (`app/hooks/useAgentChat.ts`)

The streaming state machine for a single chat. **The single largest module in the UI.**

```ts
interface UseAgentChatOptions {
  initialMessages?: Message[];
  chatID?: string | null;
  threadID?: string;
  initialModel?: string;
}

interface UseAgentChatReturn {
  messages: Message[];
  isLoading: boolean;
  chatID: string | null;
  threadID: string | null;
  runID: string | null;
  model: string | null;
  setModel: (model: string) => void;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  stopGeneration: () => void;
  queue: string[]; // Display labels for pending user messages
  dismissFromQueue: (index: number) => void;
  pendingConfirmations: PendingConfirmation[];
  resolveConfirmation: (
    confirmationID: string,
    approved: boolean,
    feedback?: string,
  ) => Promise<void>;
}

interface PendingConfirmation {
  confirmationID: string;
  actionName: string;
  args: Record<string, unknown>;
  message: string;
  threadID: string;
}
```

Constants:

- `API_BASE = "/api/v1/agent"` — every request is routed through the proxy to SERA.

#### State Initialization

- `model` is seeded from `options.initialModel` if provided. Otherwise an effect reads `localStorage["sera:lastModel"]` and adopts it if the model id is still in the registry; otherwise the stored value is removed and `model` stays `null`.
- `setModel(value)` writes through to `localStorage["sera:lastModel"]`.

#### Chat-switch Reset

A `prevChatIDRef` tracks the last seen `options.chatID`. The effect is keyed **only** on `options.chatID` (and `cleanup`); `initialMessages` / `threadID` / `initialModel` are read off an `optionsRef` mirror so a parent re-render that hands in a fresh array reference doesn't re-trigger the reset.

When `options.chatID` actually changes, the hook:

1. Calls `cleanup()` — closes the `EventSource`, clears the reconnect timer, aborts the in-flight `POST /chat` (if any), and zeroes the resume cursor.
2. Resets `streamStateRef` to `emptyStreamState()` and clears `assistantIdRef`.
3. Resets `messages` to `optionsRef.current.initialMessages ?? []`.
4. Resets `chatID`, `threadID`, `runID`, `isLoading`, `queue`, `pendingConfirmations`.
5. Clears `sendingRef` and `reconnectingRef`.
6. If `optionsRef.current.initialModel` is set, adopts it.

This effect is what makes navigation from `/chat/A` → `/chat/B` cleanly load B's history.

#### Send Flow

1. If content is empty and there are no attachments, return.
2. If a send is already in flight (`sendingRef.current`), push `{ content, attachments }` onto the internal queue and return. The returned `queue` array maps those entries to display text only.
3. Mark sending, append an optimistic user message with `attachments`, set `isLoading = true`.
4. `POST ${API_BASE}/chat` with body `{ message, attachmentIDs, chatID?, threadID?, model? }`.
5. Read `{ runID, threadID, chatID }` from the JSON response. Store all three.
6. Append a blank assistant message with a new id (`crypto.randomUUID()`).
7. Call `subscribeToStream(newRunID)`.

On `AbortError`, the catch path silently returns. Any other error logs and resets `isLoading`.

#### Stream Subscription

`subscribeToStream(streamRunID, mode: "fresh" | "reconnect-mount" | "resume" = "fresh")` resets the single `streamStateRef: AgentStreamState` (or seeds it from the live confirmations for `resume`), opens `new EventSource(buildStreamURL(streamRunID, cursor))`, and routes events:

- `replay.done` triggers `flushReplay()`, which paints the accumulated state in one batch.
- `error` events are logged via `console.warn` (otherwise ignored — see §10.2).
- All other events are dispatched through `reduceAgentEvent(streamStateRef.current, event, { mode, nowMs })`, the pure reducer in `app/lib/agentEvents.ts`. The reducer returns a new `AgentStreamState`; the hook stores it in `streamStateRef` and (in live mode only) projects it onto the assistant message via `streamStateToMessagePatch`. When `state.terminal` transitions from `null` to set, the hook calls `finishRun()` (close socket, clear loading, clear sending/reconnecting flags) — **without** zeroing the resume cursor, since the run is over.

`buildStreamURL(runID, cursor)` returns `/api/v1/agent/stream/<runID>` for a fresh subscription, or `/api/v1/agent/stream/<runID>?last-event-id=<cursor>` when resuming. Both `runID` and `cursor` are URL-encoded.

Every dispatched event updates `lastEventIDRef.current = event.streamID` if `streamID` is present. This cursor is what subsequent reconnect attempts use to resume without replaying from the start.

On `onmessage`, the hook also clears `reconnectAttemptsRef.current = 0` — the first successful message after a transient drop tells us connectivity is healthy again.

Malformed JSON is dropped with a `console.warn`.

#### Resume-on-Error

`onerror` does NOT immediately tear down. Instead it follows this state machine:

1. Close the current `EventSource`.
2. If the run already ended (`replayTerminalRef.current` is set, or the most recent dispatched event was terminal), give up and clear `isLoading`.
3. If `reconnectAttemptsRef.current >= MAX_RECONNECTS` (5), give up and clear `isLoading`.
4. Otherwise, schedule a retry via `setTimeout` with delay `Math.min(500 * 2 ** attempt, 8000)` (500ms → 1s → 2s → 4s → 8s, capped). Increment `reconnectAttemptsRef.current`.
5. On retry fire, reopen `new EventSource(${API_BASE}/stream/${streamRunID}?last-event-id=${lastEventIDRef.current ?? '0'})` with `replay = true`. The query-param form is required because `EventSource` does not allow custom headers.

Reconnect uses `replay = true` semantics: events arriving before the next `replay.done` accumulate in refs rather than mutating React state directly, then `flushReplay()` paints the missed delta in one render pass. This holds even if the server's replay buffer is empty (cursor past end-of-stream) — the server emits `replay.done` immediately and the tail resumes.

The retry timer is held in `reconnectTimerRef` and cleared by `cleanup()`, `stopGeneration()`, and the chat-switch reset effect, so navigating away or cancelling abandons the retry cleanly.

Terminal events (`run.completed` / `run.failed` / `run.cancelled`) reset both `reconnectAttemptsRef` and `lastEventIDRef` to their initial values.

#### Replay vs. Live Mode

`replayingRef.current` distinguishes a fresh run (`false`) from a reconnect-during-stream replay (`true`). The pure reducer takes `mode: "live" | "replay"` and behaves identically except for two timing choices:

- Thinking duration uses `Date.now()` in live mode and `event.timestamp` in replay mode, so a replayed thinking block reports the original wall-clock duration.
- In **live mode**, after each reducer call the hook patches the assistant message via `updateAssistantMessage(streamStateToMessagePatch(next))` and (if changed) updates `pendingConfirmations`.
- In **replay mode**, the hook only updates `streamStateRef`; no React state writes until `replay.done` arrives. `flushReplay()` then paints the entire accumulated state in one batch and, if a terminal event was captured in `state.terminal`, calls `finishRun()`.

This keeps the screen from flickering while SSE replays the entire run history on reconnect.

#### Reconnect-on-Mount

When the hook mounts with `options.chatID` set and is not currently sending or reconnecting:

1. `GET ${API_BASE}/active-run/${options.chatID}` (SERA returns `{ runID, threadID }` if a run is still active, or 404).
2. If a run is found and the request was not cancelled mid-flight: set `reconnectingRef = true`, set `runID`/`threadID`, append a blank assistant placeholder, and call `subscribeToStream(runID, true)`.

#### Confirmations

`resolveConfirmation(confirmationID, approved, feedback?)` POSTs to `${API_BASE}/confirm/${threadID}/${confirmationID}` with `{ approved, feedback }`. The matching entry is removed from `pendingConfirmations` only when SERA returns `{ resolved: true }`. The server is also expected to broadcast a `confirmation.resolved` event, which the event handler dedupes against.

#### Queue Drain

An effect monitors `!isLoading && queue.length > 0 && !sendingRef.current`. It shifts the head of the internal queue and re-invokes `sendMessage(next.content, next.attachments)`. `dismissFromQueue(index)` removes a single entry by index.

#### Stop Generation

`stopGeneration()` issues `POST ${API_BASE}/cancel/${runID}` (fire-and-forget, `.catch(() => {})`), clears `sendingRef`, closes the EventSource via `cleanup()`, and sets `isLoading = false`. The SSE is closed synchronously by the UI, so the UI does not wait for a terminal event from SERA — any subsequent backend events are dropped. If the user later reconnects to that run, `run.cancelled` is handled as a terminal event. SERA marks the run as `cancelled` server-side (see SERA SPEC §6 Cancellation).

---

## 10. Streaming & Event Handling

### 10.1 Event Envelope

Events arriving over SSE are JSON strings parsed into:

```ts
interface AgentEvent {
  type: string;
  runID: string;
  threadID: string;
  timestamp: number;
  data: unknown;
  streamID?: string;
}
```

`streamID` is sent by SERA for replay/reconnection ordering. The hook stores the most recent `streamID` in `lastEventIDRef` and supplies it as `?last-event-id=<streamID>` on every resume attempt (see §9.3 Resume-on-Error). It is not otherwise used by UI state updates.

SSE comment lines (`: ping <epoch>\n\n`) sent by SERA every 15s during idle stretches are absorbed silently by the browser's `EventSource` and never reach `onmessage`; they exist only to keep the socket warm.

### 10.2 Handled Event Types

| Event                   | Replay-aware              | UI effect (live mode)                                                                                            |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `thinking.delta`        | Yes                       | Appends to `thinking` on the assistant message; starts the thinking timer on first delta.                        |
| `thinking.done`         | Yes                       | Replaces `thinking` with final content (if non-empty), sets `thinkingDuration` in seconds.                       |
| `text.delta`            | Yes                       | Appends to assistant `content`.                                                                                  |
| `text.done`             | Yes                       | Replaces assistant `content` with final string if non-empty.                                                     |
| `run.completed`         | Captured for replay flush | Backfills `content` from `data.response` if streaming missed it; clears `isLoading`; closes SSE.                 |
| `run.failed`            | Captured for replay flush | If the assistant has no content, writes `Error: <error>` as the content; clears `isLoading`; closes.             |
| `run.cancelled`         | Captured for replay flush | If the assistant has no content, writes the cancellation reason or `Run cancelled.`; clears `isLoading`; closes. |
| `confirmation.required` | Yes                       | Pushes onto `pendingConfirmations` (or `replayConfirmationsRef` during replay).                                  |
| `approval.requested`    | Yes                       | Alias for `confirmation.required` — tool-layer gating (`exec`, `shell`, `process`, `code_execution`, `cluster_git`, `kubectl`) fires this against the same durable confirmation store. Reducer dedupes by `confirmationID` if both channels emit. |
| `confirmation.resolved` | Yes                       | Removes the matching confirmation entry.                                                                         |
| `approval.resolved`     | Yes                       | Alias for `confirmation.resolved` — the backend fires both on a transition (SERA SPEC §12), so the reducer is idempotent on missing IDs. |
| `approval.expired`      | Yes                       | Tool-layer approval timed out; remove the matching entry like `confirmation.resolved`.                           |
| `tool_call.started`     | Yes                       | Appends a `ToolCallBlock { status: "started" }` to the assistant's `toolCalls`.                                  |
| `tool_call.executing`   | Yes                       | Flips that tool call's `status` to `"executing"`.                                                                |
| `tool_call.result`      | Yes                       | Sets `status: "completed"` and stores `result`.                                                                  |
| `tool_call.error`       | Yes                       | Sets `status: "failed"` and stores `error`.                                                                      |
| `subagent.spawned`      | Yes                       | Marks the matching tool call `isSubagent: true` and attaches `subagentMeta`.                                     |
| `replay.done`           | N/A                       | Triggers `flushReplay()`.                                                                                        |

The hook explicitly receives but ignores: `subagent.completed`, `subagent.failed`, `plan.created`, `plan.step_updated`, `evaluation.done`. The `error` event is also ignored by the reducer but the hook emits `console.warn("[useAgentChat] Server error event:", data)` so production debugging isn't blind. These events are still recorded by SERA and may be consumed in a future UI revision.

### 10.3 Thinking Duration

`thinking.delta` starts a wall-clock timer on the first delta (using `Date.now()` in live mode, `event.timestamp` in replay mode). On `thinking.done` the reducer computes `computeThinkingDuration(start, end)` = `Math.max(1, Math.round((end - start) / 1000))` and stores it as `thinkingDuration`. The `Math.max(1, ...)` ensures a sub-second thinking block renders as `Thought for 1s` instead of the previous `Thought for 0s`.

### 10.4 Assistant Message Identity

A fresh `assistantIdRef.current = crypto.randomUUID()` is generated:

- Before appending the blank assistant message in `sendMessage`.
- Before appending the placeholder during reconnect.

`updateAssistantMessage(patch)` matches by this id, leaving all other messages unchanged.

---

## 11. Component Catalog

Each component lives at `app/components/<Name>/index.tsx`. All are client components unless noted; SSR is not used for any UI component (chat pages do SSR data fetch in their route file, then mount the client tree).

### 11.1 `ChatContainer`

Pass-through wrapper. Pulls `sessionId` from `ChatContext` and uses it as the `key` for `<SeraChat>`, which forces a full remount when "New chat" is clicked from the sidebar.

Props: `{ chatID: string | null; initialMessages: Message[]; initialModel?: string }`.

### 11.2 `SeraChat`

The chat surface. Wires `useAgentChat` to the message list, input, confirmations, and queue chips.

Props: `{ chatID, initialMessages, initialModel? }`.

Behaviors:

- **Empty `/new` state:** renders `<WelcomeView>` only when `chatID === null && messages.length === 0`. When the first user message is sent, the empty state is replaced by the normal scroll-view because `messages` is no longer empty.
- **Pending indicator:** if the run is loading and the last message is the user's, renders an extra blank assistant `<ChatMessage>` with `isLoading=true` to show a "Thinking…" stub before the assistant streams in.
- **Latest-assistant marker:** computes `lastAssistantIndex` via `findLastIndex` so `ChatMessage` can pass `isLatestAssistant` only to the bottom-most assistant message. This drives auto-collapsing of historical thinking/tool blocks.
- **URL rewrite + sidebar refresh:** a `prevLoadingRef` detects the `true → false` transition. On completion, if the page was originally `/new` (`!chatID`), the run yielded an `activeChatID`, and `hasNavigatedRef.current` is still false, the URL is updated via `window.history.replaceState(null, "", `/chat/${activeChatID}`)` (no navigation) and `hasNavigatedRef.current` is set so the rewrite fires exactly once. Either way, `refreshChats()` is invoked so the sidebar's recents update.
- **Auto-scroll:** a `scrollRef` is set to `scrollHeight` on every `messages`, `isLoading`, or `pendingConfirmations` change.

### 11.3 `ChatMessage`

Routes by lowercased role:

- `user` → `UserMessage`
- `assistant` → `AssistantMessage`
- anything else → `null` (system messages are not rendered)

#### `UserMessage`

- Renders `message.attachments` separately from `message.content`; text is not parsed for attachment markers.
- Image attachments render as `<ImageThumbnail size="lg">`. Cached local previews are preferred, otherwise the thumbnail source is `/api/v1/agent/attachments/:id/content`.
- Non-image file attachments render as authenticated links to `/api/v1/agent/attachments/:id/content`.

#### `AssistantMessage`

Hands content + thinking + tool calls to `<ThinkingMessage>`. Renders `<ToolCallMessage>` for normal tool calls and `<SubagentMessage>` for tool calls flagged `isSubagent`.

### 11.4 `ThinkingMessage`

Renders three things in document order:

1. A collapsible thinking panel.
2. Any `children` (the tool-call block).
3. The assistant's main response (`Markdown`).

Streaming behavior:

- **`useCharStream`** — drives the thinking panel. While thinking is in progress, a `requestAnimationFrame` loop appends one character per frame to a `<span>` via `node.textContent` (avoiding React re-renders for every keystroke). When `thinkingDuration` becomes defined, the full string is written in one shot.
- **`useProgressiveReveal`** — drives the response text. While `isLoading` is `true`, reveals characters in chunks sized `Math.max(1, Math.ceil(behind / 6))` no faster than every 30 ms. When loading ends, it snaps to the full content.
- **Streaming caret** — when streaming, an inline `<style>` injects CSS that appends a pulsing `▎` block to the last leaf in the rendered Markdown (paragraphs, lists, blockquotes, code blocks, table cells). Animation: `pulse 0.8s steps(1) infinite`, color `var(--color-accent)`.

Collapse behavior:

- Thinking panel auto-collapses when `thinkingDuration` is set AND this message is not the latest assistant (`isLatest`). A user toggle stores a manual collapse override that takes precedence over derived auto-collapse.
- Label: `Thought for {n}s` when complete, `Thinking...` (animate-pulse) while streaming.
- If there is no thinking and no content yet but the run is loading, renders a single `Thinking...` placeholder.

### 11.5 `ToolCallMessage`

Renders a tool call as a single-line summary with an expandable detail strip. Status mapping:

| Status                | Visual                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| `started`/`executing` | Pulsing accent-colored dot; tool name pulses; left border bright accent. |
| `completed`           | Static muted dot; left border muted.                                     |
| `failed`              | Static muted dot; red `failed` chip after the tool name.                 |

Auto-collapses when complete unless this message is the latest. A manual collapse override takes precedence after the user toggles the detail strip.

Args/result/error formatting:

- Single-key args under 120 chars render as `key: value`.
- Otherwise `JSON.stringify(args, null, 2)`.
- Result: passthrough string, otherwise `JSON.stringify(result, null, 2)`.
- Each strip has its own scroll caps: args `max-h-[120px]`, results `max-h-[200px]`, errors `max-h-[120px]`.

### 11.6 `SubagentMessage`

Same collapse/state pattern as `ToolCallMessage`, with an `AgentIcon` marker. Shows the subagent's `goal` (from `subagentMeta`) and, if present, the tool result and any error. Adds a `done` chip on completion and `failed` chip on failure.

### 11.7 `ConfirmationCard`

Renders a single `PendingConfirmation`. Layout:

- Accent-colored alert icon, the `actionName` label, then `message`.
- "Approve" (primary accent button), "Reject" (border-only neutral), "Add feedback" link.
- When "Add feedback" is clicked, reveals a `<textarea>` for free-text feedback.
- Both buttons disable while `resolving` is true and call `onResolve(confirmationID, approved, feedback?)` (feedback is trimmed; empty becomes `undefined`).

The cards are rendered after the message list in `SeraChat`, so they appear inline with the conversation flow.

### 11.8 `ImageUploadInput`

The "live" input bar. Props:

```ts
{
  inProgress: boolean;
  onSend: (text: string) => Promise<void>;
  onStop?: () => void;
  queue: string[];
  onDismissFromQueue: (index: number) => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}
```

Features:

- **Drag & drop and file picker** — accepts arbitrary files up to 25 MB. Image files get local data-URL previews; non-image files render as compact filename chips.
- **Upload sequencing** — on send, every selected file is uploaded **concurrently** to SERA via `uploadAttachment`. Returned `Attachment` objects are passed to `useAgentChat.sendMessage`, and image previews are registered with `ImageCacheContext.addImage(attachment.id, preview, mimeType)`.
- **Attachment IDs** — uploaded attachment IDs are sent in the chat request body as `attachmentIDs`; they are not embedded into message text.
- **Queue display** — when `queue.length > 0`, a stack of "Queued: ..." chips with per-row dismiss buttons appears above the input.
- **Stop vs send** — when `inProgress` is true, both stop (red) and send (accent) buttons are visible; send becomes "Queue message" semantically.
- **Drop zone** — `isDragging` adds a dashed accent ring around the input and a centered "Drop files here" overlay.
- **Textarea autosize** — `onInput` resizes height to `min(scrollHeight, 200px)`. Enter sends; Shift+Enter inserts a newline.
- **Placeholders** — `"Drop files here..."` when dragging, `"Uploading files..."` when uploading, `"Queue a message..."` when `inProgress`, otherwise `"Reply..."`.
- **Autofocus** — the textarea is `autoFocus`.

### 11.9 `WelcomeView`

Empty-state input. Form-based (`<form onSubmit>`); Enter submits unless shift-held. No image upload (the paperclip-like ImageIcon button is a static button with `type="button"` and no click handler — it is currently a UI placeholder). Includes a `ModelSelector`.

Layout: `pt-[32vh]` pushes the greeting and input down to roughly the upper third of the viewport, matching standard "Hello, how can I help?" empty-state aesthetics.

### 11.10 `ModelSelector`

Drop-up menu anchored to the model name. Props: `{ selectedModel, onModelChange, disabled? }`. Behaviors:

- Groups via `groupModelsByProvider()` (label-based grouping, see [Models](#12-models)).
- Closes on outside click via a `mousedown` document listener.
- Active model row is accent-colored and uses `bg-accent-muted`.

### 11.11 `Sidebar`

Collapsible navigation column. Top-level state:

- `isCollapsed` — drives the container width (`48px` collapsed, `287px` expanded).
- `contentCollapsed` — switches the inner layout to icon-only mode. Set asynchronously so the width animation completes before content collapses (avoids text reflow during animation).

Transition: `width 300ms cubic-bezier(0.2, 0, 0, 1)`. The end handler distinguishes the property and target so child transitions don't cause spurious updates.

Two `<aside>` elements are mounted: a desktop one (`hidden lg:flex`, inline in layout) and a mobile one (`lg:hidden fixed left-0 top-0 z-40`). Both render identical `SidebarContent` so collapsed/expanded behavior is consistent across breakpoints.

Nav items:

- **New chat** — `startNewChat()` then `router.push("/new")`.
- **Search** — no handler.
- **Chats** — no handler.
- **Manage** — `router.push("/manage")`. `isActive` when `pathname.startsWith("/manage")`.

Recents list:

- Only rendered when expanded and `recentChats.length > 0`. Reads from `useChat()`.
- Active chat (derived from the URL via `pathname.match(/^\/chat\/(.+)/)`) is highlighted.
- Clicks call `router.push(/chat/${id})` (skipping if it matches the current chat).

User profile dropdown:

- Click toggles `isUserMenuOpen`. Outside click closes it (mousedown listener).
- Drop-up panel uses a grid-row-template-rows animation (`grid-rows-[0fr]` → `grid-rows-[1fr]`) for height animation without `max-height` hacks.
- The Log out row shows the live session timer via `useSessionTimer(expiresAt)` next to the LogOut icon; placeholder is `"--:--"`.
- Auto-closes when the sidebar collapses.

### 11.12 `PromptsPanel`

Thin `ManagePanel` wrapper (see §11.14a) configured without `create` or `delete` on the `resource` — only `list` / `get` / `save`. Per-resource bits:

- **Row** — `slug`, optional `description`, optional `extends X` annotation.
- **Editor** — single full-height monospace `<textarea>` bound to `draft.content`. `extends`, `description`, and `metadata` are preserved unchanged through save.

### 11.13 `SkillsPanel`

Thin `ManagePanel` wrapper without `create` / `delete`. Per-resource bits:

- **Row** — name, colored status chip (`active` green / `stale` yellow / `archived` muted), description, optional `tools: …` summary.
- **Editor** — `Field` description input + full-height monospace content `<textarea>`. The selected skill's bundled files render as read-only chips (paths only — content is not editable here).

### 11.14 `MemoriesPanel`

List-only panel — does NOT use `ManagePanel` because its delete UX (inline two-step confirm appearing on row hover) is structurally different from the master/detail shell. Local state: `memories`, `loading`, `error`, `confirmingId`, `deletingId`.

- **List** — each `MemoryRow` shows the full memory content (whitespace-preserved, wrapped), a relative timestamp via `formatTimestamp` in `app/lib/time.ts` (`just now` / `Nm` / `Nh` / `Nd ago`, falling back to `toLocaleDateString()` past a week; future-dated entries clamp to `just now`), and every tag rendered as a small chip. Header shows a count next to the title once loaded.
- **Delete** — trash icon appears on row hover. First click moves the row into `confirmingId` state, swapping the trash for a red check (confirm) + neutral X (cancel). Confirming sets `deletingId`, calls `deleteMemory`, and optimistically removes the row from local state. The check icon turns into a spinner during the in-flight delete.
- No create/edit affordances — memory content lives as an embedding in Qdrant; editing the text without re-embedding would desync the vector from the source.
- Empty state: "No memories found". Errors render as a red banner above the list.

### 11.14a `ManagePanel` (shared shell)

All six manage panels render through one generic `<ManagePanel<TItem, TDraft, TCreate, TUpdate>>` at `app/components/ManagePanel/index.tsx`. The shell owns:

- State: `items`, `selected`, `draft`, `isCreating`, `loading`, `saving`, `error`.
- Handlers: `load`, `handleSelect` (race-safe via a `selectTokenRef` so a slow earlier `get` can't overwrite the user's newer pick), `handleNew`, `handleReset`, `handleSave`, `handleDelete`, `handleBack`.
- `isDirty` derived from a memoized `JSON.stringify(draftToUpdate(toDraft(selected)))` baseline (re-derives only when `selected` changes).
- Header (back / title / count / `New`), error banner, list / loading / empty / editor switch, `EditorActions` footer (Delete / Reset / Save).
- Exported helpers `Field`, `Section`, `Toggle`, `inputClass` for per-resource `renderEditor` callbacks.

Each consumer panel passes:

```ts
<ManagePanel<TItem, TDraft, TCreate, TUpdate>
  resource={{ list, get, create?, save, delete? }}
  getKey={(item) => item.id}
  newDraft={() => /* fresh nested objects, never a shared constant */}
  toDraft={(item) => /* server shape -> editor draft */}
  draftToUpdate={(draft) => /* editor draft -> update payload */}
  draftToCreate={(draft) => /* editor draft -> create payload */}
  validateCreate={(draft) => "agentID required" | null}
  labels={{ singular, plural, newTitle, deleteConfirm? }}
  renderRow={(item) => /* list row JSX */}
  renderEditor={({ draft, setDraft, isCreating, selected }) => /* form JSX */}
/>
```

Save and delete refresh the list **outside** the save try/catch, so a list-refresh failure surfaces as "Saved, but failed to refresh …" instead of being mis-reported as "Failed to save".

### 11.15 `AgentsPanel`

Thin `ManagePanel` wrapper (see §11.14a). Per-resource bits:

- **Draft factory** returns fresh nested objects each `New` click — `toolPolicy.tools`, `messagingPolicy.allowedAgents`, `sandboxConfig.envVars` are never shared between drafts.
- **Row** — name, enabled/disabled chip, `agentID` annotation, optional description, optional `model: provider/model` summary.
- **Editor sections** — top fields (name, description, promptSlug, enabled), **Model Options** (preferredProvider/preferredModel/maxOutputTokens/temperature), **Tool Policy** (allow/deny select + comma-separated tools), **Messaging Policy** (toggle + comma-separated allowedAgents), **Sandbox** (toggle, image, memoryMb, cpuShares, networkEnabled).
- Editor exposes the `agentID` input only while creating; once saved, the ID is immutable and disappears from the form.

### 11.16 `HeartbeatsPanel`

Thin `ManagePanel` wrapper. Per-resource bits:

- **Row** — `agentID`, enabled chip, summary line `every Nm · N checklist items · next <localized timestamp>`.
- **Editor sections** — top fields (enabled, intervalMinutes, maxTokens), **Active Hours** (toggle reveals start/end/timezone — start/end are 0–23 ints; draft values persist when the toggle is off so re-enabling restores them), **Checklist** (multi-line textarea split on `\n`, trimmed, blanks dropped).
- `draft.hasActiveHours` is a UI-only field that controls whether `activeHours` is sent in the update payload — `undefined` when off, the full object when on.
- `agentID` is the immutable key (one heartbeat per agent — schema unique index).

### 11.17 `CronsPanel`

Thin `ManagePanel` wrapper. Per-resource bits:

- **Row** — `description` (or `jobID` fallback), enabled chip, mono-spaced `schedule · agentID`, optional `next: <localized timestamp>`. `editorTitle` shows `description || jobID` in the editor header.
- **Editor** — `agentID` editable while creating, disabled afterward (backend update DTO has no `agentID` field). Other fields: description, enabled, schedule, command, script, contextFromJobID. Read-only **Run history** section (rendered from `selected`, not `draft`) shows `lastRunAt`, `nextRunAt`, `lastRunID`.
- `jobID` is server-minted (UUID) — never shown as an editable field in the create form.

### 11.18 `Markdown`

Renders Markdown via `ReactMarkdown` with:

- `remarkPlugins`: `[remarkGfm, remarkBreaks]` — GitHub-flavored Markdown plus line-break preservation.
- `rehypePlugins`: `[rehypeHighlight]` — `highlight.js`-based syntax highlighting; CSS imported once from `highlight.js/styles/github-dark-dimmed.css`.
- Default `className` chain: `prose prose-invert prose-sm` with custom `prose-*` overrides for spacing, code color (`#a4c639`, the accent), links (accent, underline-on-hover), code-block backgrounds (`#2d2a27`), and blockquote border (accent).
- The `className` prop overrides the default entirely.

### 11.19 `IconButton`

Reusable icon button with `size: "sm" | "md"` (32×32 / 40×40) and variants:

| Variant   | Style                                                   |
| --------- | ------------------------------------------------------- |
| `default` | `bg-background-secondary` border, foreground-muted icon |
| `ghost`   | Transparent, foreground-muted icon, hover backgrounded  |
| `danger`  | Red (`#e74c3c`)                                         |
| `primary` | Accent green                                            |

Defaults to `variant="ghost"`, `size="md"`, `type="button"`. Used by `ImageUploadInput` (Send / Stop / Upload, all `size="sm"`) and `WelcomeView` (Send / Attach).

Forwards all native `<button>` props. Disabled state lowers opacity to 50% and removes the pointer cursor.

### 11.20 `Icons`

Single module exporting hand-rolled SVG icons used in the chat surface (where `lucide-react` is intentionally avoided for tighter visual control):

- `ImageIcon`, `SendIcon`, `StopIcon`, `ChevronIcon` (rotates 90deg when `isOpen`), `DotIcon`, `AgentIcon` (subagent marker), `ChevronUpDownIcon`.

All accept `className`; `ChevronIcon` adds `isOpen?: boolean`.

### 11.21 `ImageThumbnail`

Sized image card with optional remove button.

| Size | Dimensions                    |
| ---- | ----------------------------- |
| `sm` | `h-16 w-16` (64×64)           |
| `md` | `h-20 w-20` (80×80, default)  |
| `lg` | `max-w-[200px] max-h-[200px]` |

Remove button is rendered only when `onRemove` is supplied. It is positioned `-top-2 -right-2`, hidden until hover, and disabled while `disabled` is true.

---

## 12. Models

The model catalog is owned by **SERA**, not SERAUI. SERA persists it in the Mongo `models` collection, caches reads in Redis (300s TTL), and exposes CRUD at `/api/v1/models`. SERAUI fetches the enabled subset per-request from SERA and threads it through React Context to the client tree. There is no hardcoded list in SERAUI.

### 12.1 Data flow

```
Mongo `models` ──► Redis cache (300s) ──► SERA `GET /api/v1/models?enabled=true`
                                                          │
                                                          ▼
                                       SERAUI server action `listModels()`
                                       (app/actions/models.ts, forwards
                                        session cookie via seraFetch)
                                                          │
                                                          ▼
                                      `<ModelCatalogProvider initialCatalog>`
                                                          │
                                       ┌──────────────────┼──────────────────┐
                                       ▼                  ▼                  ▼
                              useModelCatalog()   useModelCatalog()   useModelCatalog()
                              <ModelSelector>     <SeraChat>          <useAgentChat>
```

### 12.2 Catalog row shape

`app/lib/models.ts` mirrors SERA's `ModelCatalogEntry`:

```ts
interface ModelOption {
  spec: string;           // canonical "provider/modelID" e.g. "anthropic/claude-sonnet-4-6"
  provider: string;       // backend provider id (anthropic | openai | google | vllm | ...)
  modelID: string;        // last segment of spec
  displayName: string;
  enabled: boolean;
  contextWindow?: number;
}
```

Group headers in `<ModelSelector>` render the raw `provider` value (`anthropic`, `openai`, `google`, `vllm`, etc.) verbatim — there is no client-side label mapping. If a friendlier name is wanted, add it as a field on SERA's `ModelCatalogEntry` so the data drives the UI.

### 12.3 Server action

`app/actions/models.ts` exposes a single `"use server"` function:

```ts
listModels(): Promise<ModelOption[]>
```

It calls `seraFetch("/models", { query: { enabled: "true" } })`, which attaches the user's NextAuth session cookie. Unauthenticated callers see `UnauthorizedError`. The result is cached only by SERA's Redis layer — SERAUI does not add its own cache; it relies on the page being re-rendered (server-side) per request and on SERA's 300s TTL absorbing the load.

### 12.4 Provider mount

`app/(chat)/layout.tsx` is an async server component that calls `listModels()` and renders `<ModelCatalogProvider initialCatalog={catalog}>` around its client children. Other routes (e.g. `/api/auth/signin`) don't need the catalog, so the provider lives at the chat-route group rather than the root layout. `listModels()` is allowed to throw (unauthorized session, SERA unreachable, malformed response); the Next.js error boundary surfaces the failure. There is no silent fallback to an empty catalog — chat routes are only reachable after auth, so an authorization failure here is a real bug worth seeing.

### 12.5 Consumers

- **`<ModelSelector>`** — calls `useModelCatalog()`, builds `groupModelsByProvider(catalog)`, renders. Empty catalog renders a single disabled "No models available" item.
- **`<SeraChat>`** — passes the active model spec straight through to `<ModelSelector>` without substitution. When `model` is `null` (nothing yet picked for this chat), the selector renders an explicit "Select a model" empty state rather than auto-displaying a placeholder spec.
- **`useAgentChat`** — uses `getModelBySpec(catalog, stored)` to decide whether to restore `localStorage["sera:lastModel"]` (entries can disappear from the catalog between sessions).

### 12.6 Pure helpers in `app/lib/models.ts`

All take an explicit `models: readonly ModelOption[]` argument and have no module-level state, so they're trivial to test and safe for both server and client:

- `getModelBySpec(models, spec)` — strict lookup; returns `undefined` if absent.
- `getModelDisplayName(models, spec)` — returns the `displayName` of the matching row, or `null` if the spec is not in the catalog. Callers must explicitly handle `null` (no synthesized display string from the raw spec).
- `groupModelsByProvider(models)` — returns `[provider, ModelOption[]][]` keyed by the raw `provider` field from the catalog, preserving catalog insertion order.

There is no exported default model. The selector accepts `string | null`; absence is a real state the UI handles explicitly. The backend resolves `PRIMARY_MODEL` server-side when `body.model` is `undefined`, but that resolution is invisible to SERAUI — SERAUI does not pre-fill or guess a spec on the user's behalf.

### 12.7 Persistence

The most recent model spec is mirrored to `localStorage["sera:lastModel"]` by `setModel` in `useAgentChat`. On mount, `useAgentChat` validates the stored spec against the live catalog and discards it if it's no longer present.

---

## 13. Attachment Handling

### 13.1 Lifecycle

1. **Local preview** — `ImageUploadInput.handleFiles` mints a local UUID for each selected file. Images are read with `FileReader.readAsDataURL`; non-image files keep an empty preview and display as filename chips.
2. **Upload** — On submit, each file is sent to SERA via the `uploadAttachment` server action (`POST /api/v1/agent/attachments`, multipart `file` field). SERA returns an `Attachment`.
3. **Cache** — Image `Attachment.id` values are paired with local data-URL previews and SERA-returned `mimeType` in `ImageCacheContext.addImage(id, preview, mimeType)`.
4. **Chat request** — `useAgentChat.sendMessage` sends text plus `attachmentIDs: attachments.map(a => a.id)` in the `/api/v1/agent/chat` JSON body. The optimistic user `Message` stores the full `attachments` array for immediate rendering.
5. **Trim** — After every batch, `clearOldImages()` keeps the preview map at ≤50 entries (insertion-order LRU).

### 13.2 Display

`UserMessage` renders `message.attachments` directly. Image attachments prefer a cached preview and fall back to `/api/v1/agent/attachments/:id/content`; file attachments render as links to the same authenticated content endpoint.

### 13.3 Constraints

The UI filters selected files before upload to match SERA's default max size of 25 MB per file. SERA repeats the same size validation server-side; the server action surfaces any 4xx/5xx as a thrown error message that bubbles into a `console.error`.

---

## 14. Styling & Theming

### 14.1 CSS Layer

`app/globals.css`:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme inline {
  --color-background: #1a1915;
  --color-background-secondary: #2d2a27;
  --color-background-tertiary: #3d3a37;
  --color-foreground: #ece8e1;
  --color-foreground-muted: #a39e93;
  --color-border: #3d3a37;
  --color-accent: #a4c639;
  --color-accent-hover: #b8d44d;
  --color-accent-muted: rgba(164, 198, 57, 0.15);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

- Scrollbars are styled globally (Firefox `scrollbar-width: thin`; WebKit `::-webkit-scrollbar` 8×8 with rounded thumb).
- A single keyframe is defined: `indeterminate` (sweeps `translateX(-100%)` → `translateX(300%)`). No component currently references it — it is reserved for a future indeterminate-progress treatment.
- The `pulse` keyframe used by the streaming caret comes from Tailwind's default animation set (referenced as `animation: pulse 0.8s steps(1) infinite`).

### 14.2 Token Usage

Tailwind utility classes derived from the `@theme` palette:

| Token                          | Tailwind utility                 | Common use                                        |
| ------------------------------ | -------------------------------- | ------------------------------------------------- |
| `--color-background`           | `bg-background`                  | App root / chat surface                           |
| `--color-background-secondary` | `bg-background-secondary`        | Sidebar, input bar                                |
| `--color-background-tertiary`  | `bg-background-tertiary`         | Hover/active highlights, user bubble              |
| `--color-foreground`           | `text-foreground`                | Primary text                                      |
| `--color-foreground-muted`     | `text-foreground-muted`          | Secondary text                                    |
| `--color-border`               | `border-border`                  | Dividers                                          |
| `--color-accent`               | `bg-accent`, `text-accent`, etc. | Send button, code links, active streaming markers |
| `--color-accent-hover`         | `bg-accent-hover`                | Send button hover                                 |
| `--color-accent-muted`         | `bg-accent-muted`                | Selected model row, confirmation card background  |

### 14.3 Layout Tokens

- Chat content column width is hard-capped at `max-w-[672px]` and centered (`mx-auto`).
- Welcome layout uses `pt-[32vh]` to position the greeting and input near the upper third.
- Sidebar widths: 48 px (collapsed) and 287 px (expanded).
- Streaming detail strips: thinking max height `200px`, tool args `120px`, tool result `200px`, errors `120px`.

### 14.4 Dark Mode

Hard-coded — the root `<html>` always carries `class="dark"`. No theme toggle exists.

---

## 15. Build & Deployment

### 15.1 Scripts (`package.json`)

| Script  | Command      | Purpose                                                           |
| ------- | ------------ | ----------------------------------------------------------------- |
| `dev`   | `next dev`   | Local development server (default port 3000)                      |
| `build` | `next build` | Production build (standalone output)                              |
| `start` | `next start` | Run the standalone build                                          |
| `lint`  | `eslint`     | Lint via flat config (`next/core-web-vitals` + `next/typescript`) |

### 15.2 Next.js Config

```ts
const nextConfig: NextConfig = { output: "standalone" };
```

Standalone output emits `.next/standalone/server.js` plus a trimmed `node_modules`, ready to copy into a minimal container.

### 15.3 Dockerfile

Three stages, all on `node:22-alpine`:

| Stage        | Steps                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deps`       | `apk add libc6-compat`; `npm ci` from `package.json` + `package-lock.json`                                                                                   |
| `builder`    | Copy deps; `NEXT_TELEMETRY_DISABLED=1`; `npm run build`                                                                                                      |
| `production` | Copy `public/`, `.next/standalone`, `.next/static`; create `nextjs:nodejs` user (1001/1001); run as non-root; `EXPOSE 3000`; `HOSTNAME=0.0.0.0`; `PORT=3000` |

The container's `HEALTHCHECK` calls `wget --spider http://localhost:3000/health` every 30 s (10 s timeout, 5 s start period, 3 retries).

Final entrypoint: `node server.js` (the standalone build's bundled server).

### 15.4 Reverse-proxy Expectations

- `AUTH_TRUST_HOST=true` and a correct `AUTH_URL` are required when running behind a TLS-terminating proxy so Auth.js builds the callback URL correctly.
- The proxy must forward cookies for the agent rewrite to work: `SERA_API_URL` is consumed in `proxy.ts` and called server-to-server, then the response (including any `Set-Cookie` from SERA) is streamed back.

### 15.5 Health Endpoint

`GET /health` is matched-out of the proxy (`proxy.ts`'s matcher excludes `health`) and returns `{ status: "ok" }` JSON. Suitable for Kubernetes liveness/readiness probes and the Docker healthcheck.

---
