# AI_NOTES.md

A short, honest account of how AI tooling was used to build this project.

## AI tools used

- **Claude (Anthropic)** as the primary pair-programmer — scaffolding, writing
  the service layer, the rule engine, API routes and the dashboard UI, and
  drafting docs and tests.
- **Gemini** is used _inside_ the product (not to build it) for issue/PR
  triage — summary, priority and a suggested label.

## How AI helped

- **Boilerplate at speed.** Prisma models, the shadcn/ui primitives, Zod
  schemas and the many CRUD route handlers are repetitive; AI produced them
  quickly so effort could go into the interesting parts.
- **Consistency.** Keeping enum values, Zod validators and UI dropdowns aligned
  is exactly the kind of book-keeping AI is good at. They funnel through
  `constants.ts` / `validations.ts`.
- **Edge-case checklists.** Prompting "what can go wrong with a webhook
  receiver?" surfaced duplicate deliveries, unsigned requests, `ping` events,
  non-JSON bodies and rate-limiting — all handled explicitly.
- **Test design.** AI enumerated the meaningful cases for signature
  verification, the matcher and template rendering.

## Architecture decisions the developer made

These were deliberate human calls, not defaults:

1. **Next.js Route Handlers over a separate Express backend** — one deployable
   unit on Vercel, less surface area, shared types.
2. **Encrypt tokens in a dedicated `User` column (AES-256-GCM)** rather than
   trusting the adapter's plaintext `Account.access_token`. The app only ever
   reads the encrypted column.
3. **Fast-ACK + `after()` processing.** The webhook returns `202` immediately
   and processes in the background so GitHub never times out.
4. **Persist every step (ActionLog / GitHubAction / SlackDelivery) with latency
   + status.** This is what makes retries safe and the dashboard observable.
5. **Rules as data.** A `Rule` table with an event type, keyword, match field
   and action — no hardcoded automation.
6. **One Slack message per event**, aggregating all matched rules' actions,
   instead of one message per rule (avoids spam).

## The hardest bug AI introduced — and the fix

**Duplicate-protection race.** The first cut checked "does a `WebhookEvent`
with this `deliveryId` exist?" with a `findUnique`, and if not, created it.
Under GitHub's rapid re-deliveries two invocations both saw "not found" and both
proceeded — the unique index then made the _second_ `create` throw, which the
handler surfaced as a `500`. GitHub treats a 500 as a failed delivery and
retries, amplifying the problem.

**Fix:** drop the pre-check and rely on the database. Attempt the `create`
directly and catch Prisma's `P2002` unique-violation, returning `200`
(idempotent success) for duplicates. The database is the single source of truth
for "have we seen this delivery", so there is no check-then-act window. See
`src/app/api/webhooks/github/route.ts`.

A second, subtler one: Prisma `BigInt` repo ids can't be `JSON.stringify`-ed,
so `/api/repositories` threw at runtime only. Fixed with a BigInt-aware
`json()` helper in `src/lib/http.ts`.

## Future improvements

- Durable queue (Upstash QStash / Redis) instead of `after()` for heavy loads.
- Global rate limiting + retry backoff via Redis.
- GitHub App auth (installation tokens) as an alternative to OAuth scopes.
- Signed-in-user field-level encryption on the whole `Account` table.
- More event types (releases, comments) and richer rule conditions (regex, AND/OR).

## Example prompts that worked well

- "Write a pure `verifySignature(rawBody, header, secret)` using HMAC-SHA256 and
  `crypto.timingSafeEqual`, returning false instead of throwing on length
  mismatch. Then write Vitest cases for valid, tampered, wrong-secret and
  missing-header."
- "Design the Prisma schema for webhook events, action logs, GitHub actions,
  Slack deliveries and AI analyses so every side-effect is individually
  retryable and observable."
- "This webhook handler returns 500 on GitHub's duplicate re-deliveries. Make
  duplicate handling idempotent without a check-then-act race."
- "Build a shadcn/ui rule-builder dialog: event type, match field, keyword,
  action (label/comment/none) with conditional fields, and Slack + enabled
  switches. "
