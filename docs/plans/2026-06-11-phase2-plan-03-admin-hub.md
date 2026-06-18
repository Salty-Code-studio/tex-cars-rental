# Phase 2 Plan 03: Admin Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Executed inline by the authoring session.

**Goal:** The editable operations hub (spec §5, §10): every amount and policy the owner controls without a redeploy — fleet & pricing, settings & guardrails, add-ons, insurance tiers, versioned policies, blackout dates — plus a read-only audit viewer. All behind `requireAdmin`, all mutations audit-logged and CSRF-protected.

**Architecture:** Thin route handlers under `/api/admin/*` delegate to per-resource service modules in `src/lib/admin/*` (zod schemas + Drizzle ops + audit writes), so authz/validation/audit are uniform and unit-testable against PGlite. Money is stored and transported as integer cents; the UI converts dollars. Policies are append-only versions (publish a new row, never mutate). Admin UI pages live under `src/app/admin/(shell)/*` and reuse the Plan 02 gate.

**Tech Stack:** existing foundation; no new dependencies.

---

### Task 1: Shared admin mutation plumbing
**Files:** `src/lib/admin/money.ts`, `src/lib/admin/guard.ts`, tests.
- `centsField` zod (int ≥ 0), `optionalCentsField`, `dollarsToCents`/`centsToDollars`.
- `mutate(req, action, fn)`: runs `requireAdmin` (full session), calls `fn(adminCtx)`, audit-logs `{action}` with before/after, returns the result. `read(req, fn)`: requireAdmin then fn (GET, no CSRF needed since safe method).
- Tests: money roundtrip + rejection of negatives/floats.

### Task 2: Settings + blackout dates
**Files:** `src/lib/admin/settings.ts`; routes `api/admin/settings/route.ts` (GET, PATCH), `api/admin/blackouts/route.ts` (GET, POST), `api/admin/blackouts/[id]/route.ts` (DELETE); tests.
- PATCH settings: partial zod (all fields optional, validated ranges: fee ≥ 0, minDriverAge 16-99, buffers ≥ 0, min ≤ max rental, currency 3-letter, recipients = email[]); upsert the id=1 row.
- Blackouts: list, create {startDate,endDate,reason} (end > start), delete by id.
- Tests: partial update persists, range rejection, blackout create/delete, end≤start rejected.

### Task 3: Vehicles CRUD + availability blocks
**Files:** `src/lib/admin/vehicles.ts`; routes `api/admin/vehicles/route.ts` (GET,POST), `vehicles/[id]/route.ts` (GET,PATCH,DELETE), `vehicles/[id]/blocks/route.ts` (GET,POST), `blocks/[id]/route.ts` (DELETE); tests.
- Create/update: zod {slug (kebab), class, name, seats, transmission, ac, doors, photos[], priceDay/Week/MonthCents, depositCents?, status}. Slug unique (409 on conflict). DELETE: 409 if the vehicle has bookings (FK guard) — soft path: set status 'retired' instead; expose both (DELETE retires, hard delete only if no bookings/blocks).
- Blocks: list/create/delete per vehicle (end > start).
- Tests: create, slug conflict 409, patch rates, retire vs delete, block create/overlap-irrelevant, list.

### Task 4: Add-ons + insurance tiers CRUD
**Files:** `src/lib/admin/catalog.ts`; routes `api/admin/addons/route.ts`, `addons/[id]/route.ts`, `api/admin/insurance/route.ts`, `insurance/[id]/route.ts`; tests.
- Add-ons: {name, description, priceCents, pricing(per_day|per_rental), category, stock?, active}.
- Insurance: {name, dailyPriceCents, coverage, isDefault, active}; setting isDefault=true clears it on the others (single default, transactional).
- Tests: CRUD both, single-default invariant, stock null allowed.

### Task 5: Versioned policies
**Files:** `src/lib/admin/policies.ts`; routes `api/admin/policies/route.ts` (GET all latest+history, POST publish), tests.
- POST {type, body}: compute next version = max(version for type)+1, insert, set publishedAt. Never UPDATE an existing version.
- GET: latest per type + counts.
- Tests: first publish = v1, second = v2, history preserved, body required.

### Task 6: Audit viewer (read-only)
**Files:** route `api/admin/audit/route.ts` (GET, paginated, newest first, ?limit&?before); page renders it.
- No mutation path. Tests: returns rows newest-first, respects limit.

### Task 7: Admin UI pages
**Files:** `src/app/admin/(shell)/{fleet,settings,catalog,policies,audit}/page.tsx` + small client components; extend the sidebar.
- Fleet: vehicle table (server) + add/edit form (client, dollars↔cents), retire/delete, per-vehicle blocks editor.
- Settings: one form for all settings + blackout list.
- Catalog: add-ons table+form and insurance tiers table+form on one page.
- Policies: per-type current body editor that publishes a new version; shows version number + history count.
- Audit: read-only table (time, actor, action, entity).
- Sidebar links become live; brand styles reused.

### Task 8: Verify + tag
- Full gate: typecheck, tests, build, boot, browser smoke (login→MFA→edit a vehicle, change the reservation fee, publish a policy, see the audit entries appear).
- Commit per task; tag `phase2-03-admin-hub`.

## Self-review
- Spec §5 coverage: bookings (Plan 04 view) · fleet+pricing+deposits ✓ · fees+settings+guardrails+alert recipients+min age ✓ · add-ons w/ stock ✓ · insurance tiers ✓ · upsell visibility via `active` flags ✓ · policies versioned ✓ · audit log ✓.
- §10 policies acceptance is Plan 04 (booking checkout); here we only author/version them.
- Every mutation: requireAdmin + CSRF (via requireAdmin) + audit. Reads: requireAdmin, no CSRF (safe method).

## Status
EXECUTED 2026-06-11 — tag `phase2-03-admin-hub`. 75 tests green, build green. All 8 tasks done. Live browser test: edited a vehicle's rate + deposit, changed the reservation fee, published a rental-terms policy, created an add-on; a CSRF-forged PATCH was blocked (403); the audit log captured every action.
