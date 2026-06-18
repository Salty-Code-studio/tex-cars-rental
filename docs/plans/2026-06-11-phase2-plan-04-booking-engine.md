# Phase 2 Plan 04: Booking Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executed inline by the authoring session. Security-critical logic specified in full + tested; UI specified by contract.

**Goal:** The public booking flow (spec §6, §7, §8): a customer picks a car and dates, gets a server-computed quote, chooses insurance + extras, enters and we encrypt their driver's licence, accepts the current terms, and we create a `pending` booking that the Postgres exclusion constraint guarantees can't double-book. Payment (Stripe) is Plan 05; this plan ends with a confirmed-pending booking and its price snapshot.

**Architecture:** Pure pricing/guardrail logic in `src/lib/booking/*` (unit-tested against PGlite), thin public routes under `src/app/api/{vehicles,insurance,addons,policies,quote,availability,bookings}`. Totals are ALWAYS server-computed and snapshotted on the booking (never trust client money). Creation runs in one `db.transaction`: upsert customer, insert booking (exclusion constraint = hard no-overlap), insert booking_add_ons, insert encrypted driver_licence. Idempotency key makes a double-submit return the same booking, never two. Licence PII uses the Plan 01 AAD-bound field crypto; `retainUntil = endDate + settings.licenseRetentionDays`.

**Tech Stack:** existing foundation; no new deps.

---

### Task 1: Settings — licence retention period
**Files:** `schema/settings.ts` (+ `licenseRetentionDays` int default 90), migration `0006`, `lib/admin/settings.ts` (schema field + range 1-3650), settings UI field; test.
- Booking creation needs it to set `driver_licenses.retainUntil`. Spec §16 open item; default 90 days, editable.

### Task 2: Quote engine
**Files:** `src/lib/booking/quote.ts`, test.
- `rentalDays(start, end)` = whole days, end exclusive.
- `bestVehicleCents(days, {day,week,month})` = exact cheapest tiered price via DP: `cost[n]=min(cost[n-1]+day, cost[n-7]+week, cost[n-30]+month)` (so a 6-day rental priced at the cheaper weekly rate is handled). 
- `quote({vehicle, days, insuranceTier?, addOns:[{addOn, qty}], settings})` → breakdown `{ days, vehicleCents, insuranceCents, addOns:[{id,name,qty,cents}], addOnsCents, subtotalCents, depositCents|null, reservationFeeCents, currency }`. Insurance = dailyPrice*days. Add-on per_rental = price*qty; per_day = price*days*qty.
- Tests: 1 day = daily; 7 days = min(7·day, week); 30 = min(...,month); 10-day decomposition; weekly-cheaper-than-6-daily; insurance + add-on math; deposit null passthrough.

### Task 3: Guardrails + availability
**Files:** `src/lib/booking/availability.ts`, test.
- `validateDates(start, end, settings, today)` → throws `Errors.badRequest`/`validation` on: end≤start, length < minRentalDays or > maxRentalDays, start in the past, start > today+maxAdvanceDays.
- `checkAvailability(vehicleId, start, end, settings)` → `{ available: boolean, reason?: string }`: vehicle active; no overlapping booking (status pending|confirmed); no overlapping availability_block; no overlapping blackout_date; turnaround buffer respected (no booking whose [start, end+buffer) overlaps). Pure read; the DB exclusion constraint is the hard guarantee at insert.
- Tests: valid passes; past/short/long/too-far rejected; overlapping booking unavailable; blackout unavailable; block unavailable; buffer gap enforced; back-to-back beyond buffer allowed.

### Task 4: Licence capture
**Files:** `src/lib/booking/license.ts`, test.
- `ageOn(dob, date)`; `validateLicense(license, {minDriverAge, rentalStart, rentalEnd})` → throws on: expiry ≤ rentalEnd (must stay valid through return), age < minDriverAge at rentalStart, malformed dates.
- `encryptLicense(bookingId, license)` → returns row values with `licenseNumberEnc`/`dobEnc` via `encryptField(value, \`driver_licenses:${bookingId}:license_number|dob\`)`.
- Tests: under-age rejected, expired/expiring-before-return rejected, valid passes, age boundary exactly minDriverAge passes, encrypted fields decrypt back.

### Task 5: Booking creation (the transaction)
**Files:** `src/lib/booking/create.ts`, test.
- `createBooking(input)` where input = `{ vehicleSlug, startDate, endDate, customer:{email,name,phone}, insuranceTierId?, addOns:[{addOnId,qty}], license, paymentOption, idempotencyKey }`.
- Steps: load settings + vehicle (by slug, active) → validateDates → validateLicense → checkAvailability (pre-check) → server quote → stock check for limited add-ons (sum committed qty over overlapping pending|confirmed bookings + requested ≤ stock) → if paymentOption=full_deposit require vehicle.depositCents not null.
- Idempotency: if a booking with idempotencyKey exists, return it (replay).
- `db.transaction`: upsert customer by email (emailVerified stays false); insert booking (status pending, priceBreakdown snapshot, paymentOption, acceptedPolicyVersion = current rental_terms version, acceptedAt=now, idempotencyKey); insert booking_add_ons (price snapshots); insert encrypted driver_licence (retainUntil = end + licenseRetentionDays). Catch 23P01 → `Errors.conflict("Those dates are no longer available")`; catch 23505 on idempotencyKey (race) → return existing.
- Returns `{ booking, breakdown }`. License plaintext NEVER in the response.
- Tests: happy path creates booking+addons+licence; overlap second booking rejected (conflict); idempotent replay returns same booking id, no duplicate; stock oversell rejected; full_deposit with null deposit rejected; under-age rejected end-to-end; price snapshot matches server quote.

### Task 6: Public read + quote/availability APIs
**Files:** routes `api/vehicles` (GET active+rates), `api/insurance` (GET active), `api/addons` (GET active), `api/policies/[type]` (GET current), `api/quote` (POST), `api/availability` (GET). Public (no admin), global rate limit.
- `api/vehicles` returns active vehicles with class/name/slug/seats/transmission/ac/doors/photos/rates/deposit (NO internal fields beyond what the booking UI needs).
- `api/quote` body `{ vehicleSlug, startDate, endDate, insuranceTierId?, addOns? }` → breakdown (validates dates, 422 on bad).
- `api/availability?vehicle=slug&pickup&return` → `{ available, reason? }`.
- Tests via the create/quote lib already cover logic; these are thin.

### Task 7: Booking API + public pages
**Files:** route `api/bookings` (POST, rate-limited, idempotency from `Idempotency-Key` header or body); pages `src/app/book/page.tsx` (the flow the Phase 1 deep links hit: `?car=slug` / `?class=&pickup=&return=`), `src/app/policies/[type]/page.tsx` (renders current version — Phase 1 footer links here), `src/app/book/confirmation`.
- `/book`: select vehicle (preffrom `?car`/`?class`), dates (prefrom query), live quote, insurance + add-on pickers, licence form, terms checkbox (links to /policies/*), payment-option choice, submit → `/book/confirmation?id=`. Payment is stubbed with a "Payment in Plan 05" notice; booking is created pending.
- Public layout/CSS (reuse brand tokens; not the admin shell).
- Tests: booking POST happy path + idempotency header replay + overlap 409 (integration via fetch in a boot smoke, or lib-level already covered).

### Task 8: Verify + tag
- Full gate: typecheck, tests, build, boot, browser smoke (open /book?car=hyundai-creta, get a quote, fill licence, accept terms, submit, see confirmation + a pending booking in the admin dashboard count; verify the licence row is encrypted in the DB).
- Commit per task; tag `phase2-04-booking-engine`.

## Self-review
- §6 flow: car+dates ✓ insurance ✓ extras ✓ licence ✓ terms acceptance ✓ payment-option recorded ✓ (Stripe charge = Plan 05) · server-computed total ✓.
- §7 integrity: no-overlap via exclusion constraint ✓ + idempotency ✓ + turnaround buffer ✓ + min/max length ✓ + lead/advance ✓ + blackout ✓ + equipment stock (txn check, residual race documented) ✓ + min driver age ✓.
- §8 licence: required fields ✓ expiry-future ✓ DOB→age ✓ encrypted at rest (AAD) ✓ never in responses ✓ retention timer (retainUntil) ✓ (auto-delete job = Plan 07 ops).
- Customer is upserted unverified here; passwordless verification + "my bookings" = Plan 06. Pending-hold expiry for unpaid bookings = Plan 05 (lives with payment timing).

## Status
EXECUTED 2026-06-11 — tag `phase2-04-booking-engine`. 110 tests green, build green. Live browser E2E via the Phase 1 deep link /book?car=hyundai-creta: live quote (7-day weekly $348, $250 deposit, $40 reservation fee), booking POST → pending; idempotent replay (200, same id); overlap → 409; under-age → 400; licence number+DOB confirmed encrypted at rest (version byte 01, plaintext absent, decrypts only with bound AAD), retainUntil set.
