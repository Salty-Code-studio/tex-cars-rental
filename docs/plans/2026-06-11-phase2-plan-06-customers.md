# Phase 2 Plan 06: Customers + Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executed inline. Resend network call is isolated + best-effort; token issue/verify, email logging, and templates are tested offline.

**Goal:** Passwordless customer accounts (spec §4) — email magic-link/OTP login, no password to leak — and a "my bookings" view they can manage. Plus transactional email via Resend (spec §9): login codes, booking confirmations, admin alerts on new bookings/payments, cancellation notices, all recorded in `email_log`.

**Architecture:** Customers reuse the Postgres session infra (subjectType 'customer', no MFA). A `login_tokens` table holds a single-use, short-lived, rate-limited OTP (also embedded in a magic link); only its hash is stored. Email is isolated in `src/lib/email/*`: a Resend client wrapper (best-effort — never blocks a booking; logs every send to `email_log`), pure HTML templates, and a `sendAndLog` recorder. Transactional sends are triggered from the routes/webhook, not deep in libs. Email is OPTIONAL config: with no Resend key the service logs `skipped` and the app still works (for dev/preview).

**Tech Stack:** existing foundation + `resend` SDK.

---

### Task 1: Env + email infra
**Files:** `src/env.ts` (+ RESEND_API_KEY optional [re_], EMAIL_FROM optional default), `.env.example`, `src/lib/email/resend-client.ts` (lazy, returns null when unconfigured), `src/lib/email/send.ts` (`sendAndLog({to,type,subject,html})` → deliver via Resend if configured else skip; always insert an email_log row with status sent|failed|skipped, never throws), install `resend`; test.
- Test: sendAndLog with no key → email_log row status 'skipped', returns without throwing.

### Task 2: Email templates (pure)
**Files:** `src/lib/email/templates.ts`, test.
- `loginCodeEmail({code, link})`, `bookingConfirmedEmail({booking, vehicleName})`, `adminNewBookingEmail({...})`, `adminPaymentEmail({...})`, `bookingCancelledEmail({...})`. Each → `{ subject, html }`, brand-aligned, no em-dashes (house rule), no PII beyond what's needed.
- Tests: render contains the code/dates; subjects set; no `—`.

### Task 3: Customer login tokens
**Files:** `schema/auth-tokens.ts` (`loginTokens`: id, email, codeHash, expiresAt, attempts, usedAt, createdAt), migration `0009`, `src/lib/auth/customer-login.ts` (`issueLoginToken(email)` → deletes prior unused, inserts a fresh 6-digit OTP [hash sha256(email:code)], 15-min expiry, returns {code, token-link path}; `verifyLoginToken(email, code)` → newest unused unexpired token, attempts<5, constant-time compare, mark used on success → returns ok; increments attempts on miss), tests.
- Tests: issue+verify happy path; wrong code increments attempts; 5 misses lock the token; expired rejected; used rejected; a new issue invalidates the old code.

### Task 4: Customer auth routes + guard
**Files:** `src/lib/auth/customer-auth.ts` (`requireCustomer(req)` → session subjectType 'customer' + CSRF on unsafe methods → returns {customer, session}); routes `api/auth/request` (POST {email}: rate-limit 3/10min per email+IP, issueLoginToken, sendAndLog login email, generic 200), `api/auth/verify` (POST {email, code}: verifyLoginToken, upsert customer emailVerified=true, create customer session + cookies, 200), `api/auth/logout` (POST), `api/me` (GET requireCustomer → {email, name}).
- Reuses createSession/applySessionCookies/clearSessionCookies + enforceCsrf.

### Task 5: My bookings
**Files:** routes `api/me/bookings` (GET requireCustomer → the customer's bookings, no other PII), `api/me/bookings/[id]/cancel` (POST requireCustomer → cancel own pending|confirmed booking → cancelled, frees the slot), `src/lib/booking/customer-bookings.ts`, test.
- Cancel is owner-scoped (booking.customerId === session.subjectId) → 404 if not theirs (no enumeration). Refund of the reservation fee is the §16 open item: cancellation records the status; a flag/email notes a refund may apply.
- Tests: list returns only that customer's bookings; cancel flips status + frees the exclusion slot; cancelling someone else's booking 404s; cancelling a completed booking is rejected.

### Task 6: Transactional wiring
**Files:** `api/bookings/route.ts` (after create: admin "new booking" alert), `api/webhooks/stripe` reducer or route (on confirm: customer confirmation + admin payment alert), `api/me/bookings/[id]/cancel` + admin/customer cancel (cancellation notices). All via sendAndLog, best-effort (a failed email never breaks the flow). Admin recipients from `settings.adminAlertRecipients`.
- Keep sends in routes (libs stay pure); the webhook confirm send lives in the route after processStripeEvent reports bookingConfirmed.

### Task 7: Customer UI + verify
**Files:** `src/app/(public)/account/login/page.tsx` (email → request → enter code), `account/verify/page.tsx` (magic-link landing: reads ?email&code, verifies, redirects), `account/page.tsx` (my bookings, client; gated by /api/me 401→login). Public layout reused.
- Phase 1 site can later link "My bookings" → app `/account`.

### Task 8: Verify + tag
- Full gate: typecheck, tests, build, boot. Live: request a login code (read it from email_log / dev log since no real Resend), verify → customer session → /account shows the bookings made earlier; cancel one and see the slot free up; confirm email_log rows accrue.
- Commit per task; tag `phase2-06-customers`.

## Self-review
- §4 customers: passwordless magic-link/OTP ✓; no password ✓; email verified in flow ✓; tokens short-lived/single-use/rate-limited ✓; view + manage own bookings ✓ (owner-scoped).
- §9 email: login code ✓; booking confirmation ✓; admin new-booking + payment alerts ✓; cancellation notices ✓; email_log records every send ✓; recipients editable (settings) ✓. Pre-pickup reminder = a scheduled job (Plan 07 ops); low-stock alert optional/deferred.
- Email is best-effort and optional config so a missing Resend key never breaks bookings or boot.
- Refund-on-cancel (spec §16 open item) deferred to the owner's decision; the schema + status support recording it.

## Status
EXECUTED 2026-06-11 — tag `phase2-06-customers`. 147 tests green, build green. Live E2E: unauthenticated /api/me/bookings → 401; passwordless request → dev code; verify → customer session; my-bookings shows only that customer's bookings (account page screenshot confirms); owner-scoped cancel → 200/cancelled; foreign booking cancel → 404 (no enumeration); cancel without CSRF token → 403. Email is best-effort (skipped + logged with no Resend key). Dev-only affordance returns the OTP when no email provider is configured + not prod (helps local preview).
