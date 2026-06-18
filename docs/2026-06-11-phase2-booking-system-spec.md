# Tex Cars & Leasing, Phase 2: Online Booking + Operations Platform

**Date:** 2026-06-11 · **By:** saltycodestudio · **Status:** Draft spec, pending final review then build plan

This captures the agreed Phase 2 design from the planning session. Phase 1 (the static marketing
site) stays as is and links "Book online" across to this app.

---

## 1. Goal
A real, cloud-hosted booking and operations platform for Tex Cars. Customers book a car online,
lock it with a payment, provide a valid driver's license, and accept the rental terms. The owner runs
the whole business from a hardened admin dashboard: bookings, pricing, fees, add-ons, insurance,
upsells, policies, and guardrails. Security and login hardening are built in from the start using the
saltycodestudio-fort toolkit.

## 2. Hosting (fully online, nothing local)
Runs entirely on managed cloud services. The owner's computer is never part of running it.
- **App:** Next.js (App Router) on **Vercel**, at `app.tex-cars.com`
- **Database:** **Postgres** on Neon or Supabase (managed, backed up)
- **Query layer:** Drizzle (parameterized queries by default; Prisma is the alternative)
- **Rate-limit / token / lockout store:** Upstash Redis (serverless-friendly)
- **Payments:** Stripe
- **Email:** Resend (transactional)
- **File storage:** private object storage (Vercel Blob or S3) for license documents and car photos
- Scaffold from fort's `nextjs-route-handlers` starter so hardening is in place from line one.

## 3. Payment model (as specified by owner)
Every online booking is locked with money up front.
- Default: a **reservation fee** (owner set it at ~$30, editable in the dashboard) paid via Stripe.
  This is the show-up guarantee.
- At checkout the customer may instead **pay the full rental deposit online**, which replaces the
  reservation fee (single charge equal to the deposit).
- If the customer prefers to pay the rental deposit in **cash at pickup**, they still pay the
  reservation fee online to hold the car.
- All amounts are computed server-side and snapshotted on the booking. Stripe handles all card data;
  we never touch raw card data. Stripe webhooks (signed) confirm payment and flip the booking to
  confirmed.
- **To confirm:** deposit amount per car class; whether the reservation fee is refundable or credited
  toward the rental; currency (USD assumed).

## 4. Two-tier authentication
**Admin / staff (maximum lockdown):**
- Argon2id passwords (`password-hashing`)
- Mandatory TOTP 2FA via authenticator app (`authn-passwordless-mfa`)
- Hardened server-side sessions: httpOnly, Secure, SameSite, rotation on login, idle + absolute
  timeout (`authn-session`)
- Account lockout + progressive login throttling, per account and per IP (`account-security`)
- CSRF tokens on every state change (`csrf-protection`); every admin action audit-logged

**Customers (managed via email, passwordless):**
- Magic link / email OTP (`authn-passwordless-mfa`). No password to leak. Email verified in flow.
  Tokens short-lived, single-use, rate-limited.
- Customers can view and manage their own bookings.

## 5. Admin dashboard (central hub, every amount editable, no redeploy)
- **Bookings:** calendar and list, confirm, modify, cancel, change status, see payments
- **Fleet & pricing:** add/edit cars, photos, daily/weekly/monthly rates, deposit per car
- **Fees & settings:** reservation fee, currency, guardrail values, admin alert recipients,
  minimum driver age
- **Add-ons & equipment:** baby chairs, coolers, snorkel gear, etc. Each has price, per-day or
  per-rental setting, and optional stock count
- **Insurance:** tiers (e.g. Basic included, Premium paid) with daily price and coverage text
- **Upselling:** choose which add-ons, insurance tiers, or car upgrades surface in the booking flow
- **Policies:** edit Rental Terms, Cancellation & Refund, Privacy; versions are kept
- **Audit log:** every admin action, with sensitive data access recorded

## 6. Booking flow
Pick car and dates, choose insurance tier, add extras (the admin-controlled upsell step), enter
driver's license details, accept the terms, choose payment option (reservation fee or full deposit),
pay via Stripe, booking confirms on the signed webhook. Total is always server-computed.

## 7. Booking integrity & guardrails
- **No overlapping bookings:** enforced with a Postgres exclusion constraint on (vehicle + date
  range), so it is physically impossible even under a race, not just checked in code.
- **Idempotency** on booking creation and payment so a double-click or retry never makes two bookings
  or two charges (`idempotency-concurrency`).
- **Configurable in the dashboard:** turnaround buffer between rentals (cleaning), minimum and maximum
  rental length, how far ahead someone can book, blackout dates.
- **Equipment stock:** limited-stock add-ons (e.g. only 3 baby chairs) cannot be oversold across
  overlapping dates.
- **Minimum driver age:** date of birth from the license is checked against the editable minimum.

## 8. Driver's license capture (most sensitive data, handled with most care)
- Required at booking: name as on license, license number, issuing country, issue date, expiry date,
  date of birth.
- Checks: expiry must be in the future; DOB drives the minimum-age guardrail.
- Optional document photo, stored in private storage, opened only by admin via short-lived signed
  links, verified at pickup. (Automated ID verification like Stripe Identity can be added later.)
- Protection: encrypted at rest, TLS in transit, locked behind the admin role, every view audit-logged,
  never returned in any public response, and on a retention timer that auto-deletes the document a set
  period after the rental ends. Maps to `encryption-data-protection`, `file-upload-security`,
  `input-validation`, `api-bola-idor-mass-assignment`, `logging-audit-monitoring`.

## 9. Email & notifications (Resend)
- Admin alerts (recipients editable): new booking, payment received, cancellation, optional low-stock.
- Customer emails: login link / OTP, booking confirmation and receipt, pre-pickup reminder,
  cancellation notices.
- `email_log` records what was sent and when.

## 10. Policies & terms
- Editable in the dashboard: Rental Terms, Cancellation & Refund (incl. how the reservation fee is
  treated), Privacy Policy.
- Required acceptance step at checkout. We store the accepted version and timestamp on the booking and
  keep older versions for proof.

## 11. Rate limiting (`rate-limiting`, backed by Upstash Redis)
- Login: strict token bucket per IP and per account, then exponential backoff, then lockout.
- OTP / magic-link requests: tight cap (e.g. 3 per 10 min per email and per IP) against email-bombing
  and enumeration.
- Booking & payment endpoints: idempotency keys plus a per-IP cap.
- Global per-IP ceiling on the whole API as a backstop.

## 12. Data model (Postgres)
- **vehicles** (class, name, slug, seats, transmission, ac, doors, photos, daily/weekly/monthly rate,
  deposit amount, status)
- **availability_blocks** (vehicle, date range, reason)
- **customers** (email unique, name, phone, email_verified)
- **bookings** (vehicle, customer, start/end date, status, price-breakdown snapshot, insurance tier,
  payment option, reservation-fee vs deposit, accepted policy version + timestamp, idempotency key)
- **booking_add_ons** (booking, add_on, qty, price snapshot)
- **add_ons** (name, description, price, per-day or per-rental, category, optional stock, active)
- **insurance_tiers** (name, daily price, coverage description, is_default)
- **driver_license** (per booking: name, license number [encrypted], country, issue/expiry, DOB
  [encrypted], optional private document ref)
- **payments** (booking, Stripe payment-intent id, type [reservation-fee | deposit], amount, status)
- **admin_users** (email, Argon2id hash, role [owner | staff], TOTP secret, mfa_enabled,
  failed_attempts, locked_until)
- **policies** (type, version, body, published_at)
- **audit_log** (actor, action, entity, before/after, ip, ua, created_at)
- **email_log** (to, type, status, created_at)
- **settings** (reservation fee, currency, min driver age, turnaround buffer, min/max rental length,
  booking lead time, blackout dates, admin alert recipients)

## 13. Full fort pattern mapping
`password-hashing`, `authn-session`, `authn-passwordless-mfa`, `account-security`, `csrf-protection`,
`rate-limiting`, `authz-rbac-abac`, `api-bola-idor-mass-assignment`, `idempotency-concurrency`,
`input-validation`, `injection-prevention`, `payments-pci-ecom`, `webhook-signing-replay`,
`encryption-data-protection`, `file-upload-security`, `secure-headers-csp`, `cors`,
`secrets-management`, `logging-audit-monitoring`. Pre-launch checklists: `auth-checklist`,
`ecommerce-security`, `api-security-checklist`, `deployment-hardening`, `secrets-and-env`,
`owasp-top-10`. Blueprints to compose from: `examples/auth-service`, `examples/ecommerce`.

## 14. Build order (proposed)
1. Foundation: Next.js + Postgres + schema + secrets + secure headers, from the hardened starter
2. Admin auth first (security core): Argon2id + sessions + lockout + MFA + rate limiting + audit log
3. Admin fleet management: vehicle CRUD + photos + rates + deposits + availability blocks
4. Settings, add-ons, insurance, policies (the editable hub)
5. Public booking + concurrency: availability, exclusion constraint, idempotency, license capture,
   terms acceptance
6. Payments: Stripe reservation-fee / full-deposit options + signed webhooks
7. Customer accounts: passwordless email + my bookings
8. Email notifications (Resend) for admin and customers
9. Harden & verify: run every relevant fort checklist before go-live

## 15. Phase 1 hand-off contract (deep links the app must accept)
Phase 1's booking bridge (see `2026-06-11-phase1-phase2-bridge.md`) already emits these URLs;
the Phase 2 router must honor them from day one.
- **`GET /book`** — start of the booking flow, no preselection.
- **`GET /book?car=<vehicle-slug>`** — preselect a vehicle. Slugs are the `vehicles.slug` values
  (kebab-case, e.g. `kia-picanto`), seeded from Phase 1's `fleet.js`.
- **`GET /book?class=<class>&pickup=<YYYY-MM-DD>&return=<YYYY-MM-DD>`** — from the inquiry form.
  `class` is the exact canonical enum from `vehicles.class`: `Economy | Compact | SUV | 4x4 | Van`
  (display labels are localized in Phase 1, but the URL always carries the canonical value).
  Any of the three params may be absent.
- **Precedence:** if both `car` and `class` arrive, `car` wins.
- **Unknown or malformed params are ignored gracefully** (flow starts unpreselected; never a 404).
- **Policy pages:** `GET /policies/rental-terms`, `/policies/cancellation`, `/policies/privacy`
  must exist as public routes; Phase 1's footer links to them the moment the flag flips.

## 16. Open items to confirm before/within the build
- Deposit amount per car class
- Whether the reservation fee is refundable or credited toward the rental
- Currency (USD assumed)
- Staff logins needed, or owner only
- Exact insurance tiers and add-on list with prices
- License retention period after rental completion

## Next step
Final review of this spec, then turn it into a sequenced implementation plan (writing-plans), then
build phase by phase.
