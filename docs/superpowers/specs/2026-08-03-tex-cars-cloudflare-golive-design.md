# Tex Cars go-live on Cloudflare + Supabase (design)

Date: 2026-08-03
Status: design approved (architecture), packaging decision pending client
Supersedes hosting portion of: `app/LAUNCH.md` (Vercel), which stays valid for
everything except the compute/host layer.

## 1. Goal

Take the Phase 2 Tex Cars platform live at `app.tex-cars.com` on a **Supabase +
Cloudflare** stack instead of Vercel, with low, predictable monthly cost. The
Next.js app itself does not change; only the host and one scheduled job move.

## 2. Why this shape

The app is a Node.js server, not an edge function. It uses `argon2` (a native
Node addon), every API route declares `runtime = "nodejs"`, and it ships a
production `Dockerfile` with `output: "standalone"`. Running it as a container
is therefore a zero-app-change path. Porting it to pure Cloudflare Workers would
require replacing argon2, changing the DB driver, and converting the cron, for a
low-traffic single-tenant backoffice that gains nothing from the edge. Rejected.

Chosen host: **Cloudflare Containers**. It runs the existing Docker image, keeps
the whole stack in one Cloudflare account, and turns the cron into a native
Cloudflare Cron Trigger.

## 3. Architecture

```
Browser
  |
Cloudflare edge  (DNS, SSL, CDN, WAF/Turnstile)      app.tex-cars.com
  |
Worker  (thin entrypoint, ~30 lines; also runs the cron)
  |
Container = the existing Docker image (Next.js standalone, UNCHANGED)
  |  listens on PORT 3000, non-root, HEALTHCHECK /api/health
  |
  +-- Supabase   Postgres (transaction pooler :6543 runtime, direct :5432 migrations)
  +-- Upstash    Redis rate-limit (HTTP)
  +-- Stripe     payments + webhook  (CLIENT-OWNED, see section 5)
  +-- Resend     transactional email
```

Cloudflare Containers always sits behind a Worker. The Worker is a Durable
Object that extends Cloudflare's `Container` class, forwards inbound requests to
the container's port 3000, and hosts the `scheduled()` handler for the cron.

Instance policy for launch: **one warm instance** (`max_instances` low, keep at
least one live) so the public `/book` flow never pays a cold-start. Revisit
scale-to-zero once real traffic is observed.

## 4. What changes vs the current repo

Unchanged (do not touch):
- The entire Next.js app under `app/src`, its `Dockerfile`, `next.config.ts`,
  Drizzle schema and migrations, seed/admin scripts, tests.
- All env-var contracts in `app/src/env.ts`. Same variables, injected as
  container secrets instead of Vercel env vars.

New glue (added, small, host-only):
- `app/src/worker/index.ts` (or similar): the Worker entrypoint + `Container`
  Durable Object subclass that proxies to port 3000.
- `app/wrangler.jsonc`: container image ref, DO binding, `max_instances`,
  instance type, a `[triggers] crons` entry, and secret/var bindings.
- Cron: the Vercel cron in `vercel.json` (`*/15 * * * *` -> `/api/cron/expire-holds`)
  becomes a Cloudflare Cron Trigger. The Worker `scheduled()` handler calls the
  container's `/api/cron/expire-holds` with the `CRON_SECRET`. `vercel.json` can
  be retired (or left inert).

Deleted/retired: Vercel project, Vercel cron. `vercel.json` no longer authoritative.

## 5. Account ownership

Fixed regardless of packaging:
- **Stripe = client-owned.** Customer rental payments must land in Tex Cars'
  own Stripe account (their revenue, KYC, statement descriptor). Salty Code is
  invited as a developer only. Non-negotiable.
- **Domain `tex-cars.com` = client-owned.**

OPEN SWITCH (pending client conversation, does not block build):
- **Managed** (recommended): Cloudflare + Supabase + Upstash + Resend under
  Salty Code accounts. Client pays a flat monthly "Hosting & Care" fee. Note:
  the signed Tex Cars deal is EUR 7,750 one-time, no retainer, so this monthly
  fee is a NEW line to agree, not something already contracted.
- **Self-owned**: every account under Tex Cars' email + card; Salty Code is
  admin. Client pays providers directly (~$30/mo); Salty Code bills hourly.

The only technical difference between the two is whose email/card creates the
Cloudflare and Supabase accounts. Everything else in this design is identical.

## 6. Environment / secrets

Same set as `LAUNCH.md` section 3, injected as Cloudflare container secrets:
`NODE_ENV`, `APP_ORIGIN=https://app.tex-cars.com`, `CORS_ALLOWED_ORIGINS`,
`SESSION_SECRET`, `SESSION_TTL_SECONDS`, `SESSION_IDLE_TTL_SECONDS`,
`DATABASE_URL` (Supabase pooler :6543 `?sslmode=require`),
`DATABASE_MIGRATION_URL` (Supabase direct :5432), `DATA_ENCRYPTION_KEY`,
`STRIPE_SECRET_KEY` (restricted), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
`EMAIL_FROM`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`CRON_SECRET`, `TRUST_PROXY=true`.

Secrets generated with: `openssl rand -base64 48` (SESSION_SECRET),
`openssl rand -base64 32` (DATA_ENCRYPTION_KEY, never rotate without re-encrypting),
`openssl rand -hex 32` (CRON_SECRET).

## 7. Go-live sequence (adapted from LAUNCH.md)

1. **Provision** Supabase (Postgres), Upstash (Redis), Resend (verified sender),
   Stripe (client-owned, restricted key + webhook secret). [owner/client]
2. **Generate** the three secrets above.
3. **Build + push** the Docker image to Cloudflare's managed registry via
   `wrangler`, and add the Worker wrapper + `wrangler.jsonc`.
4. **Set** all env vars as container secrets/bindings.
5. **Migrate + seed**: `npm run db:migrate` (direct :5432), `npm run db:seed`,
   `npm run admin:create -- owner@tex-cars.com`. `btree_gist` is created by
   migration 0002; nothing to enable manually in Supabase.
6. **Deploy** the Worker + Container (`wrangler deploy`).
7. **Stripe webhook** -> `https://app.tex-cars.com/api/webhooks/stripe` for
   `checkout.session.completed` + async payment succeeded/failed. [client]
8. **DNS**: point `app.tex-cars.com` at the Worker route in Cloudflare.
9. **Flip Phase 1 site live**: set `bookingEnabled: true` in
   `site/data/config.js`, redeploy the static marketing site.
10. **Smoke tests** (LAUNCH.md section 8): health check, admin login+MFA, full
    customer booking with Stripe test card 4242..., webhook flips to confirmed,
    planning board shows the booking, cancel frees the slot, email_log rows,
    and the Cron Trigger fires `/api/cron/expire-holds`.
11. **Security checklists** (fort, LAUNCH.md section 9) before public launch.

## 8. Cost (at Tex Cars traffic)

- Supabase Pro: ~$25/mo (backups, no pausing).
- Cloudflare: Workers Paid $5/mo floor + a few $ for one warm container instance.
- Upstash: $0 (free tier).
- Resend: $0-ish at low volume.
- Stripe: per-transaction, on the client's account.

Roughly **$30-35/mo infra**. Managed packaging bills the client a flat fee above
this; self-owned has the client pay it directly.

## 9. Risks and open items

- **Cold start** if scaled to zero: mitigated by keeping one warm instance at
  launch. Cost of always-warm is a few dollars, accepted.
- **Node version**: Dockerfile pins Node 20.18.1 while `package.json` engines
  says >=22.9.0. It builds today, but bump the Dockerfile base to Node 22 during
  this work to match, and re-run the test suite.
- **Container networking to Supabase**: postgres.js over TCP works from a
  container (full network access), so no Hyperdrive/driver change needed. Verify
  the pooler connection from within a deployed container as part of smoke tests.
- **Packaging decision** (managed vs self-owned) is pending the client. Build
  proceeds; only the final account-creation step branches.
- **Known follow-ups from LAUNCH.md** (out of scope here): refund-on-cancel
  policy, pre-pickup reminder + low-stock emails, CSP nonce hardening, real fleet
  photos to private storage, optional ID verification.

## 10. Out of scope

- Porting to Cloudflare Workers/edge.
- Any change to app features, schema, or business logic.
- The client-facing explainer for the packaging choice (deferred by request).
- FleetDesk multi-tenant / Stripe Connect productization (separate track).
