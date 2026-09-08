# Tex Cars — Go-Live Runbook (Cloudflare Containers + Supabase)

Date: 2026-08-11 · Owner: Salty Code (managed) · Client asset: domain + Stripe
Design: `app/docs/superpowers/specs/2026-08-03-tex-cars-cloudflare-golive-design.md`

This is the exact, ordered sequence to take the Phase 2 booking platform live at
`app.tex-cars.com` and flip the marketing site (`tex-cars.com`) to online booking.

---

## 0. Status — what is already done (code side, verified)

- Worker + Container glue written: `app/worker/index.ts`, `app/wrangler.jsonc`.
- Dockerfile fixed: Node 22, amd64 pinned (Cloudflare requires amd64), build-time
  env placeholders match `src/env.ts`, OOM in Docker fixed.
- App green: **185 tests pass, typecheck clean, prod build compiles**, image builds.
- App-generated secrets already created (session, encryption key, cron) — held in
  the session scratchpad file, never committed. Provider secrets are collected below.
- DB verified: postgres.js already sets `prepare:false` → Supabase transaction
  pooler is safe. Seed is idempotent, inserts the real 34-car fleet, no demo data.

Nothing in `app/src` (features, schema, business logic) was changed.

---

## TONIGHT'S AGREED PLAN (2026-08-11)

Discovery: `tex-cars.com` is a LIVE domain — a **Framer** website at the apex +
**Google Workspace email** (Google MX), DNS at **GoDaddy**. Moving nameservers to
Cloudflare would make CF authoritative for the client's live site + email and
takes hours to propagate → too risky to rush tonight.

Decision (Mo): **deploy + fully Stripe-test the booking app on a TEMPORARY host
URL tonight**; do the `app.tex-cars.com` cutover as a deliberate later step;
leave the Framer site + email untouched; marketing-site replacement = decide later.

So tonight we run: provision → deploy to the Cloudflare `*.workers.dev` URL (with
`APP_ORIGIN`/`CORS` set to that URL) → migrate/seed → Stripe **test** webhook →
smoke test. Sections 1, 7, 9 (custom domain + site flip) are the LATER cutover.

Code status: worker glue + wrangler.jsonc done; **amd64 image builds AND boots
(`/api/health` = ok) — verified**. Colima VM raised to 8 CPU / 12 GiB and buildx
installed so `wrangler deploy` can cross-build amd64.

---

## 1. Domain → Cloudflare  ⚠️ LATER cutover step (not tonight)

A Cloudflare Worker custom domain (`app.tex-cars.com`) requires the whole
`tex-cars.com` zone to be on Cloudflare.

1. Cloudflare dashboard → Add a site → `tex-cars.com` → Free plan.
2. Cloudflare scans and imports existing DNS. **STOP and verify the import:**
   - **MX records** (client email!) — if the client receives mail at
     `@tex-cars.com`, every MX + related TXT (SPF) MUST be present, or email breaks.
   - Any existing A/CNAME/TXT the client relies on.
3. At the registrar, change the **nameservers** to the two Cloudflare gave you.
4. Wait for Cloudflare to show the zone **Active** (minutes to a few hours).

> If you cannot move nameservers tonight, use the **workers.dev fallback** (see
> §11) so the app still launches; cut over to `app.tex-cars.com` after NS moves.

---

## 2. Provision accounts (Salty Code / managed)

| Provider | What to create | Copy back |
|---|---|---|
| **Cloudflare** | Account on **Workers Paid** ($5/mo — required for Containers) | — |
| **Supabase** | New project `tex-cars`, region **East US (us-east-1)**, strong DB password | project ref, password, region |
| **Upstash** | Redis database (Global), region near us-east | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Resend** | Account + add domain `tex-cars.com`; add the DKIM/SPF TXT records it shows (into Cloudflare DNS from §1) | `RESEND_API_KEY` (`re_...`) |

Resend domain verification needs the TXT records live in Cloudflare DNS — do it
right after the zone is Active. Email is OPTIONAL (the app runs without it), so it
does not block launch; it just enables booking confirmation emails.

---

## 3. Stripe (client-owned account)

1. Log into the **client's** Stripe account.
2. Developers → API keys → **Create restricted key** with write access to:
   Checkout Sessions, Payment Intents, Webhooks. Copy `rk_live_...`
   (use `rk_test_...` first for the test smoke run).
3. Webhook is created later (§8), once the app has a URL.

---

## 4. Assemble the env values

Runtime config the container needs. Non-secrets are already in `wrangler.jsonc`
(`vars`). The **secrets** below are set with `wrangler secret put` (§5).

App-generated (already made, in scratchpad `tex-cars-launch-secrets.env`):
`SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET`.

Provider secrets to collect:

| Secret | Value / format |
|---|---|
| `DATABASE_URL` (runtime, transaction pooler :6543) | `postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require` |
| `STRIPE_SECRET_KEY` | `rk_live_...` (or `rk_test_...` for the test run) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from §8, after webhook exists) |
| `RESEND_API_KEY` | `re_...` (optional) |
| `UPSTASH_REDIS_REST_URL` | `https://<db>.upstash.io` (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | `<token>` (optional) |

Migration-only (used from the laptop in §6, NOT a container secret):
`DATABASE_MIGRATION_URL` = the **session pooler** (:5432), which is IPv4-friendly
and allows DDL:
`postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`

> Do NOT use the "direct" host `db.<ref>.supabase.co:5432` from the laptop — it is
> IPv6-only on Supabase now and will fail to connect from most home networks.

---

## 4b. Build-machine prerequisite (already set up on this Mac)

Cloudflare only runs **linux/amd64** images; this Mac is Apple Silicon (arm64), so
the image must be cross-built. `wrangler deploy` builds it locally via Docker
BuildKit, which needs **buildx**. This machine uses **Colima** (not Docker
Desktop) and had no buildx. Done tonight:

```bash
brew install docker-buildx
ln -sfn /opt/homebrew/lib/docker/cli-plugins/docker-buildx ~/.docker/cli-plugins/docker-buildx
docker run --privileged --rm tonistiigi/binfmt --install amd64     # QEMU for amd64
docker buildx create --name texbuilder --driver docker-container --use
```

Verified: `docker buildx build --platform linux/amd64` produces a bootable amd64
image (argon2 native addon compiles + runs under emulation). If `wrangler deploy`
does not pick up buildx automatically, run `docker buildx install` (aliases
`docker build` → buildx) before deploying.

## 5. Set Worker secrets + first deploy

From `app/`:

```bash
cd app
npx wrangler login                 # opens browser OAuth to the Cloudflare account
docker info                        # must succeed (Docker Desktop running)

# Set each secret (values from §4). Reads the value on the next prompt:
npx wrangler secret put SESSION_SECRET
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put DATABASE_URL
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET   # placeholder now, re-put after §8
npx wrangler secret put RESEND_API_KEY          # optional
npx wrangler secret put UPSTASH_REDIS_REST_URL  # optional
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN# optional

npx wrangler deploy                # builds amd64 image via Docker -> pushes -> deploys
```

First deploy provisions the container and takes several minutes. It serves on a
`*.workers.dev` URL until the custom domain is attached (§7).

---

## 6. Migrate + seed + create admin (run once, from the laptop)

The standalone image ships no scripts, so run these from the source checkout with
the production DB in the shell env:

```bash
cd app
export DATABASE_MIGRATION_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
export DATABASE_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require'
# plus the other required vars so env validation passes:
export SESSION_SECRET=... DATA_ENCRYPTION_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... APP_ORIGIN=https://app.tex-cars.com CORS_ALLOWED_ORIGINS=https://app.tex-cars.com NODE_ENV=production

npm run db:migrate                             # applies drizzle/ 0000..0013 (+ btree_gist)
npm run db:seed                                # settings + REAL 34-car fleet (idempotent)
npm run admin:create -- owner@tex-cars.com     # prints one-time password; MFA forced at first login
```

Save the one-time admin password; the owner sets MFA on first login.

---

## 7. Attach the custom domain `app.tex-cars.com`

Once the Cloudflare zone is **Active**:

- Easiest: Cloudflare dashboard → your Worker (`tex-cars-app`) → Settings →
  Domains & Routes → **Add Custom Domain** → `app.tex-cars.com`. Cloudflare
  creates the proxied DNS record + TLS automatically.
- Or in `wrangler.jsonc`: uncomment the `routes` line and `npx wrangler deploy`.

Verify: `curl https://app.tex-cars.com/api/health` → `{"status":"ok","db":true}`.

---

## 8. Stripe webhook

In the client's Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://app.tex-cars.com/api/webhooks/stripe`
- Events (subscribe **all four** — the code handles `expired` too):
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`
- Copy the signing secret `whsec_...` → `npx wrangler secret put STRIPE_WEBHOOK_SECRET`
  → `npx wrangler deploy` (so the container picks up the real value).

---

## 9. Flip the marketing site live (`tex-cars.com`)

Edits (already scoped — I will apply on your go):

- `site/data/config.js`: `bookingEnabled: true`, `bookingUrl: "https://app.tex-cars.com"`.
- `site/index.html`: add homepage `<link rel="canonical" href="https://tex-cars.com/">`,
  make `og:image` absolute.
- new `site/CNAME` containing `tex-cars.com` (must live in `site/` — subtree push
  overwrites the gh-pages root each deploy, so a UI-set CNAME would be wiped).

Deploy (from the **parent** repo `tex-cars-rental/`):

```bash
git add site/data/config.js site/index.html site/CNAME
git commit -m "site: go live — booking on, app.tex-cars.com, canonical + CNAME"
git push origin main
git subtree push --prefix site origin gh-pages
```

Apex DNS in Cloudflare (DNS-only / grey cloud — these are GitHub Pages, not the Worker):

| Name | Type | Value |
|---|---|---|
| `@` | A | 185.199.108.153 |
| `@` | A | 185.199.109.153 |
| `@` | A | 185.199.110.153 |
| `@` | A | 185.199.111.153 |
| `www` | CNAME | `salty-code-studio.github.io` |

GitHub repo → Settings → Pages → Custom domain `tex-cars.com` → Enforce HTTPS.
**Only flip after `app.tex-cars.com/api/health` is green**, or the CTAs point at a
dead host.

---

## 10. Smoke tests (before announcing)

1. `curl https://app.tex-cars.com/api/health` → ok.
2. Admin login at `/admin` + set MFA.
3. Full booking with Stripe **test** card `4242 4242 4242 4242` → webhook flips it
   to confirmed → it appears on the planning board.
4. Cancel a booking → the slot frees.
5. Confirm the `*/15` cron ran (Cloudflare → Worker → Cron / logs).
6. Marketing site: all 4 languages, "Book online" CTAs land in `/book`.
7. Switch Stripe to the **live** restricted key + live webhook; re-put secret; redeploy.

---

## 11. Fallback if nameservers can't move tonight

Deploy the app on its `*.workers.dev` URL:
- Set `APP_ORIGIN` + `CORS_ALLOWED_ORIGINS` (in `wrangler.jsonc` vars) to that URL,
  point `site/data/config.js` `bookingUrl` at it, run §5/§6/§8/§10 against it.
- Later, move NS (§1), set the vars back to `app.tex-cars.com`, attach the custom
  domain (§7), re-put the Stripe webhook (§8), redeploy, re-point the site.

---

## 12. Risks / notes

- **NS propagation** is the main "tonight" unknown — start §1 first.
- **Client email**: preserve MX when moving the zone (§1).
- **amd64 build under emulation** on Apple Silicon is slower (QEMU) — expect the
  first `wrangler deploy` to take several minutes.
- **Cost** ≈ $30-35/mo infra (Supabase Pro optional, Cloudflare Workers Paid $5 +
  one warm `standard-1` instance, Upstash/Resend free tier). Managed = Salty Code
  fronts it and bills the client a flat monthly fee (new line beyond the €7,750).
- **Refund-on-cancel, reminder emails, CSP nonce** = known post-launch follow-ups
  (LAUNCH.md), out of scope tonight.
