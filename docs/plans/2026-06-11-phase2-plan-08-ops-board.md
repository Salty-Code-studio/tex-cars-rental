# Phase 2 Plan 08: Interactive Operations Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executed inline. Security-critical/server logic tested against PGlite; board interactions verified live in the browser.

**Goal:** Make the admin planning board the live control surface — create rentals by drag-selecting the calendar, drag bars to move dates or reassign cars, block cars for maintenance/carwash, with the numberplate as each row's ID (spec: `docs/superpowers/specs/2026-06-11-ops-board-design.md`).

**Architecture:** Extend the existing schema (plate, block type, booking source/notes), add thin admin services + routes (`createManualBooking`, `moveBooking`, `cancelBookingAdmin`, block-with-type) all behind `requireAdmin` + audit, and make the board client component interactive with pointer-event drag (no library). The physical no-overlap-plus-buffer exclusion constraint validates every manual create and every move; admin paths skip only the soft date guardrails.

**Tech Stack:** existing foundation; no new deps.

---

### Task 1: Schema — plate, block type, booking source/notes
**Files:** Modify `src/lib/db/schema/fleet.ts`, `schema/bookings.ts`; migration `drizzle/0010_ops_board.sql` (hand-edited for the backfill); Test `src/test/ops-schema.test.ts`.

- [ ] **Step 1: Add columns to the schema**

In `fleet.ts`, add to `vehicles` after `slug`: `plate: text("plate").notNull().unique(),`. In `fleet.ts` add the block type enum + column to `availabilityBlocks`:
```ts
export const blockType = pgEnum("block_type", ["maintenance", "carwash", "cleaning", "out_of_service", "other"]);
// inside availabilityBlocks columns, after vehicleId:
  type: blockType("type").notNull().default("other"),
```
In `bookings.ts` add the source enum + columns to `bookings`:
```ts
export const bookingSource = pgEnum("booking_source", ["online", "manual"]);
// inside bookings columns, after status:
  source: bookingSource("source").notNull().default("online"),
  notes: text("notes"),
```

- [ ] **Step 2: Generate then hand-edit the migration**

Run: `npx drizzle-kit generate --name ops_board`
The generated `ADD COLUMN "plate" ... NOT NULL` fails on existing rows. Hand-edit `drizzle/0010_ops_board.sql` so plate is added nullable, backfilled, then constrained:
```sql
ALTER TABLE "availability_blocks" ADD COLUMN "type" "block_type" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source" "booking_source" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "plate" text;--> statement-breakpoint
UPDATE "vehicles" SET "plate" = 'A-' || lpad((row_number() OVER (ORDER BY created_at))::text, 4, '0') FROM (SELECT id, created_at, row_number() OVER (ORDER BY created_at) FROM "vehicles") AS s WHERE "vehicles".id = s.id AND "vehicles"."plate" IS NULL;
```
(If the window-function UPDATE is awkward in one statement, use the simpler portable form:)
```sql
UPDATE "vehicles" SET "plate" = 'A-' || substr(id::text, 1, 6) WHERE "plate" IS NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "plate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_plate_unique" UNIQUE("plate");
```
Keep the enum `CREATE TYPE` statements drizzle generated at the top.

- [ ] **Step 3: Test** `src/test/ops-schema.test.ts`

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, availabilityBlocks } from "@/lib/db/schema";
import { expectReject } from "./util";

let db: Awaited<ReturnType<typeof getDb>>;
beforeAll(async () => { db = await getDb(); await runMigrations(); });

describe("ops-board schema", () => {
  it("requires a unique plate", async () => {
    await db.insert(vehicles).values({ slug: "p1", plate: "A-111", class: "SUV", name: "P1", seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 1, priceWeekCents: 1, priceMonthCents: 1 });
    await expectReject(db.insert(vehicles).values({ slug: "p2", plate: "A-111", class: "SUV", name: "P2", seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 1, priceWeekCents: 1, priceMonthCents: 1 }), /unique|duplicate/i);
  });
  it("blocks carry a type with default other", async () => {
    const [v] = await db.insert(vehicles).values({ slug: "p3", plate: "A-333", class: "SUV", name: "P3", seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 1, priceWeekCents: 1, priceMonthCents: 1 }).returning();
    const [b] = await db.insert(availabilityBlocks).values({ vehicleId: v!.id, startDate: "2027-01-01", endDate: "2027-01-03", type: "maintenance" }).returning();
    expect(b!.type).toBe("maintenance");
  });
});
```
Run `npx vitest run src/test/ops-schema.test.ts` → PASS. Commit `feat(db): plate, block type, booking source/notes`.

### Task 2: Update existing inserts + seed for the new required plate
**Files:** Modify `scripts/seed.ts` (add plates to the 6 vehicles), and any test that inserts a vehicle without a plate (grep `insert(vehicles)` across `src/test`).

- [ ] **Step 1:** Add `plate` to each of the 6 seed vehicles in `scripts/seed.ts` (e.g. `plate: "A-0001"` … `"A-0006"`).
- [ ] **Step 2:** `grep -rln "insert(vehicles)" src/test` and add a `plate` to every vehicle insert that lacks one (use the slug, e.g. `plate: "T-" + slug.slice(0,5)`), since plate is now NOT NULL UNIQUE. Use distinct plates per test file.
- [ ] **Step 3:** `npm test` → all green. Commit `test: add plates to seed + test vehicle inserts`.

### Task 3: Manual booking service
**Files:** Create `src/lib/admin/manual-booking.ts`; Test `src/test/manual-booking.test.ts`.

- [ ] **Step 1: Implementation**

```ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { vehicles, customers, bookings } from "@/lib/db/schema";
import { Errors } from "@/lib/http/errors";
import { translateDbError } from "@/lib/db/errors";
import { getSettings } from "@/lib/admin/settings";

export const ManualBookingSchema = z.object({
  vehicleId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().max(40).default(""),
  customerEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  priceCents: z.number().int().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict().refine((v) => v.endDate > v.startDate, { message: "endDate must be after startDate", path: ["endDate"] });

export type ManualBookingInput = z.infer<typeof ManualBookingSchema>;

function syntheticEmail(phone: string, name: string): string {
  const slug = (phone || name).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20) || "walkin";
  return `walkin+${slug}-${Date.now().toString(36)}@tex-cars.local`;
}

export async function createManualBooking(input: ManualBookingInput) {
  const db = await getDb();
  const settings = await getSettings();
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId));
  if (!vehicle || vehicle.status === "retired") throw Errors.notFound("Vehicle not available");

  const email = input.customerEmail ?? syntheticEmail(input.customerPhone, input.customerName);
  await db.insert(customers).values({ email, name: input.customerName, phone: input.customerPhone }).onConflictDoNothing({ target: customers.email });
  const [customer] = await db.select().from(customers).where(eq(customers.email, email));

  const bufferEndDate = new Date(Date.parse(`${input.endDate}T00:00:00Z`) + settings.turnaroundBufferDays * 86_400_000).toISOString().slice(0, 10);
  const breakdown = { manual: true, subtotalCents: input.priceCents ?? 0, currency: settings.currency };
  try {
    const [booking] = await db.insert(bookings).values({
      vehicleId: vehicle.id, customerId: customer!.id,
      startDate: input.startDate, endDate: input.endDate, bufferEndDate,
      status: "confirmed", source: "manual", notes: input.notes ?? null,
      priceBreakdown: breakdown, paymentOption: "cash_deposit",
      acceptedPolicyVersion: 0, acceptedAt: new Date(),
      idempotencyKey: `manual-${customer!.id}-${input.startDate}-${input.endDate}-${Date.now().toString(36)}`,
    }).returning();
    return booking!;
  } catch (e) {
    const t = translateDbError(e); // 23P01 overlap+buffer → 409
    if (t) throw t;
    throw e;
  }
}
```

- [ ] **Step 2: Test** `src/test/manual-booking.test.ts`

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, settings, customers, bookings } from "@/lib/db/schema";
import { createManualBooking } from "@/lib/admin/manual-booking";
import { expectReject } from "./util";

let db: Awaited<ReturnType<typeof getDb>>;
let vehicleId = "";
beforeAll(async () => {
  db = await getDb(); await runMigrations();
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [v] = await db.insert(vehicles).values({ slug: "mb", plate: "MB-1", class: "SUV", name: "MB", seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000 }).returning();
  vehicleId = v!.id;
});

describe("manual booking", () => {
  it("creates a confirmed manual booking with a synthetic customer", async () => {
    const b = await createManualBooking({ vehicleId, startDate: "2027-02-01", endDate: "2027-02-04", customerName: "Walk In", customerPhone: "297111", priceCents: 18000 });
    expect(b.status).toBe("confirmed");
    expect(b.source).toBe("manual");
    const [c] = await db.select().from(customers).where(eq(customers.id, b.customerId));
    expect(c!.email).toMatch(/@tex-cars\.local$/);
  });
  it("rejects an overlapping manual booking (buffered exclusion constraint)", async () => {
    await createManualBooking({ vehicleId, startDate: "2027-03-01", endDate: "2027-03-05", customerName: "A", customerPhone: "1" });
    await expectReject(createManualBooking({ vehicleId, startDate: "2027-03-04", endDate: "2027-03-08", customerName: "B", customerPhone: "2" }), /no longer|already|overlap|conflict|not available|reservation/i);
  });
  it("allows same-day/near booking (soft guardrails skipped)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const b = await createManualBooking({ vehicleId, startDate: today, endDate: end, customerName: "Now", customerPhone: "9" });
    expect(b.id).toBeDefined();
  });
});
```
Run → PASS. Commit `feat(admin): manual booking service (confirmed, overlap-safe, synthetic customer)`.

### Task 4: Move + admin-cancel service
**Files:** Create `src/lib/admin/move-booking.ts`; Test `src/test/move-booking.test.ts`.

- [ ] **Step 1: Implementation**

```ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, vehicles } from "@/lib/db/schema";
import { Errors } from "@/lib/http/errors";
import { translateDbError } from "@/lib/db/errors";
import { getSettings } from "@/lib/admin/settings";

export const MoveSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();
export type MoveInput = z.infer<typeof MoveSchema>;

export async function moveBooking(id: string, input: MoveInput) {
  const db = await getDb();
  const settings = await getSettings();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!booking) throw Errors.notFound("Booking not found");
  if (booking.status !== "pending" && booking.status !== "confirmed") throw Errors.conflict("This booking can no longer be moved");

  const vehicleId = input.vehicleId ?? booking.vehicleId;
  const startDate = input.startDate ?? booking.startDate;
  const endDate = input.endDate ?? booking.endDate;
  if (endDate <= startDate) throw Errors.badRequest("Return must be after pick-up");
  if (input.vehicleId) {
    const [v] = await db.select({ status: vehicles.status }).from(vehicles).where(eq(vehicles.id, input.vehicleId));
    if (!v || v.status === "retired") throw Errors.notFound("Target vehicle not available");
  }
  const bufferEndDate = new Date(Date.parse(`${endDate}T00:00:00Z`) + settings.turnaroundBufferDays * 86_400_000).toISOString().slice(0, 10);
  try {
    const [updated] = await db.update(bookings).set({ vehicleId, startDate, endDate, bufferEndDate, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    return updated!;
  } catch (e) {
    const t = translateDbError(e);
    if (t) throw t;
    throw e;
  }
}

export async function cancelBookingAdmin(id: string) {
  const db = await getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!booking) throw Errors.notFound("Booking not found");
  if (booking.status === "cancelled" || booking.status === "completed") throw Errors.conflict("This booking can no longer be cancelled");
  const [updated] = await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
  return updated!;
}
```

- [ ] **Step 2: Test** `src/test/move-booking.test.ts` — create two vehicles + a booking; assert: date shift succeeds; reassign to the empty 2nd vehicle succeeds; a move that overlaps an existing booking on the target vehicle throws (409); a completed booking cannot move; admin cancel flips to cancelled and frees the slot (a new booking on the freed range succeeds). Use distinct dates/plates. Run → PASS. Commit `feat(admin): move + admin-cancel booking (overlap-validated)`.

### Task 5: Admin booking + block routes
**Files:** Create `src/app/api/admin/bookings/route.ts` (POST manual), `src/app/api/admin/bookings/[id]/move/route.ts` (PATCH), `src/app/api/admin/bookings/[id]/cancel/route.ts` (POST); Modify `src/lib/admin/vehicles.ts` `BlockSchema` (+ `type`) and `createBlock`, and the existing `vehicles/[id]/blocks` POST passes type through.

- [ ] **Step 1: BlockSchema gains type.** In `vehicles.ts`:
```ts
export const BlockSchema = z.object({
  startDate: isoDate, endDate: isoDate,
  type: z.enum(["maintenance", "carwash", "cleaning", "out_of_service", "other"]).default("other"),
  reason: z.string().trim().max(200).default(""),
}).strict().refine((v) => v.endDate > v.startDate, { message: "endDate must be after startDate", path: ["endDate"] });
```
And `createBlock` inserts `{ vehicleId, ...input }` (already spreads input → type flows through). Confirm the insert includes `type`.

- [ ] **Step 2: POST /api/admin/bookings** (manual create):
```ts
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { mutate } from "@/lib/admin/guard";
import { createManualBooking, ManualBookingSchema } from "@/lib/admin/manual-booking";
export const runtime = "nodejs";
export const POST = withRoute(async (req) => {
  const input = await parseJsonBody(req, ManualBookingSchema);
  const booking = await mutate(req, "admin.manual_booking_created", async () => {
    const row = await createManualBooking(input);
    return { result: row, entity: "booking", entityId: row.id, after: { source: "manual", vehicleId: row.vehicleId, startDate: row.startDate, endDate: row.endDate } };
  });
  return json({ id: booking.id }, req, { status: 201 });
});
```

- [ ] **Step 3: PATCH /api/admin/bookings/[id]/move**:
```ts
import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody, parseParams } from "@/lib/http/validate";
import { mutate } from "@/lib/admin/guard";
import { moveBooking, MoveSchema } from "@/lib/admin/move-booking";
export const runtime = "nodejs";
const ParamsSchema = z.object({ id: z.string().uuid() });
export const PATCH = withRoute(async (req, { params }) => {
  const { id } = parseParams(await params, ParamsSchema);
  const input = await parseJsonBody(req, MoveSchema);
  const updated = await mutate(req, "admin.booking_moved", async () => {
    const row = await moveBooking(id, input);
    return { result: row, entity: "booking", entityId: id, after: { vehicleId: row.vehicleId, startDate: row.startDate, endDate: row.endDate } };
  });
  return json({ id: updated.id, vehicleId: updated.vehicleId, startDate: updated.startDate, endDate: updated.endDate }, req);
});
```

- [ ] **Step 4: POST /api/admin/bookings/[id]/cancel** — mirror move route, call `cancelBookingAdmin`, action `admin.booking_cancelled`.

- [ ] **Step 5:** `npx tsc --noEmit && npm test` → green. Commit `feat(admin): manual booking + move + cancel routes; blocks carry a type`.

### Task 6: Planning data + Fleet UI gain plate and block type
**Files:** Modify `src/lib/admin/planning.ts` (include plate + block type + booking source/notes in the payload), `src/app/admin/(shell)/fleet/page.tsx` (plate input).

- [ ] **Step 1: planning.ts** — add `plate` to `PlanningVehicle`, `type` to the block shape, and `source` to `PlanningBar`. Select `vehicles.plate` in the vehicle query, `availabilityBlocks.type` in the block query, `bookings.source` in the booking query, and map them through.
- [ ] **Step 2: fleet/page.tsx** — add a `plate` field to the vehicle form state + the form grid (required), include it in the create/edit body, and show plate in the vehicle table. (The vehicle create/patch schema in `lib/admin/vehicles.ts` already `.strict()`; add `plate: z.string().trim().min(1).max(20)` to `VehicleCreateSchema`.)
- [ ] **Step 3:** `npx tsc --noEmit && npm test` → green. Commit `feat(admin): plate + block type + booking source in planning data and Fleet form`.

### Task 7: Interactive board — manual create, blocks, click-to-edit
**Files:** Modify `src/app/admin/(shell)/page.tsx` (the board); extend `admin.css`.

- [ ] **Step 1: Row label** shows plate bold + model small (`<b>{v.plate}</b><small>{v.name}</small>`).
- [ ] **Step 2: Drag-select** an empty range on a track → capture the start/end day cells via pointer events; open an action popover anchored there with two buttons: **New rental** and **Block car**.
- [ ] **Step 3: New rental popover** — form (customer name, phone, optional email/price/note), the selected dates shown; submit → `POST /api/admin/bookings` with the vehicleId + dates; on 201 reload planning; on 409 show "Those dates are taken".
- [ ] **Step 4: Block car popover** — type select (maintenance/carwash/cleaning/out_of_service/other) + optional note; submit → `POST /api/admin/vehicles/{id}/blocks` with type; reload.
- [ ] **Step 5: Click a bar** → details popover: customer/dates/status (or block type/note), with **Cancel** (bookings → `POST .../cancel`) and **Remove** (blocks → `DELETE /api/admin/blocks/{id}`); reload after.
- [ ] **Step 6: Color blocks by type** (CSS classes `pl-block--maintenance`, `--carwash`, etc.).
- [ ] **Step 7:** verify live in the browser (create a manual rental, block a car for maintenance, cancel a booking). Commit `feat(admin): create rentals + blocks + cancel directly on the planning board`.

### Task 8: Drag-to-move (dates + reassign)
**Files:** Modify `src/app/admin/(shell)/page.tsx`, `admin.css`.

- [ ] **Step 1:** On a booking bar `pointerdown`, start a drag: record the grabbed bar, its origin row + day offset, and the pointer origin. Render a floating ghost following the pointer.
- [ ] **Step 2:** On `pointermove`, compute the day delta (round to nearest column width) and the row under the pointer (track the `.pl-row` via elementFromPoint or row bounding boxes).
- [ ] **Step 3:** On `pointerup`, compute new `startDate`/`endDate` (shifted by the day delta, same length) and `vehicleId` (the row dropped on). If unchanged, no-op. Else `PATCH /api/admin/bookings/{id}/move` with the changed fields. Optimistically update the local state; on 409/4xx revert and show the message.
- [ ] **Step 4:** Respect reduced-motion / touch (drag is mouse/pointer; fall back to the click → Move form on touch). 
- [ ] **Step 5:** verify live: drag a bar a few days right (dates change), drag a bar onto another car (reassign), drag onto an occupied slot (rejected + revert). Commit `feat(admin): drag bookings to move dates or reassign cars on the board`.

### Task 9: Verify + tag
- [ ] Full gate: `npx tsc --noEmit && npm test && npm run build`.
- [ ] Live browser sweep: manual rental, block (maintenance), drag-move dates, drag-reassign car, drag-into-conflict (rejected), cancel, plate shown as ID, 30-row scroll (seed/add extra cars to confirm).
- [ ] Commit + tag `phase2-08-ops-board`.

## Self-review notes
- Spec coverage: manual quick rental ✓ (Task 3/5/7), plate-as-ID required+unique ✓ (Task 1/6/7), drag dates + reassign ✓ (Task 8), blocks with fixed types color-coded ✓ (Task 1/5/7), no-overlap+buffer enforced on create+move ✓ (exclusion constraint, Task 3/4), soft guardrails skipped for admin ✓ (manual/move validate end>start only).
- Synthetic email is unique per call (timestamp suffix) so the customer upsert never collides across walk-ins.
- `acceptedPolicyVersion: 0` on manual bookings = "terms handled at the desk"; the column is notNull so 0 is the sentinel.
- The exclusion constraint already spans `[start, bufferEnd)` (Plan 04), so manual create + move get buffer enforcement for free.
- 30-car scale is a CSS concern (sticky header/labels + vertical scroll); no query change beyond what Task 6 adds.
