# Phase 2 Plan 05: Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executed inline. Stripe network calls are thin + isolated; signature verification, the payment state machine, and hold-expiry are tested offline.

**Goal:** Charge the reservation fee (or full deposit) via Stripe to confirm a pending booking (spec §3). Server computes every amount; Stripe Checkout (hosted) handles all card data; a SIGNED, idempotent webhook flips the booking pending→confirmed; unpaid holds expire so they stop tying up a car.

**Architecture:** Stripe Checkout Sessions (hosted redirect, dynamic payment methods, no `payment_method_types`). Charge amount is derived server-side from the booking's snapshot (never the client). Webhook verified with `stripe.webhooks.constructEvent` (HMAC + 5-min tolerance) and deduped by Stripe event id (a `stripe_webhook_events` table) for idempotency. The Stripe SDK is isolated in `src/lib/payments/stripe-client.ts`; the charge math, webhook reducer, and hold-expiry are pure/db logic tested against PGlite using `stripe.webhooks.generateTestHeaderString`.

**Tech Stack:** existing foundation + `stripe` SDK.

---

### Task 1: Env + Stripe client
**Files:** `src/env.ts` (+ STRIPE_SECRET_KEY [sk_/rk_], STRIPE_WEBHOOK_SECRET [whsec_]), `.env.example`, `src/test/setup.ts` (test placeholders), `src/lib/payments/stripe-client.ts` (lazy `getStripe()`, pinned apiVersion), install `stripe`. Add `stripe` to serverExternalPackages if build needs it.
- Test: env accepts valid-looking keys, rejects placeholders/wrong prefixes.

### Task 2: Schema — payments columns + webhook dedupe
**Files:** `schema/payments.ts` (+ `stripeCheckoutSessionId` text unique), `schema/payments.ts` or new `schema/webhooks.ts` (`stripeWebhookEvents`: eventId text PK, type text, createdAt), migration `0008`, index.
- Test: insert/dedupe a webhook event id.

### Task 3: Charge computation (pure)
**Files:** `src/lib/payments/charge.ts`, test.
- `chargeForBooking(paymentOption, breakdown)` → `{ type: "reservation_fee" | "deposit", amountCents, currency }`. reservation_fee + cash_deposit → the fee; full_deposit → the deposit (non-null, already guaranteed at creation). amountCents must be > 0.
- Tests: each option maps right; full_deposit uses depositCents; cash still charges the fee; zero/negative rejected.

### Task 4: Checkout session creation
**Files:** `src/lib/payments/checkout.ts`, route `api/bookings/[id]/checkout/route.ts`.
- `createBookingCheckout(bookingId, origin)`: load booking (must be pending), recompute charge from its snapshot, upsert a `payments` row (status pending, type, amount, currency), call Stripe `checkout.sessions.create` (mode payment, inline price_data from the server amount, metadata {bookingId, paymentType}, success_url `${origin}/book/confirmation?id=${bookingId}`, cancel_url `${origin}/book?canceled=1`, omit payment_method_types), store `stripeCheckoutSessionId`, return the session url.
- Route POST returns `{ url }`; rate-limited; 409 if the booking isn't pending.

### Task 5: Webhook reducer (idempotent, tested offline)
**Files:** `src/lib/payments/webhook.ts`, route `api/webhooks/stripe/route.ts`, test.
- `processStripeEvent(event)`: dedupe by `event.id` (insert into stripe_webhook_events; if already present, no-op). On `checkout.session.completed` with payment_status paid (and `payment_intent.succeeded` as the belt-and-braces path): find the booking via metadata.bookingId, verify the paid amount/currency matches the expected charge, in one transaction mark the payment succeeded (store payment_intent id) and flip the booking pending→confirmed (only if still pending). Unknown/irrelevant events: ack + ignore.
- Route reads the RAW body, verifies with `constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`; on bad signature → 400; on success calls processStripeEvent → 200.
- Tests (offline): a paid `checkout.session.completed` confirms the booking + marks payment succeeded; the SAME event id twice is idempotent (booking confirmed once, one payment row); an amount mismatch does NOT confirm; an event for an already-confirmed/cancelled booking is a no-op; signature verification via `generateTestHeaderString` passes, a tampered body fails.

### Task 6: Hold expiry
**Files:** `src/lib/payments/holds.ts`, route `api/admin/maintenance/expire-holds/route.ts` (admin), test.
- `expireStaleHolds(ttlMinutes, now)`: set status cancelled on pending bookings whose `createdAt < now - ttl` AND have no succeeded payment; returns the count. Frees the slot (cancelled is outside the exclusion constraint). Admin route triggers it; the scheduled cron is Plan 07 ops.
- Tests: an old unpaid pending hold is cancelled; a paid/confirmed booking is untouched; a recent pending hold is untouched.

### Task 7: Booking status + flow wiring
**Files:** route `api/bookings/[id]/route.ts` (GET public status: id, status, dates, breakdown — no PII), `src/app/(public)/book/page.tsx` (on submit: create booking → POST checkout → redirect to Stripe url), `src/app/(public)/book/confirmation/page.tsx` (read ?id, fetch status, show pending/confirmed; handle ?canceled).
- The "Reserve my car" button now flows to Stripe; on return the confirmation shows the live status.

### Task 8: Verify + tag
- Full gate: typecheck, tests, build, boot. Webhook reducer + signature proven by offline tests; a live Stripe smoke needs real test keys (note in README how to run it). Confirm a pending booking flips to confirmed when `processStripeEvent` runs with a paid event (drive via a test-only injection or the verified webhook route with a generated signature).
- Commit per task; tag `phase2-05-payments`.

## Self-review
- §3 payment model: reservation fee online ✓; full-deposit-instead option ✓; cash-deposit path still charges the fee ✓; amounts server-computed + snapshotted ✓; Stripe handles cards (Checkout) ✓; signed webhook confirms ✓.
- Idempotency: event-id dedupe + status-guarded flip (only pending→confirmed) ✓.
- Unpaid-hold expiry frees the car ✓ (scheduled run = Plan 07).
- Restricted key recommended in .env.example; webhook secret separate; raw-body signature verification ✓.
- Refund path (reservation fee refundable/credited — spec §16 open item) deferred until the owner decides; the payments table + type already support recording it.

## Status
EXECUTED 2026-06-11 — tag `phase2-05-payments`. 128 tests green, build green. Live route test: a real-signed `checkout.session.completed` flips the booking pending→confirmed, a redelivered event is idempotent (deduped), a tampered body → 400. Charge math, hold expiry, and the webhook reducer (incl. amount-mismatch rejection + cancelled-booking guard) all unit-tested. Remaining for the owner: a live Stripe smoke with real test keys + `stripe listen` (the SDK call in checkout.ts is the only untested-against-network piece).
