# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

An event-driven GitHub automation bot. A user signs in with GitHub, connects a
repository, and the app receives webhooks, runs a database-backed rule engine,
writes back to GitHub (labels/comments), notifies Slack, and enriches events
with Gemini AI — all visible from a live dashboard.

## Stack

- **Next.js 15** (App Router, RSC) + **React 19** + **TypeScript** (strict).
- **Prisma 6** + **PostgreSQL** (Neon in prod).
- **Auth.js v5 (NextAuth)** with the Prisma adapter and GitHub OAuth.
- **Tailwind CSS v3** + **shadcn/ui** (new-york).
- **Octokit** for GitHub, **@google/generative-ai** for Gemini, Slack Incoming
  Webhooks over `fetch`.
- **Vitest** for unit tests. **pnpm** for packages.

## Architecture (where things live)

```
src/lib/                Core logic (pure + services)
  auth.ts               NextAuth config; persists ENCRYPTED GitHub token
  crypto.ts             AES-256-GCM encrypt/decrypt (ENCRYPTION_KEY)
  webhook.ts            HMAC-SHA256 verify + payload normalisation (PURE)
  rule-engine.ts        matchesRule / renderTemplate (PURE, unit-tested)
  github.ts             Octokit wrappers (ensureLabel, addLabels, comment…)
  slack.ts              Block Kit builder + POST
  gemini.ts             AI analysis (strict JSON)
  services/
    event-processor.ts  Orchestrates a received event end-to-end
    retry.ts            Re-attempts FAILED github/slack rows (cron)
src/app/api/            Route handlers (auth, webhooks, repos, rules, events…)
src/app/(dashboard)/    Authenticated pages (guarded in layout.tsx)
src/components/          UI: ui/ = shadcn primitives, dashboard/ = features
prisma/schema.prisma    9 domain models + Auth.js models + enums
__tests__/              Vitest unit tests
```

## Golden rules

- **Never expose secrets to the client.** Tokens/Slack URLs are encrypted at
  rest and only decrypted server-side. API routes return booleans, not secrets.
- **Webhook endpoint must verify the signature** (`verifySignature`) before
  trusting anything, and **dedupe by `deliveryId`** (unique constraint).
- **Nothing is silently lost.** Failures are persisted with `status` +
  `retryCount`; the retry cron picks them up.
- **Rules are data, not code.** They live in the `Rule` table.
- Keep `src/lib/*` pure functions pure — they are the unit-test surface.
- Enum values, Zod schemas and UI option lists are kept in sync via
  `src/lib/constants.ts` and `src/lib/validations.ts`.

## Commands

```bash
pnpm dev            # run locally
pnpm build          # prisma generate + next build
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # next lint
pnpm prisma:migrate # create/apply a dev migration
pnpm db:seed        # demo data
```

## Gotchas

- Route handler `params`/`searchParams` are **Promises** in Next 15 — `await`
  them.
- The webhook route uses `after()` to process AFTER responding (fast ACK).
- Prisma `BigInt` (repo ids) is serialised via the `json()` helper in
  `src/lib/http.ts` — don't `Response.json()` a raw repo.
- Rate limiting is in-memory (best-effort on serverless) — see README.
