# Phase 2 Plan 02: Admin Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Execution note: this plan is executed inline by the authoring session immediately after writing; novel security code is specified in full, mechanical CRUD/UI steps are specified by exact contract.

**Goal:** Maximum-lockdown admin authentication per spec §4: Argon2id login with per-account exponential lockout, Postgres-backed hardened sessions (idle + absolute timeout, rotation), mandatory TOTP MFA with replay defense and single-use recovery codes, CSRF on every state change, every auth event audit-logged, plus a minimal admin shell (login, MFA, dashboard frame).

**Architecture:** All security logic lives in `src/lib/auth/*` libs (unit-tested against PGlite); route handlers under `/api/admin/auth/*` stay thin. Sessions move from the starter's memory store (deleted this plan) to a `sessions` table storing only a SHA-256 hash of the session id; the cookie still carries the HMAC-signed raw id. TOTP secrets are encrypted with the existing AAD-bound field crypto. The TOTP core is ported from fort `authn-passwordless-mfa` (RFC 6238, ±1 step drift, last-used-step replay defense); lockout follows fort `account-security` (threshold + exponential backoff).

**Tech Stack:** existing foundation + `qrcode` (QR SVG for enrollment).

---

### Task 1: Schema — sessions, recovery codes, TOTP replay state
**Files:** Create `src/lib/db/schema/sessions.ts`; modify `src/lib/db/schema/admin.ts`, `schema/index.ts`; migration `0004_admin_auth`.

- [x] sessions: `idHash` text PK (sha256 of raw sid), `subjectType` pgEnum session_subject('admin','customer'), `subjectId` uuid, `csrfToken` text notNull, `mfaPending` boolean default false, `createdAt`, `lastSeenAt`, `expiresAt` (absolute), `ip` text, `ua` text. Index on (subjectType, subjectId).
- [x] admin_recovery_codes: id uuid pk, `adminUserId` fk cascade, `codeHash` text, `usedAt` timestamptz null; unique(adminUserId, codeHash).
- [x] admin_users add: `totpLastUsedStep` integer notNull default 0, `lockoutCount` integer notNull default 0.
- [x] Generate migration; tests insert/expire/uniqueness; commit.

### Task 2: TOTP lib (port of fort authn-passwordless-mfa §8-11)
**Files:** Create `src/lib/auth/totp.ts`, `src/test/totp.test.ts`.

- [x] Port base32Encode/Decode, hotp (SHA-1 dynamic truncation), currentStep (30s period, 6 digits, drift ±1).
- [x] `generateTotpSecret()` → 20 random bytes; `otpauthUri(label, base32)` URL-encoded, issuer "Tex Cars Admin".
- [x] `verifyTotp(secret, code, lastUsedStep)` → `{ ok, usedStep }`, constant-time compare, steps ≤ lastUsedStep rejected (replay).
- [x] Tests: RFC 6238 SHA-1 vector (ASCII secret `12345678901234567890`, T=59s → `287082`), replay rejection, ±1 drift accepted, ±2 rejected, malformed input rejected.

### Task 3: Postgres sessions
**Files:** Replace `src/lib/auth/session.ts` with DB-backed `src/lib/auth/sessions.ts`; delete `src/lib/auth/memory-store.ts`, old `session.ts`; rewrite `csrf.ts` import; delete `authz.ts` (replaced by admin-auth.ts in Task 5); tests.

- [x] Cookie value stays `<sid>.<HMAC-SHA256(sid, SESSION_SECRET)>` (pack/unpack kept). DB stores sha256(sid) only.
- [x] `createSession({subjectType, subjectId, mfaPending, ip, ua})` → cookie value + csrfToken; absolute expiry = now + SESSION_TTL_SECONDS.
- [x] `resolveSession(cookieValue)` → unpack, hash, load; reject if absolute-expired OR idle-expired (lastSeenAt + SESSION_IDLE_TTL_SECONDS); touch lastSeenAt (throttled to ≥60s since last touch).
- [x] `rotateSession(old)` → new sid/csrf (same subject, clears mfaPending per arg), deletes old row (login + MFA-completion rotation).
- [x] `destroySession`, `destroyAllForSubject` (future password change).
- [x] Env: add `SESSION_IDLE_TTL_SECONDS` default 1800.
- [x] Tests: roundtrip, tamper, idle expiry, absolute expiry, rotation invalidates old, hash-only storage (raw sid not in DB).

### Task 4: Lockout + login core (fort account-security)
**Files:** Create `src/lib/auth/admin-login.ts`, `src/test/admin-login.test.ts`.

- [x] `loginAdmin(email, password, ctx)` → constant-work flow: always run argon2 verify (dummy hash when user unknown); on failure increment failedAttempts; at threshold 5 engage lock: `lockedUntil = now + min(60s * 2^lockoutCount, 3600s)`, lockoutCount++; locked accounts reject before verify with retryAfter. Success resets failedAttempts (keeps lockoutCount decay simple: reset both). Generic error for all failures (no enumeration).
- [x] Returns `{ ok, adminId?, mfaEnabled?, retryAfterSec? }`.
- [x] Audit rows: `admin.login_failed`, `admin.lockout_engaged`, `admin.login_succeeded` (actor = admin id or "anonymous", ip/ua, no plaintext email in detail beyond entityId).
- [x] Tests: wrong password generic-fails, 5 failures lock, exponential growth, success resets, unknown email takes the dummy-verify path (no throw), locked rejects even with right password.

### Task 5: requireAdmin + audit helper
**Files:** Create `src/lib/auth/admin-auth.ts`, `src/lib/audit.ts`.

- [x] `audit({actor, action, entity, entityId, before, after, req})` → insert audit_log, never throws (logs on failure).
- [x] `requireAdmin(req, {allowMfaPending=false, roles=['owner','staff']})`: resolve session from SESSION_COOKIE; subjectType must be 'admin'; mfaPending sessions rejected unless allowed; enforce CSRF (csrf.ts) on unsafe methods; load admin_users row; role check; returns `{ admin, session }`; throws fort Errors.unauthorized/forbidden.

### Task 6: Auth routes
**Files:** `src/app/api/admin/auth/{login,logout,mfa/verify,mfa/enroll,mfa/enroll/confirm,me}/route.ts`.

- [x] POST login: zod body {email, password}; per-IP + per-email rate limit (starter rate-limit lib, auth budget); loginAdmin; set session cookie (mfaPending = admin.mfaEnabled) + CSRF cookie; respond `{ mfaRequired }` or `{ enrollRequired }` (mfaEnabled false). 401 generic otherwise; 429 with Retry-After when locked/throttled.
- [x] POST mfa/verify: requireAdmin(allowMfaPending); body {code} or {recoveryCode}; verifyTotp against decrypted secret + totpLastUsedStep persist, or atomic recovery-code consume (`UPDATE ... SET used_at = now() WHERE code_hash = $x AND used_at IS NULL RETURNING`); on success rotate session to full; audit.
- [x] POST mfa/enroll: requireAdmin (full session, only when mfaEnabled=false): generate secret, store encrypted (AAD `admin_users:${id}:totp_secret`) with mfaEnabled still false, create 8 recovery codes (store sha256, return plaintext once), return otpauth URI + manual key + QR data-URL (`qrcode`).
- [x] POST mfa/enroll/confirm: body {code}; verifyTotp; flip mfaEnabled=true; rotate session; audit `admin.mfa_enrolled`.
- [x] POST logout: destroy session, clear cookies; GET me: `{ email, role, mfaEnabled, mfaPending }`.

### Task 7: Admin shell UI
**Files:** `src/app/admin/{layout.tsx,page.tsx,login/page.tsx,mfa/page.tsx}`, `src/app/admin/admin.css`.

- [x] Server-side gate in layout: no valid full session → redirect /admin/login (mfaPending → /admin/mfa). Brand: Electric Blue #0044FF, Orange #FF4600, Navy #15192F; clean system/Inter, no external fonts.
- [x] login page: email+password form → fetch login → route to /admin/mfa (verify or enroll) or /admin.
- [x] mfa page: enroll mode (QR + manual key + one-time recovery codes + confirm code) and verify mode (6-digit input, recovery fallback).
- [x] dashboard page: greeting, fleet/bookings counts from db, "Plan 03+" placeholders.
- [x] All fetches send X-CSRF-Token from the csrf cookie.

### Task 8: Bootstrap CLI + verification
**Files:** `scripts/create-admin.ts`.

- [x] `npm run admin:create -- email@x.com` (password from TEX_ADMIN_PASSWORD env or generated + printed once); Argon2id hash; role owner; idempotent (refuses if email exists).
- [x] Full gate: typecheck, tests, build, boot, manual browser flow (login → enroll → TOTP code computed via totp lib → confirm → dashboard).
- [x] Commit + tag `phase2-02-admin-auth`.

## Self-review
- Spec §4 admin coverage: Argon2id ✓ lockout+throttle ✓ mandatory TOTP ✓ hardened sessions (httpOnly/Secure/SameSite/rotation/idle+absolute) ✓ CSRF ✓ audit ✓. §11 login rate limits ✓ (Redis upgrade in Plan 07).
- Customers (§4 passwordless) deliberately Plan 06; sessions table already supports subjectType 'customer'.
- Recovery codes: shown once, stored hashed, single-use atomic consume ✓ (fort failure #10).
