# Phase 2 Plan 01: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hardened Next.js app scaffolded from the fort starter with the complete Phase 2 Postgres schema (including the physically-impossible-to-overlap booking constraint), field-level encryption, seeds, and a green test suite.

**Architecture:** Copy fort's `nextjs-route-handlers` starter, prune the JWT demo (sessions only per spec §4), add a Drizzle data layer with two drivers behind one factory: PGlite (real Postgres in WASM, zero install) for dev/tests, postgres-js for Neon in production. Migrations are drizzle-kit SQL files plus one hand-written migration for `btree_gist` + the bookings exclusion constraint. License PII is encrypted app-side with AES-256-GCM before it touches the database.

**Tech Stack:** Next.js 15, TypeScript strict, zod, argon2, drizzle-orm + drizzle-kit, @electric-sql/pglite, postgres (postgres-js), vitest.

**Working directory for all commands:** `~/Desktop/saltycodestudio-clients/tex-cars-rental/app`

---

### Task 1: Scaffold from the fort starter

**Files:** Create: entire `app/` from `~/Desktop/saltycodestudio-fort/starters/nextjs-route-handlers/`

- [x] **Step 1: Copy starter, init git**

```bash
cp -R ~/Desktop/saltycodestudio-fort/starters/nextjs-route-handlers ~/Desktop/saltycodestudio-clients/tex-cars-rental/app
cd ~/Desktop/saltycodestudio-clients/tex-cars-rental/app
git init -b main
```

- [x] **Step 2: Prune the JWT subsystem and demo resources** (spec uses sessions for admin + passwordless for customers; no JWT)

```bash
rm -rf src/app/api/auth/jwt src/app/api/notes src/lib/auth/jwt.ts
```

Remove from `src/env.ts`: the six `JWT_*` schema fields and the JWT lines of the distinct-secrets superRefine (keep `SESSION_SECRET` distinctness with the new `DATA_ENCRYPTION_KEY` instead, see Task 3). Remove `jose` from `package.json` dependencies. Remove JWT block from `.env.example`. Search-check: `grep -ri jwt src/ --include='*.ts'` must return nothing.

- [x] **Step 3: Rebrand package.json** — name `tex-cars-app`, description "Tex Cars & Leasing — booking + operations platform (Phase 2)".

- [x] **Step 4: Install and verify**

```bash
npm install
npx tsc --noEmit
```
Expected: 0 errors.

- [x] **Step 5: Commit** `chore: scaffold from fort nextjs-route-handlers starter (sessions-only)`

### Task 2: Test harness (vitest)

**Files:** Create: `vitest.config.ts`, `src/test/setup.ts`, `src/test/env.test.ts`

- [x] **Step 1: Install** `npm i -D vitest @vitest/coverage-v8`
- [x] **Step 2: Config + setup.** `src/env.ts` fails closed at import, so tests must inject a valid env before anything imports it.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    pool: "forks", // PGlite is single-connection; isolate per file
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

```ts
// src/test/setup.ts — valid test env BEFORE env.ts loads (values are test-only)
process.env.NODE_ENV ??= "test";
process.env.APP_ORIGIN ??= "http://localhost:3000";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";
process.env.SESSION_SECRET ??= "t".repeat(24) + "s".repeat(24);
process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL ??= "pglite://memory";
```

- [x] **Step 3: First test** (red until Task 3 adds the new env fields)

```ts
// src/test/env.test.ts
import { describe, it, expect } from "vitest";
describe("env", () => {
  it("loads a validated environment", async () => {
    const { env } = await import("@/env");
    expect(env.NODE_ENV).toBe("test");
    expect(env.DATABASE_URL).toBe("pglite://memory");
    expect(env.DATA_ENCRYPTION_KEY.length).toBe(32); // decoded bytes
  });
});
```

- [x] **Step 4:** Add `"test": "vitest run"` script. Run `npm test` — expected FAIL (DATABASE_URL/DATA_ENCRYPTION_KEY not in schema yet).
- [x] **Step 5: Commit** `test: vitest harness with fail-closed env injection`

### Task 3: Extend env for database + crypto

**Files:** Modify: `src/env.ts`, `.env.example`

- [x] **Step 1: Add to EnvSchema** (after SESSION fields):

```ts
    // Postgres connection. postgres:// for Neon/real Postgres,
    // pglite://memory or pglite://<dir> for the zero-install dev/test database.
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (v) => /^(postgres(ql)?|pglite):\/\//.test(v),
        "DATABASE_URL must start with postgres:// or pglite://",
      ),

    // 32-byte base64 key for AES-256-GCM field encryption (license PII).
    // Generate with: openssl rand -base64 32
    DATA_ENCRYPTION_KEY: z
      .string()
      .refine((v) => !looksLikePlaceholder(v), "DATA_ENCRYPTION_KEY still contains a placeholder")
      .transform((v, ctx) => {
        const buf = Buffer.from(v, "base64");
        if (buf.length !== 32) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)" });
          return z.NEVER;
        }
        return buf;
      }),
```

superRefine: replace the JWT distinctness check with `env.SESSION_SECRET !== env.DATA_ENCRYPTION_KEY-source` is moot (different types); keep only the session/key presence (no cross-check needed once JWT is gone). Document in `.env.example` with the same banner style as the existing blocks.

- [x] **Step 2:** `npm test` — expected: env test PASSES. `npx tsc --noEmit` clean.
- [x] **Step 3: Commit** `feat: DATABASE_URL + DATA_ENCRYPTION_KEY env validation`

### Task 4: Drizzle + the two-driver db factory

**Files:** Create: `src/lib/db/client.ts`, `drizzle.config.ts`, `src/lib/db/migrate.ts`. Replace: `src/lib/db/index.ts` (delete the in-memory reference store; sessions move to Postgres in Plan 02).

- [x] **Step 1: Install**

```bash
npm i drizzle-orm postgres @electric-sql/pglite
npm i -D drizzle-kit
```

- [x] **Step 2: Client factory** — one `getDb()` for the whole app:

```ts
// src/lib/db/client.ts
import { env } from "@/env";
import * as schema from "./schema";

export type Db = Awaited<ReturnType<typeof createDb>>;
let dbPromise: ReturnType<typeof createDb> | null = null;

async function createDb() {
  if (env.DATABASE_URL.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
    const { drizzle } = await import("drizzle-orm/pglite");
    const target = env.DATABASE_URL.slice("pglite://".length);
    const client = new PGlite(target === "memory" ? undefined : target, {
      extensions: { btree_gist },
    });
    return drizzle(client, { schema });
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const client = postgres(env.DATABASE_URL, { max: 10, prepare: false }); // prepare:false for pgbouncer/Neon pooling
  return drizzle(client, { schema });
}

export function getDb() {
  dbPromise ??= createDb();
  return dbPromise;
}
```

- [x] **Step 3: Migration runner** (works on both drivers):

```ts
// src/lib/db/migrate.ts
import { env } from "@/env";
import { getDb } from "./client";

export async function runMigrations() {
  const db = await getDb();
  if (env.DATABASE_URL.startsWith("pglite://")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  }
}
```

- [x] **Step 4: drizzle.config.ts**

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
});
```

- [x] **Step 5: Smoke test** `src/test/db.test.ts`: `getDb()` then `db.execute(sql\`select 1 as ok\`)` returns 1 (schema index can start empty `export {}`). Run `npm test` — PASS. Commit `feat: drizzle db factory (PGlite dev/test, postgres-js prod)`

### Task 5: Schema — fleet, customers, settings

**Files:** Create: `src/lib/db/schema/index.ts`, `src/lib/db/schema/fleet.ts`, `src/lib/db/schema/customers.ts`, `src/lib/db/schema/settings.ts`

- [x] **Step 1: fleet.ts**

```ts
import { pgTable, pgEnum, text, integer, boolean, timestamp, date, uuid, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const vehicleStatus = pgEnum("vehicle_status", ["active", "maintenance", "retired"]);

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  class: text("class").notNull(),
  name: text("name").notNull(),
  seats: integer("seats").notNull(),
  transmission: text("transmission").notNull(),
  ac: boolean("ac").notNull().default(true),
  doors: integer("doors").notNull(),
  photos: jsonb("photos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  priceDayCents: integer("price_day_cents").notNull(),
  priceWeekCents: integer("price_week_cents").notNull(),
  priceMonthCents: integer("price_month_cents").notNull(),
  depositCents: integer("deposit_cents"), // null until owner confirms per class (spec §16)
  status: vehicleStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const availabilityBlocks = pgTable("availability_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(), // exclusive bound, [) like bookings
  reason: text("reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("availability_blocks_dates", sql`${t.endDate} > ${t.startDate}`)]);
```

- [x] **Step 2: customers.ts**

```ts
import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(), // stored lowercased; normalize in app code
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [x] **Step 3: settings.ts** (single row, id pinned to 1; blackouts in their own table)

```ts
import { pgTable, integer, text, timestamp, date, jsonb, uuid, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  reservationFeeCents: integer("reservation_fee_cents").notNull().default(3000),
  currency: text("currency").notNull().default("USD"),
  minDriverAge: integer("min_driver_age").notNull().default(21),
  turnaroundBufferDays: integer("turnaround_buffer_days").notNull().default(1),
  minRentalDays: integer("min_rental_days").notNull().default(1),
  maxRentalDays: integer("max_rental_days").notNull().default(90),
  maxAdvanceDays: integer("max_advance_days").notNull().default(365),
  adminAlertRecipients: jsonb("admin_alert_recipients").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("settings_singleton", sql`${t.id} = 1`)]);

export const blackoutDates = pgTable("blackout_dates", {
  id: uuid("id").defaultRandom().primaryKey(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason").notNull().default(""),
}, (t) => [check("blackout_dates_dates", sql`${t.endDate} > ${t.startDate}`)]);
```

- [x] **Step 4:** `index.ts` re-exports all schema files. Generate + test: `npx drizzle-kit generate --name fleet_customers_settings`, write `src/test/schema-fleet.test.ts` (run migrations into PGlite, insert a vehicle, read it back, expect `settings` insert with id 2 to throw). `npm test` PASS.
- [x] **Step 5: Commit** `feat(db): vehicles, availability_blocks, customers, settings, blackout_dates`

### Task 6: Schema — bookings core + the exclusion constraint

**Files:** Create: `src/lib/db/schema/bookings.ts`, `src/lib/db/schema/catalog.ts` (add-ons + insurance), custom migration `drizzle/<n>_booking_overlap_guard.sql`, `src/test/booking-overlap.test.ts`

- [x] **Step 1: catalog.ts**

```ts
import { pgTable, pgEnum, text, integer, boolean, uuid } from "drizzle-orm/pg-core";

export const addonPricing = pgEnum("addon_pricing", ["per_day", "per_rental"]);

export const addOns = pgTable("add_ons", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  pricing: addonPricing("pricing").notNull().default("per_rental"),
  category: text("category").notNull().default("equipment"),
  stock: integer("stock"), // null = unlimited
  active: boolean("active").notNull().default(true),
});

export const insuranceTiers = pgTable("insurance_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  dailyPriceCents: integer("daily_price_cents").notNull().default(0),
  coverage: text("coverage").notNull().default(""),
  isDefault: boolean("is_default").notNull().default(false),
  active: boolean("active").notNull().default(true),
});
```

- [x] **Step 2: bookings.ts**

```ts
import { pgTable, pgEnum, text, integer, timestamp, date, uuid, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vehicles } from "./fleet";
import { customers } from "./customers";
import { addOns, insuranceTiers } from "./catalog";

export const bookingStatus = pgEnum("booking_status", ["pending", "confirmed", "cancelled", "completed"]);
export const paymentOption = pgEnum("payment_option", ["reservation_fee", "full_deposit", "cash_deposit"]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(), // exclusive, [)
  status: bookingStatus("status").notNull().default("pending"),
  priceBreakdown: jsonb("price_breakdown").notNull(), // server-computed snapshot, never client math
  insuranceTierId: uuid("insurance_tier_id").references(() => insuranceTiers.id),
  insuranceSnapshot: jsonb("insurance_snapshot"),
  paymentOption: paymentOption("payment_option").notNull(),
  acceptedPolicyVersion: integer("accepted_policy_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("bookings_dates", sql`${t.endDate} > ${t.startDate}`)]);

export const bookingAddOns = pgTable("booking_add_ons", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  addOnId: uuid("add_on_id").notNull().references(() => addOns.id),
  qty: integer("qty").notNull().default(1),
  priceSnapshotCents: integer("price_snapshot_cents").notNull(),
}, (t) => [check("booking_add_ons_qty", sql`${t.qty} > 0`)]);
```

- [x] **Step 3:** `npx drizzle-kit generate --name bookings_catalog`, then append a custom migration (`npx drizzle-kit generate --custom --name booking_overlap_guard`) containing:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "vehicle_id" WITH =,
    daterange("start_date", "end_date", '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));
```

- [x] **Step 4: The cornerstone test** `src/test/booking-overlap.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, customers, bookings } from "@/lib/db/schema";

let db: Awaited<ReturnType<typeof getDb>>;
let vehicleId: string, customerId: string;

const mkBooking = (start: string, end: string, key: string, status: "pending" | "confirmed" | "cancelled" = "confirmed") => ({
  vehicleId, customerId, startDate: start, endDate: end, status,
  priceBreakdown: { totalCents: 10000 }, paymentOption: "reservation_fee" as const,
  acceptedPolicyVersion: 1, acceptedAt: new Date(), idempotencyKey: key,
});

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  [{ id: vehicleId } = { id: "" }] = await db.insert(vehicles).values({
    slug: "test-car", class: "SUV", name: "Test Car", seats: 5, transmission: "Automatic",
    doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
  }).returning({ id: vehicles.id });
  [{ id: customerId } = { id: "" }] = await db.insert(customers).values({ email: "t@t.com" }).returning({ id: customers.id });
});

describe("bookings_no_overlap exclusion constraint", () => {
  it("accepts a booking", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-07-01", "2026-07-08", "k1"))).resolves.toBeDefined();
  });
  it("physically rejects an overlapping booking for the same vehicle", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-07-05", "2026-07-10", "k2"))).rejects.toThrow(/bookings_no_overlap|exclusion/i);
  });
  it("allows back-to-back ranges (exclusive end)", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-07-08", "2026-07-12", "k3"))).resolves.toBeDefined();
  });
  it("a cancelled booking frees its range", async () => {
    await db.insert(bookings).values(mkBooking("2026-08-01", "2026-08-05", "k4", "cancelled"));
    await expect(db.insert(bookings).values(mkBooking("2026-08-01", "2026-08-05", "k5"))).resolves.toBeDefined();
  });
  it("rejects duplicate idempotency keys", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-09-01", "2026-09-05", "k5"))).rejects.toThrow(/unique|duplicate/i);
  });
  it("rejects end <= start", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-10-05", "2026-10-05", "k6"))).rejects.toThrow(/bookings_dates|check/i);
  });
});
```

- [x] **Step 5:** `npm test` — all PASS. Commit `feat(db): bookings + add-ons + insurance with gist exclusion overlap guard`

### Task 7: Schema — licenses, payments, admin, policies, logs

**Files:** Create: `src/lib/db/schema/licenses.ts`, `src/lib/db/schema/payments.ts`, `src/lib/db/schema/admin.ts`, `src/lib/db/schema/logs.ts`

- [x] **Step 1: licenses.ts** (encrypted columns are `bytea` via customType)

```ts
import { pgTable, text, date, timestamp, uuid, customType } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";

export const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const driverLicenses = pgTable("driver_licenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id, { onDelete: "cascade" }),
  nameOnLicense: text("name_on_license").notNull(),
  licenseNumberEnc: bytea("license_number_enc").notNull(), // AES-256-GCM, see lib/crypto
  issuingCountry: text("issuing_country").notNull(),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  dobEnc: bytea("dob_enc").notNull(),
  documentRef: text("document_ref"), // private storage key, opened via short-lived signed URL
  retainUntil: timestamp("retain_until", { withTimezone: true }), // retention timer (spec §8)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [x] **Step 2: payments.ts**

```ts
import { pgTable, pgEnum, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";

export const paymentType = pgEnum("payment_type", ["reservation_fee", "deposit"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded"]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  type: paymentType("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: paymentStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [x] **Step 3: admin.ts**

```ts
import { pgTable, pgEnum, text, integer, boolean, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { bytea } from "./licenses";

export const adminRole = pgEnum("admin_role", ["owner", "staff"]);
export const policyType = pgEnum("policy_type", ["rental_terms", "cancellation", "privacy"]);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // Argon2id
  role: adminRole("role").notNull().default("owner"),
  totpSecretEnc: bytea("totp_secret_enc"), // encrypted; null until MFA enrolled
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policies = pgTable("policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: policyType("type").notNull(),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => [uniqueIndex("policies_type_version").on(t.type, t.version)]);
```

- [x] **Step 4: logs.ts**

```ts
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", { // append-only; no update/delete path in app code
  id: uuid("id").defaultRandom().primaryKey(),
  actor: text("actor").notNull(), // admin user id or "system"
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
  ua: text("ua"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  to: text("to").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("queued"),
  providerId: text("provider_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [x] **Step 5:** Re-export all from index.ts, `npx drizzle-kit generate --name licenses_payments_admin_logs`, extend schema test (insert admin user, two policy versions, expect duplicate (type,version) to throw). `npm test` PASS. Commit `feat(db): licenses, payments, admin_users, policies, audit/email logs`

### Task 8: Field-level crypto (license PII)

**Files:** Create: `src/lib/crypto/fields.ts`, `src/test/crypto-fields.test.ts`

- [x] **Step 1: Implementation** (fort `encryption-data-protection` pattern: AES-256-GCM, random IV, version prefix, auth tag)

```ts
// src/lib/crypto/fields.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/env";

const VERSION = Buffer.from([1]);
const IV_LEN = 12, TAG_LEN = 16;

/** Encrypt a UTF-8 string for at-rest storage. Layout: [v1][iv 12][tag 16][ciphertext]. */
export function encryptField(plaintext: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", env.DATA_ENCRYPTION_KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([VERSION, iv, cipher.getAuthTag(), ct]);
}

export function decryptField(stored: Buffer): string {
  if (stored[0] !== 1) throw new Error("Unknown ciphertext version");
  const iv = stored.subarray(1, 1 + IV_LEN);
  const tag = stored.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = stored.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", env.DATA_ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

- [x] **Step 2: Tests:** roundtrip; two encryptions of the same plaintext differ (random IV); flipped ciphertext byte throws; flipped tag byte throws; empty string roundtrips. `npm test` PASS.
- [x] **Step 3: Commit** `feat: AES-256-GCM field encryption for license PII`

### Task 9: Seed, health, final verification

**Files:** Create: `scripts/seed.ts`. Modify: `src/app/api/health/route.ts` (db ping), `package.json` scripts.

- [x] **Step 1: Seed** — settings row, three insurance-tier placeholders (Basic default $0, Standard, Premium), four add-on placeholders (baby chair, cooler, snorkel set, extra driver), and the six Phase 1 vehicles (from `site/data/fleet.js`, dollars → cents, photos `[]`). Idempotent: `onConflictDoNothing`. Script: `"db:seed": "node --import tsx scripts/seed.ts"`, plus `"db:migrate"` and `"db:generate"`.
- [x] **Step 2: Health** — extend the existing route to `SELECT 1` through `getDb()` and report `{ status: "ok", db: true }`; db failure → 503 (fail visible, not fail open).
- [x] **Step 3: Full gate**

```bash
npx tsc --noEmit && npm test && npm run build
```
Expected: 0 type errors, all tests green, production build succeeds.

- [x] **Step 4: Boot check** — `.env.local` from `.env.example` with real generated secrets + `DATABASE_URL=pglite://.dev-db`, `npm run dev`, `curl localhost:3000/api/health` → `{"status":"ok","db":true}`.
- [x] **Step 5: Commit + tag** `feat: seed script + db-aware health probe` then `git tag phase2-01-foundation`

## Self-review notes

- Spec §12 table coverage: vehicles ✓ availability_blocks ✓ customers ✓ bookings ✓ booking_add_ons ✓ add_ons ✓ insurance_tiers ✓ driver_license ✓ payments ✓ admin_users ✓ policies ✓ audit_log ✓ email_log ✓ settings ✓ (+ blackout_dates split out of settings for queryability).
- Equipment stock oversell (spec §7) is transactional app logic, deliberately Plan 04 — needs the booking-creation flow to exist.
- Sessions table lands in Plan 02 with admin auth (the starter's in-memory session store is deleted here; nothing uses it until then).
- `prepare: false` on postgres-js: required for Neon's pgbouncer pooled URLs.
- PGlite ships `btree_gist` as a loadable contrib extension; Task 4 Step 5's smoke test plus Task 6's constraint tests prove it before anything builds on it.
