# Tex Cars Phase 2 — Build Roadmap

> Master sequence for building the booking + operations platform per
> `../2026-06-11-phase2-booking-system-spec.md`. One plan per subsystem; each plan
> ends with working, tested software and a git tag. Execute in order.

**App location:** `~/Desktop/saltycodestudio-clients/tex-cars-rental/app/` (own git repo)
**Stack:** Next.js 15 App Router (fort `nextjs-route-handlers` starter) · TypeScript strict ·
Drizzle ORM · Postgres (Neon in prod, PGlite for dev/tests) · Upstash Redis (prod rate limits) ·
Stripe · Resend · Vercel

| # | Plan | Delivers | Spec sections |
|---|------|----------|---------------|
| 01 | Foundation | Scaffold from fort starter, validated env, Drizzle schema for all 14 tables, migrations incl. the booking exclusion constraint, field-level crypto, seed script, test harness, health probe | 2, 12 |
| 02 | Admin auth | Argon2id login, hardened sessions, lockout + throttling, TOTP MFA, CSRF, audit log writes, admin shell layout | 4 (admin), 11 |
| 03 | Admin hub | Fleet CRUD + photos, rates/deposits, availability blocks, settings, add-ons, insurance tiers, policies with versions, upsell toggles, audit log viewer | 5, 10 |
| 04 | Booking engine | Public availability + quote API (server-priced), booking creation with idempotency + guardrails, license capture (encrypted), terms acceptance, equipment stock checks | 6, 7, 8 |
| 05 | Payments | Stripe reservation-fee / full-deposit checkout, signed webhooks flip bookings to confirmed, payments table lifecycle, refund path | 3 |
| 06 | Customers + email | Passwordless magic-link/OTP, my-bookings page, Resend transactional emails + admin alerts, email_log | 4 (customers), 9 |
| 07 | Harden + launch | Fort checklists (auth, ecommerce, api, deployment, secrets, OWASP), CSP review, Upstash rate-limit store, deploy to Vercel + Neon, DNS app.tex-cars.com, flip the Phase 1 bridge | 11, 13, 14 |

**Open items from the owner** (spec §16) do not block: every amount is an editable
setting with a placeholder default (reservation fee $30, currency USD, min age 21,
deposits null per class until confirmed).

**Status**
- [x] Plan 01 written: `2026-06-11-phase2-plan-01-foundation.md`
- [x] Plan 01 EXECUTED 2026-06-11 — tag `phase2-01-foundation`, hardened post-audit
- [x] Plan 02 (Admin auth) EXECUTED 2026-06-11 — tag `phase2-02-admin-auth`, 60 tests green,
      build green, full login→enroll→TOTP→dashboard + replay-rejection verified live in browser.
      Argon2id + exponential lockout, Postgres sessions (hash-only, idle+absolute, rotation),
      mandatory TOTP MFA (RFC 6238) + single-use recovery codes, CSRF, audit trail, admin shell.
- [x] Plan 03 (Admin hub) EXECUTED 2026-06-11 — tag `phase2-03-admin-hub`, 75 tests green.
      Fleet/pricing/deposit CRUD (retire-not-delete), settings + guardrails + blackouts,
      add-ons (stock) + insurance (single-default), versioned policies, read-only audit viewer.
      Service modules in src/lib/admin/* (zod+Drizzle), thin routes via read()/mutate() guard
      (requireAdmin + CSRF + audit). UI pages under (shell)/*. Live-verified incl. CSRF block.
- [x] Plan 04 (Booking engine) EXECUTED 2026-06-11 — tag `phase2-04-booking-engine`, 110 tests green.
      Server-priced quote (tiered DP), guardrails (length/lead/buffer/blackout/blocks), encrypted
      licence capture (age + expiry checks, AAD crypto, retention timer), booking creation in one
      transaction (idempotent, overlap-safe via the exclusion constraint, add-on stock guard).
      Public APIs (vehicles/insurance/addons/policies/quote/availability/bookings) + /book flow +
      /policies pages. Live-verified E2E incl. encryption at rest.
- [x] Plan 05 (Payments) EXECUTED 2026-06-11 — tag `phase2-05-payments`, 128 tests green.
      Stripe Checkout (hosted, dynamic methods), server-derived charge (reservation fee /
      full deposit / cash-still-pays-fee), idempotent signed webhook flips pending→confirmed
      (amount-verified, dedup, cancelled-guard), unpaid-hold expiry. Live route test passed.
- [x] Plan 06 (Customers + email) EXECUTED 2026-06-11 — tag `phase2-06-customers`, 147 tests green.
      Passwordless OTP login (single-use, 15-min, attempt-capped, hashed), requireCustomer guard
      (subjectType customer + CSRF), my-bookings (owner-scoped list + cancel), Resend email
      (best-effort, email_log) with login/confirmation/cancellation + admin new-booking/payment
      alerts. Live E2E verified incl. 404 on foreign booking + 403 without CSRF.
- [x] Plan 07 (Harden + launch) EXECUTED 2026-06-11 — tag `phase2-07-harden-launch`, 150 tests green.
      Page-level CSP + clickjacking headers (strict for /api, app CSP for pages, unsafe-eval dev-only),
      Upstash Redis rate-limit store (async limiter, in-memory fallback), CRON_SECRET-guarded
      hold-expiry cron + vercel.json, LAUNCH.md runbook. Plus the visual planning-board dashboard.

---
## PHASE 2 COMPLETE (2026-06-11)
All 7 plans built, each adversarially audited and hardened. Plus a visual planning-board
dashboard (fleet timeline by category, the owner's requested Excel-style calendar view).
App at `app/` — 150 tests green, build green, ~30 commits, tags phase2-01 … phase2-07.
Go-live runbook: `app/LAUNCH.md`. Remaining = owner action (provision Neon/Upstash/Stripe/
Resend keys, deploy to Vercel, DNS app.tex-cars.com, flip Phase 1 bookingEnabled:true, run
the live smoke tests + fort checklists).
