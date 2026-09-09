# Tex Cars WhatsApp Request Quiz, Site Side, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four step WhatsApp request quiz at `tex-cars.com/book/` on the static marketing site, and repoint every booking surface on the site at it.

**Architecture:** A new plain script `site/scripts/quiz.js` drives a new static page `site/book/index.html`, which loads exactly four scripts and nothing else. All pure logic (Aruba date helpers, the estimator, the phone normaliser, the WhatsApp message builder) is defined at the top of `quiz.js` and exported on `window.TEX_QUIZ`, so a Node test harness can load the real shipped file through `node:vm` with stub DOM globals and assert on it without a bundler; the DOM layer boots only on `DOMContentLoaded`, so loading the file in Node does no DOM work.

**Tech Stack:** Plain ES2020 browser JavaScript (no build step, no bundler, no framework), static HTML, hand written CSS on the existing `tokens.css` custom properties, Node 22 built in test runner (`node --test`) plus `node:vm` for the harness, `python3 -m http.server` for manual checks.

## Global Constraints

- No em dash and no double hyphen anywhere in prose, in copy, in comments or in commit messages. Long command flags in shell commands are exempt.
- Scope discipline, the owner's explicit instruction: "don't change anything I didn't ask for". Everything in spec sections 4, 5, 6 and 11 is in scope, plus two things the owner added on 2026-09-09: the three homepage claims that stop being true once the wizard is fenced (Task 16) and the copy review sheet (Task 18). Nothing else is. No drive-by refactors, no reformatting, no dependency bumps, no renaming, no cleanups the spec does not name.
- No deploy. This plan stops at "built and tested locally". No `git subtree push`, no `git push`, no `wrangler deploy`, no `crane push`, no `npm run db:migrate`. Spec section 14 is out of scope.
- This is the parent repo only: `/Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental`. The app at `app/` is a separate git repo and is excluded by `.gitignore:2`. Never `git add app/`.
- The quiz page loads EXACTLY four scripts: `data/config.js`, `data/fleet.js`, `scripts/i18n.js`, `scripts/quiz.js`. NOT `main.js`. NOT `booking-bridge.js`.
- The quiz page does NOT contain the `.wa-float` markup at all. Not hidden with CSS, simply not on the page.
- WhatsApp handoff is same tab, on a real anchor, with NO `target` attribute anywhere on the quiz page. Timeout 4000 ms.
- The WhatsApp anchor's `href` is written BEFORE the fetch is fired.
- Guardrail G1: WhatsApp opens in every case, including save failure, timeout, 4xx, 5xx, offline and JavaScript disabled.
- Guardrail G2: the quiz never reserves anything and never checks availability.
- Only English and Dutch. `site/scripts/i18n.js:12` sets `SUPPORTED = ['en', 'nl']`. Copy goes through the existing `data-en` / `data-nl` engine, NOT a duplicated `/nl/` directory.
- Retention number 90 appears in the consent line and must match the app side constant exactly.
- The consent line and the estimate sentence are legal and commercial commitments. Copy them verbatim from the spec, character for character.
- Currency rule is `priceCfg()` from `site/scripts/main.js:11-15`: `pap` gives Aruban florin (`priceDay`, `priceWeek`, `priceMonth`), every other language gives US dollars (`usdDay`, `usdWeek`, `usdMonth`). That function returns exactly four keys, `{ sym, day, week, month }`, and **no deposit key at all**. The deposit is not part of the currency helper: it sits on every car in `site/data/fleet.js` as `deposit` (Afl. 500) and `usdDeposit` ($250). Spec section 5 needs the deposit footnote, so the quiz's own `priceCfg` adds a fifth field, `depositKey`, which names one of those two car fields. In practice USD today, because `pap` is not in `SUPPORTED`.
- The estimate the quiz **stores** is computed from the same clamped language the payload sends (`nl` or `en`), never from the raw language. The server derives `estimate_currency` from the `lang` it receives, so computing the number from a raw `pap` would store a florin figure labelled USD.
- The estimate re-renders on the `langchange` event (`i18n.js:40`).
- Tests live in `tools/site-tests/` at the parent repo root, deliberately OUTSIDE `site/`, so they never reach the public `gh-pages` tree.

---

## File Structure

| File | Created or modified | Single responsibility |
| - | - | - |
| `tools/site-tests/harness.mjs` | Create | Loads the real shipped `config.js`, `fleet.js`, `quiz.js` and `i18n.js` into a `node:vm` context with stub DOM globals, and hands back `window.TEX_QUIZ`. |
| `tools/site-tests/quiz-pure.test.mjs` | Create | Unit tests for the pure functions: Aruba date helpers, the estimator, the phone normaliser, the message builder. |
| `tools/site-tests/markup.test.mjs` | Create | Static assertions on the shipped HTML, CSS, JS and sitemap that a repo with no build step cannot otherwise guard. |
| `tools/site-tests/README.md` | Create | How to run the tests and how the vm harness works. |
| `site/book/index.html` | Create | The quiz page: four steps, the send screen, exactly four script tags, no `.wa-float`, a `noscript` fallback anchor. |
| `site/scripts/quiz.js` | Create | The quiz engine: pure helpers on `window.TEX_QUIZ`, plus the DOM layer that boots on `DOMContentLoaded`. |
| `site/styles/main.css` | Modify: append a new block at the end | Quiz styles on the existing tokens, including the 44 px calendar cells and the 2 px grid gap. |
| `site/data/config.js` | Modify: `:20-30` | Add the `requestsOn` kill switch mirroring `bookingEnabled`. |
| `site/data/fleet.js` | Modify: `:1-17` | Add the comment noting the app side allowlist duplicate. |
| `site/scripts/i18n.js` | Modify: `:14-20` and `:39` | Guard both `localStorage` calls with try/catch. |
| `site/index.html` | Modify: `:62`, `:102`, `:222`, `:278-330`, `:346`, `:356`, `:386`, `:403` | Retire the inquiry form, repoint three booking anchors, fix the `rental_terms` 404, and rewrite the three claims the quiz no longer keeps. |
| `site/scripts/main.js` | Modify: `:17-20`, `:100`, `:127-140`, `:178-204`, `:206-244`, `:255-257` | `bookUrl` returns `/book/?car=slug`; remove the code that existed only to serve the retired inquiry form. |
| `site/sitemap.xml` | Modify: `:3-6` | Add `/book/`. |
| `docs/QUIZ-COPY-FOR-APPROVAL.md` | Create | Every customer facing string this work invents that the spec did not already write out, English and Dutch side by side, for Tex to approve in one pass. |

Every `site/index.html` line number in that row is read off the file as it stands today (426 lines). Task 13 retires the inquiry form and shortens the file by 41 lines, so `:346`, `:356`, `:386` and `:403` move up by 41 from that commit onward. Each task that touches one of them cites both the number and a literal string to search for, because the search string cannot go stale.

---

## Task 1: The Node test harness and the pure function seam

**Files:**
- Create: `tools/site-tests/harness.mjs`
- Create: `tools/site-tests/README.md`
- Create: `site/scripts/quiz.js` (pure helpers only in this task)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `loadSite(): { window, document, pure, listeners }` from `harness.mjs`, where `pure` is `window.TEX_QUIZ`.
  - `window.TEX_QUIZ.isoOf(y: number, mZeroBased: number, d: number): string`
  - `window.TEX_QUIZ.arubaTodayISO(): string`
  - `window.TEX_QUIZ.addDaysISO(iso: string, n: number): string`
  - `window.TEX_QUIZ.daysBetween(fromISO: string, untilISO: string): number`
  - `window.TEX_QUIZ.MAX_SPAN_DAYS: 90`, `MAX_AHEAD_DAYS: 365`, `MAX_AHEAD_MONTHS: 12`, `NOTE_MAX: 200`, `NOTE_COUNTER_FROM: 150`, `SEND_TIMEOUT_MS: 4000`

- [ ] **Step 1: Write the failing test**

Create `tools/site-tests/harness.mjs`:

```js
/* Loads the real shipped site scripts into a node:vm context with stub DOM
   globals, so the pure helpers can be unit tested without a bundler and
   without a browser. The site has no build step, so the file under test is
   byte for byte the file that ships. */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE = join(REPO, 'site');

export function read(rel) {
  return readFileSync(join(SITE, rel), 'utf8');
}

/* A stub element good enough for the top level of a plain script: it records
   listeners and answers every query with nothing, so no DOM layer can run. */
function stubDoc(listeners) {
  return {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    documentElement: { lang: 'en' },
    body: { classList: { contains: () => false, add() {}, remove() {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  };
}

export function loadSite({ files = ['data/config.js', 'data/fleet.js', 'scripts/quiz.js'], storage = null } = {}) {
  const listeners = {};
  const dispatched = [];
  const window = {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { dispatched.push(ev); return true; },
    location: { search: '' },
  };
  window.window = window;
  const context = createContext({
    window,
    document: stubDoc(listeners),
    navigator: { language: 'en-GB' },
    localStorage: storage,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
  });
  for (const file of files) runInContext(read(file), context, { filename: file });
  return { window, document: context.document, pure: window.TEX_QUIZ, listeners, dispatched };
}
```

Create `tools/site-tests/quiz-pure.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSite } from './harness.mjs';

const { pure } = loadSite();

test('the pure helpers are exported for testing', () => {
  assert.ok(pure, 'window.TEX_QUIZ must exist after quiz.js runs');
});

test('isoOf pads month and day', () => {
  assert.equal(pure.isoOf(2026, 2, 14), '2026-03-14');
  assert.equal(pure.isoOf(2026, 0, 1), '2026-01-01');
  assert.equal(pure.isoOf(2026, 11, 31), '2026-12-31');
});

test('arubaTodayISO reads Aruba time, not device time', () => {
  const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Aruba' }).format(new Date());
  assert.equal(pure.arubaTodayISO(), expected);
  assert.match(pure.arubaTodayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('addDaysISO crosses months and leap days without drifting', () => {
  assert.equal(pure.addDaysISO('2026-03-14', 6), '2026-03-20');
  assert.equal(pure.addDaysISO('2026-01-31', 1), '2026-02-01');
  assert.equal(pure.addDaysISO('2028-02-28', 1), '2028-02-29');
  assert.equal(pure.addDaysISO('2026-03-01', -1), '2026-02-28');
});

test('daysBetween counts nights', () => {
  assert.equal(pure.daysBetween('2026-03-14', '2026-03-20'), 6);
  assert.equal(pure.daysBetween('2026-03-14', '2026-03-15'), 1);
  assert.equal(pure.daysBetween('2026-03-14', '2026-03-14'), 0);
  assert.equal(pure.daysBetween('', '2026-03-20'), 0);
});

test('the limits match the spec and the app settings', () => {
  assert.equal(pure.MAX_SPAN_DAYS, 90);
  assert.equal(pure.MAX_AHEAD_DAYS, 365);
  assert.equal(pure.MAX_AHEAD_MONTHS, 12);
  assert.equal(pure.NOTE_MAX, 200);
  assert.equal(pure.NOTE_COUNTER_FROM, 150);
  assert.equal(pure.SEND_TIMEOUT_MS, 4000);
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected failure: `Error: ENOENT: no such file or directory, open '.../site/scripts/quiz.js'`.

- [ ] **Step 3: Implement**

Create `site/scripts/quiz.js` with the pure block only:

```js
/* ============================================
   quiz.js, Tex Cars WhatsApp request quiz (/book/)
   Four steps, then a send screen. Nothing here reserves a car.

   Ported from the Little John Scooters quiz engine, with its three real
   calendar bugs fixed: Aruba time instead of device time, 44px touch
   targets, and a mis-tap that announces itself instead of silently
   wiping both dates.

   The pure helpers below are exported on window.TEX_QUIZ so the Node
   tests in tools/site-tests/ can load this exact file through node:vm
   and check the maths without a browser and without a bundler. Every
   one of them takes its language explicitly; only the DOM layer calls
   lang(). Nothing touches the DOM until DOMContentLoaded, which is what
   makes loading this file outside a browser safe.
   ============================================ */
(() => {
  'use strict';

  const CFG = window.TEX_CONFIG || {};
  const FLEET = window.TEX_FLEET || [];
  const WA_NUMBER = CFG.waNumber || '2975945454';

  const MAX_SPAN_DAYS = 90;      // mirrors settings.maxRentalDays in the app
  const MAX_AHEAD_DAYS = 365;    // mirrors settings.maxAdvanceDays in the app
  const MAX_AHEAD_MONTHS = 12;   // how far the calendar arrows go
  const NOTE_MAX = 200;
  const NOTE_COUNTER_FROM = 150;
  const SEND_TIMEOUT_MS = 4000;  // long enough for a container cold start

  /* ---------- dates: all ISO strings, all UTC maths, no device timezone ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const parts = (iso) => iso.split('-').map(Number);

  /* Aruba has no daylight saving, so en-CA in America/Aruba is exact. */
  const arubaTodayISO = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Aruba' }).format(new Date());

  function addDaysISO(iso, n) {
    const [y, m, d] = parts(iso);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return isoOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }

  function daysBetween(fromISO, untilISO) {
    if (!fromISO || !untilISO) return 0;
    const [ay, am, ad] = parts(fromISO);
    const [by, bm, bd] = parts(untilISO);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
  }

  const PURE = {
    isoOf, arubaTodayISO, addDaysISO, daysBetween,
    MAX_SPAN_DAYS, MAX_AHEAD_DAYS, MAX_AHEAD_MONTHS,
    NOTE_MAX, NOTE_COUNTER_FROM, SEND_TIMEOUT_MS,
  };
  window.TEX_QUIZ = PURE;
})();
```

Create `tools/site-tests/README.md`:

```markdown
# Site tests

The marketing site in `site/` has no build step and no test runner, and it is
deployed by a subtree push of `site/` alone. These tests therefore live here,
outside `site/`, so they are version controlled but never reach `gh-pages`.

Run them all:

    node --test tools/site-tests/

Run one file:

    node --test tools/site-tests/quiz-pure.test.mjs

`harness.mjs` reads the real shipped `site/data/config.js`,
`site/data/fleet.js` and `site/scripts/quiz.js` and evaluates them inside a
`node:vm` context with stub `window`, `document` and `navigator` globals. The
file under test is byte for byte the file that ships. `quiz.js` puts its pure
helpers on `window.TEX_QUIZ` and does all DOM work inside a `DOMContentLoaded`
handler, so nothing renders when the harness loads it.

`markup.test.mjs` makes static assertions about the shipped HTML, CSS and
sitemap. In a repo with no build step, that is the only automated guard against
a hand edit quietly undoing a decision from the spec.

Manual checks are served from `site/`:

    python3 -m http.server 8000 --directory site
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 6 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add tools/site-tests site/scripts/quiz.js
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: node test harness and the Aruba date helpers

The site has no build step, so the pure helpers are exported on
window.TEX_QUIZ and the tests load the real shipped file through node:vm.
Tests live outside site/ so they never reach the gh-pages tree."
```

---

## Task 2: The estimator

**Files:**
- Modify: `site/scripts/quiz.js` (add the pricing block above `PURE`)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: `daysBetween` from Task 1, `window.TEX_FLEET` from `site/data/fleet.js`.
- Produces:
  - `carBySlug(slug: string): object | null`
  - `priceCfg(lang: string): { sym: string, day: string, week: string, month: string, depositKey: string }`
  - `money(amount: number, P: object): string`
  - `estimateFor(car: object | null, days: number, lang: string): number | null`

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
const i10 = () => pure.carBySlug('hyundai-i10');

test('carBySlug finds the six site cards and nothing else', () => {
  assert.equal(i10().name, 'Hyundai i10');
  assert.equal(i10().class, 'Economy');
  assert.equal(pure.carBySlug('kia-rio').class, 'Compact');
  assert.equal(pure.carBySlug('hyundai-i10-v-7123'), null, 'app vehicle slugs are not site car keys');
  assert.equal(pure.carBySlug(''), null);
});

test('priceCfg follows the language, exactly like main.js priceCfg()', () => {
  assert.deepEqual(pure.priceCfg('en'), { sym: '$', day: 'usdDay', week: 'usdWeek', month: 'usdMonth', depositKey: 'usdDeposit' });
  assert.deepEqual(pure.priceCfg('nl'), { sym: '$', day: 'usdDay', week: 'usdWeek', month: 'usdMonth', depositKey: 'usdDeposit' });
  assert.deepEqual(pure.priceCfg('pap'), { sym: 'Afl.', day: 'priceDay', week: 'priceWeek', month: 'priceMonth', depositKey: 'deposit' });
});

test('money writes the symbol the way the estimate sentence needs it', () => {
  assert.equal(pure.money(210, pure.priceCfg('en')), '$210');
  assert.equal(pure.money(700, pure.priceCfg('pap')), 'Afl. 700');
});

/* The four worked examples from spec section 5, on the Hyundai i10 at
   35 a day, 210 a week and 700 a month. */
test('estimateFor matches the four worked examples in the spec', () => {
  assert.equal(pure.estimateFor(i10(), 6, 'en'), 210);
  assert.equal(pure.estimateFor(i10(), 8, 'en'), 245);
  assert.equal(pure.estimateFor(i10(), 30, 'en'), 700);
  assert.equal(pure.estimateFor(i10(), 34, 'en'), 840);
});

test('estimateFor never charges more than the next larger bucket', () => {
  assert.equal(pure.estimateFor(i10(), 7, 'en'), 210, 'a full week is a week');
  assert.equal(pure.estimateFor(i10(), 13, 'en'), 420, 'six days over a week caps at two weeks');
  assert.equal(pure.estimateFor(i10(), 29, 'en'), 700, '875 of week and day cost caps at one month');
  assert.equal(pure.estimateFor(i10(), 60, 'en'), 1400, 'two whole months');
  assert.equal(pure.estimateFor(i10(), 64, 'en'), 1540, 'two months plus four days, under the three month cap');
});

test('estimateFor follows the currency rule into florin', () => {
  assert.equal(pure.estimateFor(i10(), 6, 'pap'), 300, 'six florin days cap at the 300 week rate');
  assert.equal(pure.estimateFor(i10(), 30, 'pap'), 1150);
});

test('estimateFor returns null when there is nothing to price', () => {
  assert.equal(pure.estimateFor(i10(), 0, 'en'), null);
  assert.equal(pure.estimateFor(null, 6, 'en'), null);
  assert.equal(pure.estimateFor(i10(), -3, 'en'), null);
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/quiz-pure.test.mjs
```

Expected failure: `TypeError: pure.carBySlug is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, insert this block between `daysBetween` and `const PURE`:

```js
  /* ---------- pricing ----------
     Same currency rule as the homepage, priceCfg() in scripts/main.js:11-15:
     Papiamento shows Aruban florin, every other language shows US dollars.
     In practice that is always dollars today, because i18n.js:12 limits the
     site to en and nl. The full rule is implemented anyway so that
     re-enabling Papiamento later cannot leave florin customers looking at
     dollar prices.

     depositKey is the one field main.js's priceCfg does not have. That
     function returns { sym, day, week, month } and nothing else; the deposit
     lives per car in fleet.js as deposit (Afl. 500) and usdDeposit ($250).
     Spec section 5 requires the deposit footnote, so the key is named here
     rather than picked by a second currency test somewhere else. */
  const carBySlug = (slug) => FLEET.find((c) => c.slug === slug) || null;

  function priceCfg(lang) {
    return lang === 'pap'
      ? { sym: 'Afl.', day: 'priceDay', week: 'priceWeek', month: 'priceMonth', depositKey: 'deposit' }
      : { sym: '$', day: 'usdDay', week: 'usdWeek', month: 'usdMonth', depositKey: 'usdDeposit' };
  }

  const money = (amount, P) => (P.sym === '$' ? `$${amount}` : `${P.sym} ${amount}`);

  /* Advisory only. The customer sees this number so the WhatsApp
     conversation starts from the same figure; nothing is priced from it. */
  function estimateFor(car, days, lang) {
    if (!car || !(days > 0)) return null;
    const P = priceCfg(lang);
    const dayRate = car[P.day], weekRate = car[P.week], monthRate = car[P.month];

    const months = days >= 30 ? Math.floor(days / 30) : 0;
    const rest = days - months * 30;
    const weeks = Math.floor(rest / 7);
    const restDays = rest - weeks * 7;

    let weekAndDay = weeks * weekRate + restDays * dayRate;
    if (weekAndDay > (weeks + 1) * weekRate) weekAndDay = (weeks + 1) * weekRate;

    let total = months * monthRate + weekAndDay;
    if (total > (months + 1) * monthRate) total = (months + 1) * monthRate;
    return total;
  }
```

Then extend the `PURE` object:

```js
  const PURE = {
    isoOf, arubaTodayISO, addDaysISO, daysBetween,
    carBySlug, priceCfg, money, estimateFor,
    MAX_SPAN_DAYS, MAX_AHEAD_DAYS, MAX_AHEAD_MONTHS,
    NOTE_MAX, NOTE_COUNTER_FROM, SEND_TIMEOUT_MS,
  };
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 13 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add tools/site-tests site/scripts/quiz.js
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: the price estimator with both cap rules

All four worked examples from the spec are covered, plus the 29 day case
that proves the whole total caps at the next month."
```

---

## Task 3: The date formatter and the phone normaliser

**Files:**
- Modify: `site/scripts/quiz.js` (add the formatting block above `PURE`)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: `parts` and `isoOf` from Task 1.
- Produces:
  - `fmtDate(iso: string, lang: string): string`
  - `monthLabel(y: number, mZeroBased: number, lang: string): string`
  - `normalisePhone(raw: string): string` (empty string when invalid)

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
/* Formatting is asserted in UTC so the result does not depend on the
   machine running the tests. 2026-03-14 is a Saturday, which is the date
   the spec's own copy examples use. */
test('fmtDate renders the short weekday form the copy promises', () => {
  assert.equal(pure.fmtDate('2026-03-14', 'en'), 'Sat 14 Mar');
  assert.equal(pure.fmtDate('2026-03-20', 'en'), 'Fri 20 Mar');
  assert.equal(pure.fmtDate('2026-03-14', 'nl'), 'za 14 mrt');
  assert.equal(pure.fmtDate('2026-03-20', 'nl'), 'vr 20 mrt');
});

test('monthLabel titles the two calendar months', () => {
  assert.equal(pure.monthLabel(2026, 2, 'en'), 'March 2026');
  assert.equal(pure.monthLabel(2026, 2, 'nl'), 'maart 2026');
});

test('normalisePhone strips punctuation and keeps the country code', () => {
  assert.equal(pure.normalisePhone('+297 560 1234'), '+2975601234');
  assert.equal(pure.normalisePhone('+297-560-1234'), '+2975601234');
  assert.equal(pure.normalisePhone('(297) 560.1234'), '2975601234');
  assert.equal(pure.normalisePhone('  +31 6 12 34 56 78  '), '+31612345678');
});

test('normalisePhone rejects anything that is not 8 to 17 digits', () => {
  assert.equal(pure.normalisePhone('5601234'), '', 'seven digits is too short');
  assert.equal(pure.normalisePhone('+' + '1'.repeat(18)), '', 'eighteen digits is too long');
  assert.equal(pure.normalisePhone('call me'), '');
  assert.equal(pure.normalisePhone('++2975601234'), '');
  assert.equal(pure.normalisePhone(''), '');
  assert.equal(pure.normalisePhone(undefined), '');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/quiz-pure.test.mjs
```

Expected failure: `TypeError: pure.fmtDate is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, insert between the pricing block and `const PURE`:

```js
  /* ---------- display formatting ----------
     Dates are formatted from a UTC instant with timeZone UTC, so a phone
     sitting on Central European time never renders a day early or late. */
  const locale = (lang) => (lang === 'nl' ? 'nl-NL' : 'en-GB');

  function fmtDate(iso, lang) {
    const [y, m, d] = parts(iso);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale(lang), {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  }

  function monthLabel(y, m, lang) {
    return new Date(Date.UTC(y, m, 1)).toLocaleDateString(locale(lang), {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    });
  }

  /* Spaces, dashes, dots and brackets come out; an optional leading plus
     and 8 to 17 digits stay. Stored and messaged in this normalised form.
     Nothing here checks that the number is real or that it is on WhatsApp. */
  function normalisePhone(raw) {
    const cleaned = String(raw == null ? '' : raw).replace(/[\s.()-]/g, '');
    return /^\+?\d{8,17}$/.test(cleaned) ? cleaned : '';
  }
```

Extend `PURE` with `fmtDate, monthLabel, normalisePhone`.

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 17 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add tools/site-tests site/scripts/quiz.js
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: date formatting and the phone normaliser

Dates format from a UTC instant so a phone on the wrong timezone cannot
render a day early. Phone normalises to optional plus and 8 to 17 digits."
```

---

## Task 4: The prefilled WhatsApp message

**Files:**
- Modify: `site/scripts/quiz.js` (add the message block above `PURE`)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: `carBySlug`, `daysBetween`, `fmtDate`, `estimateFor`, `priceCfg`, `money`.
- Produces:
  - `buildWaText(req: {carKey, startDate, endDate, delivery, deliveryNote, name}, lang: string): string`
  - `waHref(req: object, lang: string): string`

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
const REQ = {
  carKey: 'hyundai-i10',
  startDate: '2026-03-14',
  endDate: '2026-03-20',
  delivery: 'hotel',
  deliveryNote: 'Divi Village, arriving 11:00',
  name: 'Monischa',
};

/* Verbatim from spec section 6. If this test needs editing, the copy
   changed and Mo and Tex have to approve it again. */
test('buildWaText matches the spec example line for line', () => {
  assert.equal(pure.buildWaText(REQ, 'en'), [
    "Hi Tex, I'd like to rent the Hyundai i10 (Economy).",
    'From: Sat 14 Mar',
    'Until: Fri 20 Mar (6 days)',
    'Where: bring it to my hotel',
    'Note: Divi Village, arriving 11:00',
    'Name: Monischa',
    'Estimate I saw: $210',
  ].join('\n'));
});

test('buildWaText has a Dutch shape with the same seven rows', () => {
  assert.equal(pure.buildWaText(REQ, 'nl'), [
    'Hoi Tex, ik wil graag de Hyundai i10 (Economy) huren.',
    'Van: za 14 mrt',
    'Tot: vr 20 mrt (6 dagen)',
    'Waar: breng hem naar mijn hotel',
    'Opmerking: Divi Village, arriving 11:00',
    'Naam: Monischa',
    'Schatting die ik zag: $210',
  ].join('\n'));
});

test('buildWaText drops the note row when there is no note', () => {
  const text = pure.buildWaText({ ...REQ, deliveryNote: '' }, 'en');
  assert.equal(text.includes('Note:'), false);
  assert.equal(text.split('\n').length, 6);
});

test('buildWaText writes the other two delivery choices', () => {
  assert.ok(pure.buildWaText({ ...REQ, delivery: 'airport' }, 'en').includes('Where: bring it to the airport'));
  assert.ok(pure.buildWaText({ ...REQ, delivery: 'pickup' }, 'en').includes('Where: I collect it at Tex'));
  assert.ok(pure.buildWaText({ ...REQ, delivery: 'airport' }, 'nl').includes('Waar: breng hem naar het vliegveld'));
  assert.ok(pure.buildWaText({ ...REQ, delivery: 'pickup' }, 'nl').includes('Waar: ik haal hem op bij Tex'));
});

test('buildWaText says one day, not one days', () => {
  const one = { ...REQ, endDate: '2026-03-15' };
  assert.ok(pure.buildWaText(one, 'en').includes('(1 day)'));
  assert.ok(pure.buildWaText(one, 'nl').includes('(1 dag)'));
});

test('waHref points at the configured number and encodes the text', () => {
  const href = pure.waHref(REQ, 'en');
  assert.ok(href.startsWith('https://wa.me/2975945454?text='), href);
  assert.equal(decodeURIComponent(href.split('?text=')[1]), pure.buildWaText(REQ, 'en'));
  assert.equal(href.includes('\n'), false, 'newlines must be percent encoded');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/quiz-pure.test.mjs
```

Expected failure: `TypeError: pure.buildWaText is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, insert between the formatting block and `const PURE`:

```js
  /* ---------- the prefilled WhatsApp message ----------
     Built from state the browser already holds, so it is correct even when
     the save never returns. This is the whole request: a failed save costs
     the back office a row, not the customer a booking. */
  const WA_WHERE = {
    en: { airport: 'bring it to the airport', hotel: 'bring it to my hotel', pickup: 'I collect it at Tex' },
    nl: { airport: 'breng hem naar het vliegveld', hotel: 'breng hem naar mijn hotel', pickup: 'ik haal hem op bij Tex' },
  };

  function buildWaText(req, lang) {
    const nl = lang === 'nl';
    const car = carBySlug(req.carKey);
    const days = daysBetween(req.startDate, req.endDate);
    const est = estimateFor(car, days, lang);
    const P = priceCfg(lang);
    const from = fmtDate(req.startDate, lang);
    const until = fmtDate(req.endDate, lang);
    const where = (nl ? WA_WHERE.nl : WA_WHERE.en)[req.delivery];
    const lines = nl
      ? [
          `Hoi Tex, ik wil graag de ${car.name} (${car.class}) huren.`,
          `Van: ${from}`,
          `Tot: ${until} (${days} ${days === 1 ? 'dag' : 'dagen'})`,
          `Waar: ${where}`,
          req.deliveryNote ? `Opmerking: ${req.deliveryNote}` : null,
          `Naam: ${req.name}`,
          est ? `Schatting die ik zag: ${money(est, P)}` : null,
        ]
      : [
          `Hi Tex, I'd like to rent the ${car.name} (${car.class}).`,
          `From: ${from}`,
          `Until: ${until} (${days} ${days === 1 ? 'day' : 'days'})`,
          `Where: ${where}`,
          req.deliveryNote ? `Note: ${req.deliveryNote}` : null,
          `Name: ${req.name}`,
          est ? `Estimate I saw: ${money(est, P)}` : null,
        ];
    return lines.filter(Boolean).join('\n');
  }

  const waHref = (req, lang) =>
    `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildWaText(req, lang))}`;
```

Extend `PURE` with `buildWaText, waHref`.

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 23 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add tools/site-tests site/scripts/quiz.js
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: the prefilled WhatsApp message, English and Dutch

The English output is asserted line for line against the example in the
spec, so a copy change cannot land without the test being edited."
```

---

## Task 5: The quiz page markup

**Files:**
- Create: `site/book/index.html`
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: `site/data/config.js`, `site/data/fleet.js`, `site/scripts/i18n.js`, `site/scripts/quiz.js`.
- Produces: the DOM contract the Task 7 to Task 10 DOM layer binds to. Element ids and data attributes, all of them load bearing:
  - `#qCars` (step 1 card grid target), `#qCal` (calendar target), `#qNote`, `#qNoteCount`, `#qName`, `#qPhone`, `#qWebsite` (honeypot)
  - `.q-step` sections in order, `.q-step.is-active` for the visible one, `[data-validate]` naming the validator
  - `[data-next]`, `[data-back]`, `[data-delivery]`, `.q-error`, `.quiz-progress i`
  - Recap value spans `#rCar`, `#rFrom`, `#rUntil`, `#rEst`, `#rWhere`, `#rNote`, `#rName`, `#rPhone`, and their rows `#rNoteRow`, `#rEstRow`
  - `#qEstimate` (estimate sentence), `#qDeposit` (deposit footnote), `#qSendBtn`, `#qStatus`, `#qOpenWa`

- [ ] **Step 1: Write the failing test**

Create `tools/site-tests/markup.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './harness.mjs';

const book = read('book/index.html');

test('the quiz page loads exactly four scripts, in order', () => {
  const srcs = [...book.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(srcs, ['../data/config.js', '../data/fleet.js', '../scripts/i18n.js', '../scripts/quiz.js']);
});

test('the quiz page loads neither main.js nor booking-bridge.js', () => {
  assert.equal(book.includes('main.js'), false, 'main.js would render a fleet grid and the retired inquiry form');
  assert.equal(book.includes('booking-bridge.js'), false, 'the bridge would rewrite links onto the app origin');
});

test('the floating WhatsApp button is not on the quiz page at all', () => {
  assert.equal(book.includes('wa-float'), false, 'not hidden with CSS, simply not on the page');
});

test('no anchor on the quiz page opens a new tab', () => {
  assert.equal(/target\s*=/.test(book), false, 'in app webviews have no tab to open into');
});

test('the send anchor carries a real href before any JavaScript runs', () => {
  const anchor = book.match(/<a[^>]*id="qOpenWa"[^>]*>/);
  assert.ok(anchor, 'the tap 2 anchor must be in the markup');
  assert.match(anchor[0], /href="https:\/\/wa\.me\/2975945454\?text=/);
});

test('JavaScript off still leaves a working WhatsApp link', () => {
  assert.match(book, /<noscript>/);
  const noscript = book.slice(book.indexOf('<div class="q-noscript"'), book.indexOf('</div>', book.indexOf('<div class="q-noscript"')));
  assert.match(noscript, /https:\/\/wa\.me\/2975945454/);
});

test('every step heading ships both languages', () => {
  for (const [en, nl] of [
    ['Which car?', 'Welke auto?'],
    ['When do you need it?', 'Wanneer heb je hem nodig?'],
    ['Where would you like it?', 'Waar wil je hem hebben?'],
    ['Who should Tex message?', 'Wie mag Tex een bericht sturen?'],
  ]) {
    assert.ok(book.includes(`data-en="${en}"`), `missing English heading: ${en}`);
    assert.ok(book.includes(`data-nl="${nl}"`), `missing Dutch heading: ${nl}`);
  }
});

test('the consent line is verbatim, in both languages, with the 90 days in it', () => {
  assert.ok(book.includes('Tap send and we save your name, your WhatsApp number and the choices above so Tex can answer you. Nothing is reserved yet. We delete it after 90 days.'));
  assert.ok(book.includes('Als je verstuurt bewaren we je naam, je WhatsApp nummer en de keuzes hierboven zodat Tex je kan antwoorden. Er is nog niets gereserveerd. Na 90 dagen verwijderen we het.'));
  assert.ok(book.includes('https://app.tex-cars.com/policies/privacy'));
});

test('the delivery step carries the request, not a promise, line', () => {
  assert.ok(book.includes('This is a request, not a confirmed pick-up. Tex will tell you what works on WhatsApp.'));
  assert.ok(book.includes('Dit is een verzoek, geen bevestigde afspraak. Tex laat je op WhatsApp weten wat kan.'));
});

test('the three delivery options use the pickup enum, never desk', () => {
  for (const v of ['airport', 'hotel', 'pickup']) assert.ok(book.includes(`data-delivery="${v}"`), v);
  assert.equal(book.includes('data-delivery="desk"'), false);
});

test('the free text line is capped at 200 characters and is a single line', () => {
  const note = book.match(/<input[^>]*id="qNote"[^>]*>/);
  assert.ok(note);
  assert.match(note[0], /maxlength="200"/);
  assert.match(note[0], /type="text"/);
});

test('the phone field is set up for a phone keyboard', () => {
  const phone = book.match(/<input[^>]*id="qPhone"[^>]*>/);
  assert.ok(phone);
  assert.match(phone[0], /type="tel"/);
  assert.match(phone[0], /inputmode="tel"/);
  assert.match(phone[0], /autocomplete="tel"/);
  assert.match(phone[0], /placeholder="\+297 560 1234"/);
});

test('the honeypot is present, empty and hidden from real people', () => {
  const hp = book.match(/<input[^>]*id="qWebsite"[^>]*>/);
  assert.ok(hp);
  assert.match(hp[0], /name="website"/);
  assert.match(hp[0], /tabindex="-1"/);
  assert.match(hp[0], /autocomplete="off"/);
});

test('the send screen has all eight recap slots', () => {
  for (const id of ['rCar', 'rFrom', 'rUntil', 'rEst', 'rWhere', 'rNote', 'rName', 'rPhone']) {
    assert.ok(book.includes(`id="${id}"`), `missing recap slot ${id}`);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `Error: ENOENT: no such file or directory, open '.../site/book/index.html'`.

- [ ] **Step 3: Implement**

One note on the head block below: `og:image` is written as an absolute `https://tex-cars.com/...` URL. A relative value there is resolved by nothing, so the card renders with no image. `site/index.html:15` still carries a relative `og:image` and is deliberately left alone; the homepage is not in scope here.

Create `site/book/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request a car | Tex Cars Aruba</title>
  <meta name="description" content="Tell us which car and which days, and Tex answers you on WhatsApp. Four taps, nothing to pay, nothing reserved until Tex confirms." />
  <meta name="theme-color" content="#2348C7" />
  <link rel="canonical" href="https://tex-cars.com/book/" />

  <meta property="og:title" content="Request a car | Tex Cars Aruba" />
  <meta property="og:description" content="Four taps and Tex answers you on WhatsApp." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tex-cars.com/book/" />
  <!-- Absolute, because a crawler resolves og:image against nothing. -->
  <meta property="og:image" content="https://tex-cars.com/assets/logo/LOGOCIRCLE_COLOUR.png" />

  <link rel="icon" type="image/png" href="../assets/logo/favicon-white.png" />
  <link rel="apple-touch-icon" href="../assets/logo/LOGOCIRCLE_WHITE.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="../styles/reset.css" />
  <link rel="stylesheet" href="../styles/tokens.css" />
  <link rel="stylesheet" href="../styles/main.css" />

  <!-- With JavaScript off the quiz cannot render, so it steps aside for a
       plain WhatsApp link that works on its own. -->
  <noscript><style>.quiz { display: none; } .q-noscript { display: block; }</style></noscript>
</head>
<body class="lang-en">

  <header class="header is-scrolled">
    <div class="container">
      <nav class="nav" aria-label="Main">
        <a class="nav__logo" href="../index.html" aria-label="Tex Cars home">
          <img src="../assets/logo/LOGOCIRCLE_COLOUR.png" alt="Tex Cars" />
          <span>TEX<b>CARS</b></span>
        </a>
        <div class="nav__actions" style="margin-left:auto">
          <div class="langs" role="group" aria-label="Language">
            <button class="lang-btn" data-set-lang="en">EN</button>
            <button class="lang-btn" data-set-lang="nl">NL</button>
          </div>
        </div>
      </nav>
    </div>
  </header>

  <main class="quiz-page">
    <div class="container">

      <div class="q-noscript">
        <h1 data-en="Message Tex on WhatsApp" data-nl="Stuur Tex een bericht op WhatsApp">Message Tex on WhatsApp</h1>
        <p data-en="This page needs JavaScript to build your request. Tap below and tell Tex which car and which days." data-nl="Deze pagina heeft JavaScript nodig om je aanvraag op te bouwen. Tik hieronder en vertel Tex welke auto en welke dagen.">This page needs JavaScript to build your request. Tap below and tell Tex which car and which days.</p>
        <a class="btn btn--wa btn--lg" href="https://wa.me/2975945454?text=Hi%20Tex%2C%20I%27d%20like%20to%20rent%20a%20car."
           data-en="Open WhatsApp" data-nl="Open WhatsApp">Open WhatsApp</a>
      </div>

      <div class="quiz">
        <p class="q-trust"
           data-en="Nothing is reserved until Tex confirms it on WhatsApp."
           data-nl="Er is niets gereserveerd tot Tex het op WhatsApp bevestigt.">Nothing is reserved until Tex confirms it on WhatsApp.</p>

        <div class="quiz-progress" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i><i></i></div>

        <!-- ============ STEP 1 · the car ============ -->
        <section class="q-step is-active" data-validate="car" aria-label="Which car">
          <h1 class="q-title" data-en="Which car?" data-nl="Welke auto?">Which car?</h1>
          <div class="q-card">
            <div class="q-cars" id="qCars"></div>
            <p class="q-error" role="alert"></p>
            <div class="q-nav"><span></span><button type="button" class="btn btn--primary" data-next data-en="Continue" data-nl="Verder">Continue</button></div>
          </div>
        </section>

        <!-- ============ STEP 2 · the dates ============ -->
        <section class="q-step" data-validate="dates" aria-label="When do you need it">
          <h1 class="q-title" data-en="When do you need it?" data-nl="Wanneer heb je hem nodig?">When do you need it?</h1>
          <p class="q-sub" data-en="Tap your pick-up day, then your return day." data-nl="Tik je ophaaldag aan, daarna je terugbrengdag.">Tap your pick-up day, then your return day.</p>
          <div class="q-card">
            <div class="cal2" id="qCal"></div>
            <p class="q-error" role="alert"></p>
            <div class="q-nav">
              <button type="button" class="btn btn--ghost" data-back data-en="Back" data-nl="Terug">Back</button>
              <button type="button" class="btn btn--primary" data-next data-en="Continue" data-nl="Verder">Continue</button>
            </div>
          </div>
        </section>

        <!-- ============ STEP 3 · the delivery preference ============ -->
        <section class="q-step" data-validate="delivery" aria-label="Where would you like it">
          <h1 class="q-title" data-en="Where would you like it?" data-nl="Waar wil je hem hebben?">Where would you like it?</h1>
          <div class="q-card">
            <div class="q-opts">
              <button type="button" class="q-opt" data-delivery="airport" data-en="Bring it to the airport" data-nl="Breng hem naar het vliegveld">Bring it to the airport</button>
              <button type="button" class="q-opt" data-delivery="hotel" data-en="Bring it to my hotel" data-nl="Breng hem naar mijn hotel">Bring it to my hotel</button>
              <button type="button" class="q-opt" data-delivery="pickup" data-en="I collect it at Tex" data-nl="Ik haal hem op bij Tex">I collect it at Tex</button>
            </div>

            <p class="q-notice"
               data-en="This is a request, not a confirmed pick-up. Tex will tell you what works on WhatsApp."
               data-nl="Dit is een verzoek, geen bevestigde afspraak. Tex laat je op WhatsApp weten wat kan.">This is a request, not a confirmed pick-up. Tex will tell you what works on WhatsApp.</p>

            <label class="field q-field">
              <span data-en="Anything about the drop-off? (optional)" data-nl="Iets over de aflevering? (optioneel)">Anything about the drop-off? (optional)</span>
              <input type="text" id="qNote" maxlength="200" autocomplete="off"
                     placeholder="Hotel name, flight number, time of day"
                     data-en-placeholder="Hotel name, flight number, time of day"
                     data-nl-placeholder="Hotelnaam, vluchtnummer, tijdstip" />
              <small class="q-count" id="qNoteCount" hidden></small>
            </label>

            <p class="q-error" role="alert"></p>
            <div class="q-nav">
              <button type="button" class="btn btn--ghost" data-back data-en="Back" data-nl="Terug">Back</button>
              <button type="button" class="btn btn--primary" data-next data-en="Continue" data-nl="Verder">Continue</button>
            </div>
          </div>
        </section>

        <!-- ============ STEP 4 · who to message ============ -->
        <section class="q-step" data-validate="who" aria-label="Who should Tex message">
          <h1 class="q-title" data-en="Who should Tex message?" data-nl="Wie mag Tex een bericht sturen?">Who should Tex message?</h1>
          <div class="q-card">
            <label class="field q-field">
              <span data-en="Your name" data-nl="Je naam">Your name</span>
              <input type="text" id="qName" maxlength="60" autocomplete="name" />
            </label>
            <label class="field q-field">
              <span data-en="WhatsApp number" data-nl="WhatsApp nummer">WhatsApp number</span>
              <input type="tel" id="qPhone" inputmode="tel" autocomplete="tel" placeholder="+297 560 1234" />
              <small class="q-help" data-en="With the country code, so Tex can reach you." data-nl="Met landcode, zodat Tex je kan bereiken.">With the country code, so Tex can reach you.</small>
            </label>

            <!-- honeypot: a real person never sees this, a bot fills it in -->
            <div class="q-hp" aria-hidden="true">
              <label for="qWebsite">Website</label>
              <input type="text" id="qWebsite" name="website" value="" tabindex="-1" autocomplete="off" />
            </div>

            <p class="q-error" role="alert"></p>
            <div class="q-nav">
              <button type="button" class="btn btn--ghost" data-back data-en="Back" data-nl="Terug">Back</button>
              <button type="button" class="btn btn--primary" data-next data-en="Continue" data-nl="Verder">Continue</button>
            </div>
          </div>
        </section>

        <!-- ============ SEND ============ -->
        <section class="q-step" data-validate="none" aria-label="Send your request">
          <h1 class="q-title" data-en="Send it to Tex" data-nl="Stuur het naar Tex">Send it to Tex</h1>
          <div class="q-card">
            <ul class="q-recap">
              <li><b data-en="Car" data-nl="Auto">Car</b><span id="rCar"></span></li>
              <li><b data-en="From" data-nl="Van">From</b><span id="rFrom"></span></li>
              <li><b data-en="Until" data-nl="Tot">Until</b><span id="rUntil"></span></li>
              <li id="rEstRow"><b data-en="Estimate" data-nl="Schatting">Estimate</b><span id="rEst"></span></li>
              <li><b data-en="Where" data-nl="Waar">Where</b><span id="rWhere"></span></li>
              <li id="rNoteRow"><b data-en="Note" data-nl="Opmerking">Note</b><span id="rNote"></span></li>
              <li><b data-en="Name" data-nl="Naam">Name</b><span id="rName"></span></li>
              <li><b data-en="WhatsApp number" data-nl="WhatsApp nummer">WhatsApp number</b><span id="rPhone"></span></li>
            </ul>

            <p class="q-estimate" id="qEstimate"></p>
            <p class="q-deposit" id="qDeposit"></p>

            <p class="q-consent">
              <span data-en="Tap send and we save your name, your WhatsApp number and the choices above so Tex can answer you. Nothing is reserved yet. We delete it after 90 days."
                    data-nl="Als je verstuurt bewaren we je naam, je WhatsApp nummer en de keuzes hierboven zodat Tex je kan antwoorden. Er is nog niets gereserveerd. Na 90 dagen verwijderen we het.">Tap send and we save your name, your WhatsApp number and the choices above so Tex can answer you. Nothing is reserved yet. We delete it after 90 days.</span>
              <a href="https://app.tex-cars.com/policies/privacy" data-en="Privacy policy" data-nl="Privacybeleid">Privacy policy</a>
            </p>

            <button type="button" class="btn btn--primary btn--block btn--lg" id="qSendBtn"
                    data-en="Send request" data-nl="Verstuur aanvraag">Send request</button>

            <p class="q-status" id="qStatus" role="status" aria-live="polite"></p>

            <a class="btn btn--wa btn--block btn--lg q-openwa" id="qOpenWa" hidden
               href="https://wa.me/2975945454?text=Hi%20Tex%2C%20I%27d%20like%20to%20rent%20a%20car."
               data-en="Open WhatsApp" data-nl="Open WhatsApp">Open WhatsApp</a>

            <div class="q-nav">
              <button type="button" class="btn btn--ghost" data-back data-en="Back" data-nl="Terug">Back</button>
              <span></span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>

  <script src="../data/config.js"></script>
  <script src="../data/fleet.js"></script>
  <script src="../scripts/i18n.js"></script>
  <script src="../scripts/quiz.js"></script>
</body>
</html>
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 37 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/book/index.html tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "book: the quiz page markup, four steps and a send screen

Exactly four scripts, no wa-float, no target attribute anywhere, and a
noscript WhatsApp link so the page still works with JavaScript off."
```

---

## Task 6: The quiz styles

**Files:**
- Modify: `site/styles/main.css` (append one new block at the very end of the file. The file is 424 lines today. Its last rule is the reduced motion block, `@media (prefers-reduced-motion: reduce) {` at `:419` through the closing brace at `:424`, under its comment at `:418`.)
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: the tokens in `site/styles/tokens.css` and the existing `.btn`, `.field`, `.container` components in `main.css`.
- Produces: the class names the Task 5 markup and the Task 7 to 10 renderers use: `.quiz-page`, `.quiz`, `.q-noscript`, `.q-trust`, `.quiz-progress`, `.q-step`, `.q-step.is-active`, `.q-title`, `.q-sub`, `.q-card`, `.q-cars`, `.q-carcard`, `.q-carcard.is-sel`, `.q-opts`, `.q-opt`, `.q-opt.is-sel`, `.q-notice`, `.q-field`, `.q-count`, `.q-help`, `.q-hp`, `.q-error`, `.q-nav`, `.q-recap`, `.q-estimate`, `.q-deposit`, `.q-consent`, `.q-status`, `.q-openwa`, `.cal2`, `.cal2-nav-row`, `.cal2-nav`, `.cal2-months`, `.cal2-month`, `.cal2-title`, `.cal2-grid`, `.cal2-day`, `.cal2-day.mid`, `.cal2-day.edge`, `.cal2-hint`.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/markup.test.mjs`:

```js
const css = read('styles/main.css');

test('the calendar day cell clears a 44px touch target', () => {
  const rule = css.match(/\.cal2-day\s*\{[^}]*\}/);
  assert.ok(rule, '.cal2-day must be styled');
  assert.match(rule[0], /min-height:\s*44px/, 'the Little John original set no minimum height at all');
});

test('the calendar grid gap drops to 2px so seven columns still fit at 375px', () => {
  const rule = css.match(/\.cal2-grid\s*\{[^}]*\}/);
  assert.ok(rule);
  assert.match(rule[0], /grid-template-columns:\s*repeat\(7,\s*1fr\)/);
  assert.match(rule[0], /gap:\s*2px/);
});

test('every quiz class the markup and the renderers use is styled', () => {
  for (const cls of [
    '.quiz-page', '.quiz', '.q-noscript', '.q-trust', '.quiz-progress', '.q-step',
    '.q-title', '.q-sub', '.q-card', '.q-cars', '.q-carcard', '.q-opts', '.q-opt',
    '.q-notice', '.q-count', '.q-help', '.q-hp', '.q-error', '.q-nav', '.q-recap',
    '.q-estimate', '.q-deposit', '.q-consent', '.q-status', '.q-openwa',
    '.cal2-nav', '.cal2-months', '.cal2-title', '.cal2-hint',
  ]) {
    assert.ok(css.includes(cls), `missing style for ${cls}`);
  }
});

test('the quiz styles are appended, not interleaved into the existing sheet', () => {
  assert.ok(css.indexOf('/* ---------- Quiz page (/book/)') > css.indexOf('@media (prefers-reduced-motion: reduce)'),
    'the quiz block goes at the end of the file');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `AssertionError [ERR_ASSERTION]: .cal2-day must be styled`.

- [ ] **Step 3: Implement**

Append to the end of `site/styles/main.css`:

```css

/* ============================================
   Quiz page (/book/), the WhatsApp request quiz
   Only this page uses these classes. The page deliberately does not load
   main.js or booking-bridge.js, so nothing here depends on either.
   ============================================ */

/* ---------- Quiz page (/book/) shell ---------- */
.quiz-page { padding-block: clamp(2rem, 5vw, 4rem) clamp(3rem, 7vw, 6rem); background: var(--surface); min-height: 70vh; }
.quiz { width: min(620px, 100%); margin-inline: auto; }
.q-noscript { display: none; text-align: center; }
.q-noscript h1 { font-family: var(--font-display); font-size: var(--fs-h2); text-transform: uppercase; }
.q-noscript p { color: var(--ink-soft); margin: 1rem 0 1.6rem; }
.q-trust { text-align: center; font-size: .88rem; font-weight: 600; color: var(--ink-mute); margin-bottom: 1rem; }
.quiz-progress { display: flex; gap: 6px; justify-content: center; margin-bottom: 1.4rem; }
.quiz-progress i { width: 30px; height: 5px; border-radius: var(--radius-pill); background: var(--surface-2); transition: background .25s var(--ease); }
.quiz-progress i.on { background: var(--brand-blue); }

.q-step { display: none; }
.q-step.is-active { display: block; animation: rise .45s var(--ease) backwards; }
.q-title { font-family: var(--font-display); font-size: var(--fs-h3); text-transform: uppercase; letter-spacing: var(--tracking-tight); text-align: center; }
.q-sub { text-align: center; color: var(--ink-soft); font-size: .95rem; margin-top: .5rem; }
.q-card { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); padding: clamp(1.1rem, 3.5vw, 1.8rem); margin-top: 1.2rem; }

/* ---------- Step 1: the car cards ---------- */
.q-cars { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .8rem; }
.q-carcard { text-align: left; background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: border-color .2s, transform .2s var(--ease); }
.q-carcard:hover { transform: translateY(-2px); border-color: var(--brand-blue); }
.q-carcard.is-sel { border-color: var(--brand-blue); box-shadow: var(--glow-blue); background: #fff; }
.q-carcard img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; }
.q-carcard__body { padding: .6rem .7rem .7rem; display: grid; gap: .15rem; }
.q-carcard__cls { font-size: .66rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--brand-blue); }
.q-carcard__name { font-weight: 700; font-size: .95rem; color: var(--brand-navy); }
.q-carcard__price { font-size: .85rem; color: var(--ink-soft); }

/* ---------- Step 3: the delivery options ---------- */
.q-opts { display: grid; gap: .6rem; }
.q-opt { text-align: left; font-weight: 600; background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: .95rem 1.1rem; cursor: pointer; min-height: 44px; transition: border-color .2s, background .2s; }
.q-opt:hover { border-color: var(--brand-blue); }
.q-opt.is-sel { border-color: var(--brand-blue); background: var(--blue-50); }
.q-notice { margin-top: .9rem; padding: .8rem .95rem; background: var(--orange-50); border-left: 3px solid var(--brand-orange); border-radius: 10px; font-size: .88rem; color: var(--ink-soft); }

/* ---------- Fields ---------- */
.q-field { margin-top: 1rem; }
.q-field > span { font-size: .82rem; font-weight: 700; color: var(--brand-navy); }
.q-count, .q-help { font-size: .78rem; color: var(--ink-mute); }
.q-count[hidden] { display: none; }
.q-hp { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.q-error { color: var(--brand-orange); font-size: .88rem; font-weight: 700; min-height: 1.2em; margin-top: .8rem; }
.q-nav { display: flex; justify-content: space-between; align-items: center; gap: .8rem; margin-top: 1rem; }

/* ---------- Calendar: two months, tap to pick ----------
   Three fixes over the Little John original: Aruba time is handled in
   quiz.js, and the two here are the touch target and the grid gap. The
   original cell was 10px of padding around a 13.5px glyph inside a 4px
   gap grid, which lands under 44px on a 375px viewport. */
.cal2 { margin-top: .2rem; }
.cal2-nav-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
.cal2-nav { width: 44px; height: 44px; border-radius: 12px; border: 1.5px solid var(--line); background: #fff; font-size: 1.2rem; line-height: 1; color: var(--brand-navy); cursor: pointer; }
.cal2-nav:hover:not(:disabled) { border-color: var(--brand-blue); color: var(--brand-blue); }
.cal2-nav:disabled { opacity: .3; cursor: default; }
.cal2-months { display: grid; grid-template-columns: 1fr; gap: 1.1rem; }
@media (min-width: 700px) { .cal2-months { grid-template-columns: 1fr 1fr; gap: 1.4rem; } }
.cal2-title { font-family: var(--font-display); text-transform: uppercase; font-size: .9rem; letter-spacing: .04em; text-align: center; color: var(--brand-navy); margin-bottom: .4rem; }
.cal2-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.cal2-grid .dow { font-size: .62rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute); padding: .3rem 0; }
.cal2-day {
  min-height: 44px; font-size: .88rem; font-weight: 600; color: var(--brand-navy);
  background: var(--surface); border: 2px solid transparent; border-radius: 10px; cursor: pointer;
  transition: background .15s, border-color .15s;
}
.cal2-day:hover:not(:disabled):not(.edge) { border-color: var(--brand-blue); }
.cal2-day:disabled { opacity: .28; cursor: default; }
.cal2-day.mid { background: var(--blue-100); }
.cal2-day.edge { background: var(--brand-blue); border-color: var(--brand-blue); color: #fff; font-weight: 800; }
.cal2-hint { margin-top: .8rem; font-size: .88rem; font-weight: 600; color: var(--brand-blue); min-height: 2.4em; }

/* ---------- Send screen ---------- */
.q-recap { display: grid; gap: .5rem; margin-bottom: 1.2rem; }
.q-recap li { display: flex; justify-content: space-between; gap: 1rem; font-size: .95rem; border-bottom: 1px solid var(--line); padding-bottom: .5rem; }
.q-recap li b { font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-mute); white-space: nowrap; padding-top: .2rem; }
.q-recap li span { text-align: right; font-weight: 600; color: var(--brand-navy); }
.q-recap li[hidden] { display: none; }
.q-estimate { font-size: 1.05rem; font-weight: 700; color: var(--brand-navy); }
.q-deposit { font-size: .8rem; color: var(--ink-mute); margin-top: .3rem; }
.q-consent { font-size: .8rem; color: var(--ink-soft); margin: 1.1rem 0 .9rem; line-height: 1.5; }
.q-consent a { color: var(--brand-blue); font-weight: 700; text-decoration: underline; }
.q-status { font-size: .9rem; font-weight: 600; min-height: 1.2em; margin-top: .7rem; text-align: center; }
.q-status.is-ok { color: var(--brand-blue); }
.q-status.is-warn { color: var(--brand-orange); }
.q-openwa { margin-top: .8rem; }
.q-openwa[hidden] { display: none; }
/* #qSendBtn carries .btn, and main.css:30 sets .btn { display: inline-flex }.
   An author rule beats the user agent's [hidden] { display: none } no matter
   the specificity, so without this line `btn.hidden = true` in send() leaves
   the disabled "Sending..." button on screen directly above the green Open
   WhatsApp anchor. That is the two green buttons in one thumb zone that
   spec section 6 exists to prevent. reset.css has no [hidden] rule. */
#qSendBtn[hidden] { display: none; }

@media (prefers-reduced-motion: reduce) {
  .q-step.is-active, .q-carcard { animation: none; transition: none; }
}
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 41 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/styles/main.css tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "styles: the quiz page, on the existing tokens

Calendar cells get a 44px minimum height and the grid gap drops to 2px,
which is the touch target bug the Little John original shipped with."
```

---

## Task 7: Step 1, the car cards, and the step engine

**Files:**
- Modify: `site/scripts/quiz.js` (add `carCardsHTML` to the pure block, then open the DOM layer)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: `carBySlug`, `priceCfg`, `money`, `window.TEX_FLEET`, `window.TEX_i18n.getLang()`.
- Produces:
  - `carCardsHTML(fleet: array, selectedSlug: string, lang: string): string`
  - The DOM layer's internal `state` object shape, which every later task extends: `{ carKey, startDate, endDate, delivery, deliveryNote, name, phone }`
  - `show(i: number): void`, `lang(): string`, `render(): void` inside the DOM layer.

Design note, and the reason the DOM layer stays testable: every renderer is a pure function that returns an HTML string. The DOM layer only queries elements, assigns `innerHTML` and binds listeners. That keeps the interesting logic in `window.TEX_QUIZ`, where Node can reach it.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
import { loadSite as reload } from './harness.mjs';
const fleet = reload().window.TEX_FLEET;

test('carCardsHTML renders one card per active site car', () => {
  const html = pure.carCardsHTML(fleet, '', 'en');
  assert.equal((html.match(/class="q-carcard/g) || []).length, 6);
  for (const slug of ['hyundai-i10', 'ford-figo', 'suzuki-baleno', 'hyundai-accent', 'chevrolet-aveo', 'kia-rio']) {
    assert.ok(html.includes(`data-car="${slug}"`), `missing card for ${slug}`);
  }
});

test('carCardsHTML shows the photo, the name, the class and the per day rate', () => {
  const html = pure.carCardsHTML(fleet, '', 'en');
  assert.ok(html.includes('src="../assets/img/car-hyundai-i10.jpg"'), 'the /book/ page is one level down');
  assert.ok(html.includes('Hyundai i10'));
  assert.ok(html.includes('Economy'));
  assert.ok(html.includes('$35'));
});

test('carCardsHTML follows the currency rule', () => {
  assert.ok(pure.carCardsHTML(fleet, '', 'pap').includes('Afl. 50'));
  assert.ok(pure.carCardsHTML(fleet, '', 'nl').includes('$35'));
});

test('carCardsHTML marks the selected card and only that one', () => {
  const html = pure.carCardsHTML(fleet, 'kia-rio', 'en');
  assert.equal((html.match(/is-sel/g) || []).length, 1);
  assert.match(html, /data-car="kia-rio"[^>]*class="q-carcard is-sel"|class="q-carcard is-sel"[^>]*data-car="kia-rio"/);
});

test('carCardsHTML says per day in Dutch too', () => {
  assert.ok(pure.carCardsHTML(fleet, '', 'en').includes('/day'));
  assert.ok(pure.carCardsHTML(fleet, '', 'nl').includes('/dag'));
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/quiz-pure.test.mjs
```

Expected failure: `TypeError: pure.carCardsHTML is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, add the micro translation table and `carCardsHTML` just above `const PURE`:

```js
  /* ---------- micro translations for JavaScript rendered content ----------
     Static copy lives in data-en / data-nl in the markup and is handled by
     scripts/i18n.js. Only strings this file builds live here. */
  const T = {
    en: {
      perDay: '/day', days: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
      dows: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      hintStart: 'Tap your pick-up day.',
      hintEnd: 'Now tap your return day.',
      moved: (d) => `Start date moved to ${d}. Now tap your return day.`,
      prevMonth: 'Previous month', nextMonth: 'Next month',
      errCar: 'Tap the car you would like.',
      errDates: 'Tap a pick-up day and a return day on the calendar.',
      errSpan: 'Ninety days is the longest we can take here. Ask Tex on WhatsApp for a longer rental.',
      errDelivery: 'Tell us where you would like the car.',
      errName: 'We need a name so Tex knows who to answer.',
      errPhone: 'Add your WhatsApp number with the country code.',
      sending: 'Sending…',
      sent: 'Sent. Now open WhatsApp so Tex sees it.',
      failed: 'We could not save it here, so send it on WhatsApp instead. Nothing is lost.',
      estimate: (m, n) => `Estimate: ${m} for ${n}. Tex confirms the final price on WhatsApp.`,
      deposit: (m) => `A refundable deposit of ${m} is arranged when you pick the car up. It is not part of this estimate.`,
    },
    nl: {
      perDay: '/dag', days: (n) => `${n} ${n === 1 ? 'dag' : 'dagen'}`,
      dows: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'],
      hintStart: 'Tik je ophaaldag aan.',
      hintEnd: 'Tik nu je terugbrengdag aan.',
      moved: (d) => `Startdatum verplaatst naar ${d}. Tik nu je terugbrengdag aan.`,
      prevMonth: 'Vorige maand', nextMonth: 'Volgende maand',
      errCar: 'Tik de auto aan die je wil.',
      errDates: 'Tik een ophaaldag en een terugbrengdag aan op de kalender.',
      errSpan: 'Negentig dagen is het langste dat hier kan. Vraag Tex op WhatsApp naar een langere huur.',
      errDelivery: 'Vertel ons waar je de auto wil hebben.',
      errName: 'We hebben een naam nodig, zodat Tex weet wie hij antwoordt.',
      errPhone: 'Vul je WhatsApp nummer in met landcode.',
      sending: 'Versturen…',
      sent: 'Verstuurd. Open nu WhatsApp zodat Tex het ziet.',
      failed: 'We konden het hier niet opslaan, stuur het daarom via WhatsApp. Er gaat niets verloren.',
      estimate: (m, n) => `Schatting: ${m} voor ${n}. Tex bevestigt de definitieve prijs via WhatsApp.`,
      deposit: (m) => `Een borg van ${m} regel je bij het ophalen. Die valt buiten deze schatting.`,
    },
  };
  const t = (lang) => T[lang] || T.en;

  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const isActiveCar = window.TEX_ACTIVE || ((c) => !c.status || c.status === 'active');

  function carCardsHTML(fleet, selectedSlug, lang) {
    const P = priceCfg(lang);
    return fleet.filter(isActiveCar).map((car) => `
      <button type="button" class="q-carcard${car.slug === selectedSlug ? ' is-sel' : ''}" data-car="${esc(car.slug)}">
        <img src="../${esc(car.image)}" alt="${esc(car.name)}" loading="lazy"
             onerror="this.src='../assets/img/car-placeholder.svg'">
        <span class="q-carcard__body">
          <span class="q-carcard__cls">${esc(car.class)}</span>
          <span class="q-carcard__name">${esc(car.name)}</span>
          <span class="q-carcard__price">${money(car[P.day], P)}${t(lang).perDay}</span>
        </span>
      </button>`).join('');
  }
```

Extend `PURE` with `carCardsHTML`.

Then open the DOM layer. Add this after `window.TEX_QUIZ = PURE;`:

```js
  /* ============================================
     DOM layer. Nothing below runs until DOMContentLoaded, which is what
     lets the Node tests load this file with a stub document.
     ============================================ */
  const lang = () => (window.TEX_i18n ? window.TEX_i18n.getLang() : 'en');

  const state = {
    carKey: '', startDate: '', endDate: '',
    delivery: '', deliveryNote: '', name: '', phone: '',
  };

  let steps = [], dots = [], current = 0;
  let els = {};

  function show(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => s.classList.toggle('is-active', k === current));
    dots.forEach((d, k) => d.classList.toggle('on', k <= current));
    clearError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setError(msg) {
    const box = steps[current] && steps[current].querySelector('.q-error');
    if (box) box.textContent = msg;
  }
  const clearError = () => setError('');

  function renderCars() {
    if (!els.cars) return;
    els.cars.innerHTML = carCardsHTML(FLEET, state.carKey, lang());
  }

  function boot() {
    steps = Array.from(document.querySelectorAll('.q-step'));
    dots = Array.from(document.querySelectorAll('.quiz-progress i'));
    els = {
      cars: document.getElementById('qCars'),
      cal: document.getElementById('qCal'),
    };

    // Arrived from a fleet card: /book/?car=hyundai-i10 preselects it.
    const wanted = new URLSearchParams(window.location.search).get('car');
    if (wanted && carBySlug(wanted)) state.carKey = wanted;

    if (els.cars) {
      els.cars.addEventListener('click', (e) => {
        const card = e.target.closest('[data-car]');
        if (!card) return;
        state.carKey = card.dataset.car;
        clearError();
        renderCars();
        show(current + 1);
      });
    }

    document.querySelectorAll('[data-next]').forEach((b) =>
      b.addEventListener('click', () => {
        const msg = validateStep(steps[current].dataset.validate, state, arubaTodayISO(), lang());
        if (msg) { setError(msg); return; }
        show(current + 1);
      }));
    document.querySelectorAll('[data-back]').forEach((b) =>
      b.addEventListener('click', () => show(current - 1)));

    render();
    show(0);
  }

  /* Everything the language can change is re-rendered here, which is why
     the estimate never gets stranded in the previous language. */
  function render() {
    renderCars();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('langchange', render);
```

Add a placeholder validator so `boot` does not throw before Task 9 lands. Put it just above `boot`:

```js
  /* Filled in per step in Task 9; car is the only step that exists yet. */
  function validateStep(kind, s, todayISO, l) {
    if (kind === 'car') return s.carKey ? '' : t(l).errCar;
    return '';
  }
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 46 tests pass, 0 fail.

Then check it in a browser:

```bash
cd /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental && python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/book/`. Expected: six car cards with photos and dollar rates, tapping one outlines it in blue and advances to the empty dates step, the progress dots light up two of five, tapping NL swaps the headings to Dutch and leaves the card selected. Open `http://localhost:8000/book/?car=kia-rio`. Expected: the Kia Rio card is already outlined on load.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/scripts/quiz.js tools/site-tests/quiz-pure.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: step 1 car cards and the step engine

Renderers are pure functions returning HTML strings, so the Node tests
can check them; the DOM layer only assigns innerHTML and binds clicks."
```

---

## Task 8: Step 2, the two month calendar, with all three Little John bugs fixed

**Files:**
- Modify: `site/scripts/quiz.js` (add the calendar renderers and `pickDay` to the pure block, wire the calendar in `boot`)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: `isoOf`, `arubaTodayISO`, `daysBetween`, `fmtDate`, `monthLabel`, `t`, `esc`, `MAX_AHEAD_MONTHS`.
- Produces:
  - `pickDay(state: {startDate, endDate}, iso: string): { startDate: string, endDate: string, moved: boolean }`
  - `hintText(state: object, lang: string, moved: boolean): string`
  - `monthBlockHTML(y: number, mZeroBased: number, state: object, todayISO: string, maxISO: string, lang: string): string`
  - `calendarHTML(view: {y, m}, state: object, todayISO: string, lang: string, moved: boolean): string`

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
test('pickDay sets the pick-up day first', () => {
  assert.deepEqual(pure.pickDay({ startDate: '', endDate: '' }, '2026-03-14'),
    { startDate: '2026-03-14', endDate: '', moved: false });
});

test('pickDay sets the return day second', () => {
  assert.deepEqual(pure.pickDay({ startDate: '2026-03-14', endDate: '' }, '2026-03-20'),
    { startDate: '2026-03-14', endDate: '2026-03-20', moved: false });
});

/* The Little John original wipes both dates here with no message at all
   (its quiz.js:176). Same reset, but it reports itself. */
test('pickDay announces the reset when you tap at or before the pick-up day', () => {
  assert.deepEqual(pure.pickDay({ startDate: '2026-03-14', endDate: '' }, '2026-03-10'),
    { startDate: '2026-03-10', endDate: '', moved: true });
  assert.deepEqual(pure.pickDay({ startDate: '2026-03-14', endDate: '' }, '2026-03-14'),
    { startDate: '2026-03-14', endDate: '', moved: true });
});

test('pickDay announces the reset when a finished range is restarted', () => {
  assert.deepEqual(pure.pickDay({ startDate: '2026-03-14', endDate: '2026-03-20' }, '2026-03-25'),
    { startDate: '2026-03-25', endDate: '', moved: true });
});

test('hintText walks the customer through the two taps', () => {
  const empty = { startDate: '', endDate: '' };
  const half = { startDate: '2026-03-14', endDate: '' };
  const full = { startDate: '2026-03-14', endDate: '2026-03-20' };
  assert.equal(pure.hintText(empty, 'en', false), 'Tap your pick-up day.');
  assert.equal(pure.hintText(half, 'en', false), 'Now tap your return day.');
  assert.equal(pure.hintText(full, 'en', false), 'Sat 14 Mar → Fri 20 Mar · 6 days');
  assert.equal(pure.hintText(empty, 'nl', false), 'Tik je ophaaldag aan.');
  assert.equal(pure.hintText(full, 'nl', false), 'za 14 mrt → vr 20 mrt · 6 dagen');
});

/* Verbatim from spec section 4, step 2, fix 3. */
test('hintText announces a mis-tap in the exact words the spec fixes', () => {
  const half = { startDate: '2026-03-14', endDate: '' };
  assert.equal(pure.hintText(half, 'en', true), 'Start date moved to Sat 14 Mar. Now tap your return day.');
  assert.equal(pure.hintText(half, 'nl', true), 'Startdatum verplaatst naar za 14 mrt. Tik nu je terugbrengdag aan.');
});

test('monthBlockHTML greys out days before today in Aruba, never device days', () => {
  const html = pure.monthBlockHTML(2026, 2, { startDate: '', endDate: '' }, '2026-03-15', '2027-03-15', 'en');
  assert.match(html, /data-day="2026-03-14"[^>]*disabled/);
  assert.ok(!/data-day="2026-03-15"[^>]*disabled/.test(html), 'today in Aruba is bookable');
  assert.ok(!/data-day="2026-03-16"[^>]*disabled/.test(html));
});

test('monthBlockHTML greys out days past the 365 day advance limit', () => {
  const html = pure.monthBlockHTML(2027, 2, { startDate: '', endDate: '' }, '2026-03-15', '2027-03-15', 'en');
  assert.ok(!/data-day="2027-03-15"[^>]*disabled/.test(html));
  assert.match(html, /data-day="2027-03-16"[^>]*disabled/);
});

test('monthBlockHTML draws the edges and the middle of the range', () => {
  const html = pure.monthBlockHTML(2026, 2, { startDate: '2026-03-14', endDate: '2026-03-20' }, '2026-03-01', '2027-03-01', 'en');
  assert.match(html, /class="cal2-day edge" data-day="2026-03-14"/);
  assert.match(html, /class="cal2-day edge" data-day="2026-03-20"/);
  assert.match(html, /class="cal2-day mid" data-day="2026-03-17"/);
  assert.match(html, /class="cal2-day" data-day="2026-03-25"/);
});

test('monthBlockHTML puts Monday first and pads the lead-in', () => {
  const html = pure.monthBlockHTML(2026, 2, { startDate: '', endDate: '' }, '2026-01-01', '2027-01-01', 'en');
  assert.ok(html.indexOf('<span class="dow">Mo</span>') < html.indexOf('<span class="dow">Su</span>'));
  // 1 March 2026 is a Sunday, so six blank cells lead in
  assert.equal((html.match(/<span><\/span>/g) || []).length, 6);
});

test('calendarHTML shows two months side by side with capped arrows', () => {
  const s = { startDate: '', endDate: '' };
  const html = pure.calendarHTML({ y: 2026, m: 8 }, s, '2026-09-09', 'en', false);
  assert.ok(html.includes('September 2026'));
  assert.ok(html.includes('October 2026'));
  assert.match(html, /data-cal="-1"[^>]*disabled/, 'cannot page back before this month');
  assert.ok(!/data-cal="1"[^>]*disabled/.test(html));

  const far = pure.calendarHTML({ y: 2027, m: 7 }, s, '2026-09-09', 'en', false);
  assert.match(far, /data-cal="1"[^>]*disabled/, 'capped at twelve months ahead');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/quiz-pure.test.mjs
```

Expected failure: `TypeError: pure.pickDay is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, add above `const PURE`:

```js
  /* ---------- the calendar ----------
     Two months at a time, tap the pick-up day then the return day.
     Ported from the Little John engine with its three real bugs fixed:
     today comes from Aruba, cells clear 44px (see main.css), and a mis-tap
     announces itself instead of silently wiping both dates. */
  function pickDay(s, iso) {
    const restarting = !s.startDate || (s.startDate && s.endDate) || iso <= s.startDate;
    if (restarting) return { startDate: iso, endDate: '', moved: Boolean(s.startDate) };
    return { startDate: s.startDate, endDate: iso, moved: false };
  }

  function hintText(s, lang, moved) {
    const L = t(lang);
    if (!s.startDate) return L.hintStart;
    if (!s.endDate) return moved ? L.moved(fmtDate(s.startDate, lang)) : L.hintEnd;
    const n = daysBetween(s.startDate, s.endDate);
    return `${fmtDate(s.startDate, lang)} → ${fmtDate(s.endDate, lang)} · ${L.days(n)}`;
  }

  function monthBlockHTML(y, m, s, todayISO, maxISO, lang) {
    let html = `<div class="cal2-month"><p class="cal2-title">${esc(monthLabel(y, m, lang))}</p><div class="cal2-grid">`;
    for (const d of t(lang).dows) html += `<span class="dow">${d}</span>`;
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday first
    for (let i = 0; i < lead; i++) html += '<span></span>';
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= dim; d++) {
      const iso = isoOf(y, m, d);
      let cls = 'cal2-day';
      if (iso === s.startDate || (s.endDate && iso === s.endDate)) cls += ' edge';
      else if (s.startDate && s.endDate && iso > s.startDate && iso < s.endDate) cls += ' mid';
      const off = iso < todayISO || iso > maxISO ? ' disabled' : '';
      html += `<button type="button" class="${cls}" data-day="${iso}"${off}>${d}</button>`;
    }
    return html + '</div></div>';
  }

  function calendarHTML(view, s, todayISO, lang, moved) {
    const L = t(lang);
    const maxISO = addDaysISO(todayISO, MAX_AHEAD_DAYS);
    const [ty, tm] = parts(todayISO);
    const delta = (view.y - ty) * 12 + (view.m - (tm - 1));
    const next = { y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 };
    return `<div class="cal2-nav-row">
        <button type="button" class="cal2-nav" data-cal="-1" aria-label="${L.prevMonth}"${delta <= 0 ? ' disabled' : ''}>&lsaquo;</button>
        <button type="button" class="cal2-nav" data-cal="1" aria-label="${L.nextMonth}"${delta >= MAX_AHEAD_MONTHS - 1 ? ' disabled' : ''}>&rsaquo;</button>
      </div>
      <div class="cal2-months">${monthBlockHTML(view.y, view.m, s, todayISO, maxISO, lang)}${monthBlockHTML(next.y, next.m, s, todayISO, maxISO, lang)}</div>
      <p class="cal2-hint">${esc(hintText(s, lang, moved))}</p>`;
  }
```

Extend `PURE` with `pickDay, hintText, monthBlockHTML, calendarHTML`.

In the DOM layer, add the calendar view state next to `state`:

```js
  const view = { y: 0, m: 0 };
  let moved = false;   // true right after a mis-tap reset, so the hint says so
```

Add `renderCal` next to `renderCars`:

```js
  function renderCal() {
    if (!els.cal) return;
    els.cal.innerHTML = calendarHTML(view, state, arubaTodayISO(), lang(), moved);
  }
```

In `boot`, after the `els` assignment, seed the view and bind the calendar:

```js
    const [ty, tm] = arubaTodayISO().split('-').map(Number);
    view.y = ty; view.m = tm - 1;

    if (els.cal) {
      els.cal.addEventListener('click', (e) => {
        const nav = e.target.closest('[data-cal]');
        if (nav && !nav.disabled) {
          const step = Number(nav.dataset.cal);
          const t2 = new Date(Date.UTC(view.y, view.m + step, 1));
          view.y = t2.getUTCFullYear(); view.m = t2.getUTCMonth();
          renderCal();
          return;
        }
        const day = e.target.closest('[data-day]');
        if (!day || day.disabled) return;
        clearError();
        const picked = pickDay(state, day.dataset.day);
        state.startDate = picked.startDate;
        state.endDate = picked.endDate;
        moved = picked.moved;
        renderCal();
      });
    }
```

Extend `render()` so the language switch redraws the calendar too:

```js
  function render() {
    renderCars();
    renderCal();
  }
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 57 tests pass, 0 fail.

Then, with `python3 -m http.server 8000 --directory site` running, open `http://localhost:8000/book/`, pick a car, and check on the dates step: two months render, today in Aruba is tappable, yesterday is greyed, the left arrow is disabled, tapping a day then a later day fills the range in blue, tapping an earlier day resets and the hint reads "Start date moved to …". Switch to NL and confirm the hint and the month titles turn Dutch without losing the dates.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/scripts/quiz.js tools/site-tests/quiz-pure.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: the two month calendar, with the three Little John bugs fixed

Today comes from Intl in America/Aruba, the cells clear 44px, and a
mis-tap announces the reset instead of silently wiping both dates."
```

---

## Task 9: Steps 3 and 4, and the real per step validation

**Files:**
- Modify: `site/scripts/quiz.js` (replace the placeholder `validateStep`, add the step 3 and step 4 bindings in `boot`)
- Test: `tools/site-tests/quiz-pure.test.mjs`

**Interfaces:**
- Consumes: `daysBetween`, `normalisePhone`, `addDaysISO`, `MAX_SPAN_DAYS`, `MAX_AHEAD_DAYS`, `t`.
- Produces:
  - `validateStep(kind: 'car'|'dates'|'delivery'|'who'|'none', state: object, todayISO: string, lang: string): string` (empty string means valid)
  - The step 3 and 4 bindings write `state.delivery`, `state.deliveryNote`, `state.name`, `state.phone`.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
const TODAY = '2026-09-09';
const base = {
  carKey: 'hyundai-i10', startDate: '2026-09-20', endDate: '2026-09-26',
  delivery: 'hotel', deliveryNote: '', name: 'Monischa', phone: '+2975601234',
};

test('validateStep passes a complete answer at every step', () => {
  for (const kind of ['car', 'dates', 'delivery', 'who', 'none']) {
    assert.equal(pure.validateStep(kind, base, TODAY, 'en'), '', `${kind} should pass`);
  }
});

test('validateStep asks for a car', () => {
  assert.equal(pure.validateStep('car', { ...base, carKey: '' }, TODAY, 'en'), 'Tap the car you would like.');
  assert.equal(pure.validateStep('car', { ...base, carKey: 'not-a-car' }, TODAY, 'en'), 'Tap the car you would like.');
  assert.equal(pure.validateStep('car', { ...base, carKey: '' }, TODAY, 'nl'), 'Tik de auto aan die je wil.');
});

test('validateStep asks for both dates and a return day after the pick-up day', () => {
  const msg = 'Tap a pick-up day and a return day on the calendar.';
  assert.equal(pure.validateStep('dates', { ...base, endDate: '' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('dates', { ...base, startDate: '' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('dates', { ...base, endDate: base.startDate }, TODAY, 'en'), msg);
});

test('validateStep re-checks the three server rules in the browser too', () => {
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-08', endDate: '2026-09-12' }, TODAY, 'en'),
    'Tap a pick-up day and a return day on the calendar.', 'a start before today in Aruba is rejected');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2027-09-10', endDate: '2027-09-14' }, TODAY, 'en'),
    'Tap a pick-up day and a return day on the calendar.', 'more than 365 days ahead is rejected');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-20', endDate: '2026-12-20' }, TODAY, 'en'),
    'Ninety days is the longest we can take here. Ask Tex on WhatsApp for a longer rental.');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-20', endDate: '2026-12-19' }, TODAY, 'en'),
    '', 'exactly ninety days is allowed');
});

test('validateStep asks where the car should go', () => {
  assert.equal(pure.validateStep('delivery', { ...base, delivery: '' }, TODAY, 'en'), 'Tell us where you would like the car.');
  assert.equal(pure.validateStep('delivery', { ...base, delivery: 'desk' }, TODAY, 'en'), 'Tell us where you would like the car.');
});

test('validateStep wants a name of two to sixty characters', () => {
  const msg = 'We need a name so Tex knows who to answer.';
  assert.equal(pure.validateStep('who', { ...base, name: '' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, name: 'M' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, name: 'x'.repeat(61) }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, name: 'Mo' }, TODAY, 'en'), '');
});

test('validateStep requires a WhatsApp number, per D5', () => {
  const msg = 'Add your WhatsApp number with the country code.';
  assert.equal(pure.validateStep('who', { ...base, phone: '' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, phone: '5601234' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, phone: '+297 560 1234' }, TODAY, 'en'), '');
  assert.equal(pure.validateStep('who', { ...base, phone: '' }, TODAY, 'nl'), 'Vul je WhatsApp nummer in met landcode.');
});

test('validateStep checks the name before the phone, so one message shows at a time', () => {
  assert.equal(pure.validateStep('who', { ...base, name: '', phone: '' }, TODAY, 'en'),
    'We need a name so Tex knows who to answer.');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/quiz-pure.test.mjs
```

Expected failure: `TypeError: pure.validateStep is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, delete the placeholder `validateStep` from Task 7 and add this to the pure block, above `const PURE`:

```js
  /* ---------- validation ----------
     The same three date rules run again on the server, because the browser
     is not trusted. These exist so the customer is told before they send. */
  function validateStep(kind, s, todayISO, lang) {
    const L = t(lang);
    if (kind === 'car') return carBySlug(s.carKey) ? '' : L.errCar;

    if (kind === 'dates') {
      const days = daysBetween(s.startDate, s.endDate);
      if (!s.startDate || !s.endDate || days <= 0) return L.errDates;
      if (s.startDate < todayISO) return L.errDates;
      if (s.startDate > addDaysISO(todayISO, MAX_AHEAD_DAYS)) return L.errDates;
      if (days > MAX_SPAN_DAYS) return L.errSpan;
      return '';
    }

    if (kind === 'delivery') return ['airport', 'hotel', 'pickup'].includes(s.delivery) ? '' : L.errDelivery;

    if (kind === 'who') {
      const name = String(s.name || '').trim();
      if (name.length < 2 || name.length > 60) return L.errName;
      if (!normalisePhone(s.phone)) return L.errPhone;
      return '';
    }
    return '';
  }
```

Extend `PURE` with `validateStep`.

In `boot`, extend the `els` map and add the step 3 and step 4 bindings, right after the calendar binding:

```js
    els.note = document.getElementById('qNote');
    els.noteCount = document.getElementById('qNoteCount');
    els.name = document.getElementById('qName');
    els.phone = document.getElementById('qPhone');
    els.website = document.getElementById('qWebsite');

    document.querySelectorAll('[data-delivery]').forEach((b) =>
      b.addEventListener('click', () => {
        state.delivery = b.dataset.delivery;
        document.querySelectorAll('[data-delivery]').forEach((x) => x.classList.toggle('is-sel', x === b));
        clearError();
      }));

    if (els.note) {
      els.note.addEventListener('input', () => {
        state.deliveryNote = els.note.value.slice(0, NOTE_MAX).trim();
        // the counter only appears once the 200 character cap is in sight
        const used = els.note.value.length;
        els.noteCount.hidden = used < NOTE_COUNTER_FROM;
        els.noteCount.textContent = `${used} / ${NOTE_MAX}`;
      });
    }
    if (els.name) els.name.addEventListener('input', () => { state.name = els.name.value.trim(); clearError(); });
    if (els.phone) els.phone.addEventListener('input', () => { state.phone = els.phone.value; clearError(); });
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 65 tests pass, 0 fail.

Then, with the server running, walk `http://localhost:8000/book/` to step 3: tapping Continue with nothing chosen shows "Tell us where you would like the car.", choosing one clears it, typing 150 characters in the note reveals the counter and typing stops at 200. On step 4, Continue with an empty name shows the name message, a valid name and a seven digit phone shows the phone message, and `+297 560 1234` advances.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/scripts/quiz.js tools/site-tests/quiz-pure.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: delivery, name and phone steps with real validation

The three date rules the server re-checks are also checked here, so the
customer is told before they send rather than after."
```

---

## Task 10: The send step, the two taps, and the whole G1 case table

**Files:**
- Modify: `site/scripts/quiz.js` (add the send renderers and `requestBody` to the pure block, add the send wiring to `boot`)
- Test: `tools/site-tests/quiz-pure.test.mjs`, `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: `estimateFor`, `priceCfg`, `money`, `fmtDate`, `daysBetween`, `carBySlug`, `normalisePhone`, `buildWaText`, `waHref`, `t`, `WA_WHERE`, `SEND_TIMEOUT_MS`, `CFG.requestsOn`, `CFG.bookingUrl`.
- Produces:
  - `estimateSentence(state: object, lang: string): string`
  - `depositSentence(state: object, lang: string): string`
  - `recapValues(state: object, lang: string): { car, from, until, est, where, note, name, phone }`
  - `requestBody(state: object, lang: string, website: string): object` (exactly the ten keys in spec section 7)
  - `endpointUrl(cfg: object): string`

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/quiz-pure.test.mjs`:

```js
const SEND = {
  carKey: 'hyundai-i10', startDate: '2026-03-14', endDate: '2026-03-20',
  delivery: 'hotel', deliveryNote: 'Divi Village, arriving 11:00',
  name: 'Monischa', phone: '+297 560 1234',
};

/* Verbatim from spec section 5. The word estimate leads the sentence in
   both languages, and no bare currency figure stands on its own. */
test('estimateSentence is the exact sentence the customer reads', () => {
  assert.equal(pure.estimateSentence(SEND, 'en'), 'Estimate: $210 for 6 days. Tex confirms the final price on WhatsApp.');
  assert.equal(pure.estimateSentence(SEND, 'nl'), 'Schatting: $210 voor 6 dagen. Tex bevestigt de definitieve prijs via WhatsApp.');
});

test('depositSentence keeps the deposit outside the estimate', () => {
  assert.equal(pure.depositSentence(SEND, 'en'), 'A refundable deposit of $250 is arranged when you pick the car up. It is not part of this estimate.');
  assert.equal(pure.depositSentence(SEND, 'nl'), 'Een borg van $250 regel je bij het ophalen. Die valt buiten deze schatting.');
  assert.equal(pure.depositSentence(SEND, 'pap'), 'A refundable deposit of Afl. 500 is arranged when you pick the car up. It is not part of this estimate.');
});

test('the words quote and total never reach the customer', () => {
  for (const lang of ['en', 'nl']) {
    const both = pure.estimateSentence(SEND, lang) + ' ' + pure.depositSentence(SEND, lang);
    assert.equal(/quote|total/i.test(both), false, both);
  }
});

test('recapValues fills all eight rows', () => {
  const r = pure.recapValues(SEND, 'en');
  assert.equal(r.car, 'Hyundai i10 (Economy)');
  assert.equal(r.from, 'Sat 14 Mar');
  assert.equal(r.until, 'Fri 20 Mar');
  assert.equal(r.est, '$210');
  assert.equal(r.where, 'Bring it to my hotel');
  assert.equal(r.note, 'Divi Village, arriving 11:00');
  assert.equal(r.name, 'Monischa');
  assert.equal(r.phone, '+2975601234', 'the recap shows the number as it will be stored');
});

test('recapValues translates the delivery row', () => {
  assert.equal(pure.recapValues(SEND, 'nl').where, 'Breng hem naar mijn hotel');
  assert.equal(pure.recapValues({ ...SEND, delivery: 'pickup' }, 'nl').where, 'Ik haal hem op bij Tex');
});

/* Exactly the ten keys in spec section 7. The schema is strict, so an
   extra key is a 422. */
test('requestBody sends exactly the ten keys the endpoint accepts', () => {
  const body = pure.requestBody(SEND, 'en', '');
  assert.deepEqual(Object.keys(body).sort(), [
    'carKey', 'deliveryNote', 'delivery', 'endDate', 'estimateCents',
    'lang', 'name', 'phone', 'startDate', 'website',
  ].sort());
});

test('requestBody normalises the phone and sends the estimate in cents', () => {
  const body = pure.requestBody(SEND, 'en', '');
  assert.equal(body.carKey, 'hyundai-i10');
  assert.equal(body.startDate, '2026-03-14');
  assert.equal(body.endDate, '2026-03-20');
  assert.equal(body.delivery, 'hotel');
  assert.equal(body.deliveryNote, 'Divi Village, arriving 11:00');
  assert.equal(body.name, 'Monischa');
  assert.equal(body.phone, '+2975601234');
  assert.equal(body.lang, 'en');
  assert.equal(body.estimateCents, 21000);
  assert.equal(body.website, '');
});

test('requestBody never sends a car name or a class, which the server derives', () => {
  const json = JSON.stringify(pure.requestBody(SEND, 'en', ''));
  assert.equal(json.includes('Hyundai i10'), false);
  assert.equal(json.includes('Economy'), false);
});

test('requestBody passes a filled honeypot straight through', () => {
  assert.equal(pure.requestBody(SEND, 'en', 'http://spam.example').website, 'http://spam.example');
});

test('requestBody leaves estimateCents out of the JSON when there is no estimate', () => {
  const body = pure.requestBody({ ...SEND, endDate: '' }, 'en', '');
  assert.equal(body.estimateCents, undefined);
  assert.equal(JSON.stringify(body).includes('estimateCents'), false);
});

test('requestBody clamps lang to the two supported languages', () => {
  assert.equal(pure.requestBody(SEND, 'nl', '').lang, 'nl');
  assert.equal(pure.requestBody(SEND, 'pap', '').lang, 'en');
});

/* The server derives estimate_currency from the lang it is sent. If the
   figure were computed from the raw language and the lang were clamped
   afterwards, a Papiamento visitor would store 300 florin labelled USD. */
test('requestBody computes the estimate from the lang it actually sends', () => {
  const body = pure.requestBody(SEND, 'pap', '');
  assert.equal(body.lang, 'en');
  assert.equal(body.estimateCents, 21000, 'the stored figure is the dollar one, matching the stored currency');
  assert.notEqual(body.estimateCents, 30000, 'the florin figure must never be stored as USD');
  assert.equal(pure.requestBody(SEND, 'nl', '').estimateCents, 21000);
});

test('endpointUrl is the one path from C2, on the app origin', () => {
  assert.equal(pure.endpointUrl({ bookingUrl: 'https://app.tex-cars.com' }), 'https://app.tex-cars.com/api/booking-requests');
  assert.equal(pure.endpointUrl({ bookingUrl: 'https://app.tex-cars.com/' }), 'https://app.tex-cars.com/api/booking-requests');
  assert.equal(pure.endpointUrl({}), 'https://app.tex-cars.com/api/booking-requests');
});
```

Append to `tools/site-tests/markup.test.mjs`:

```js
const quiz = read('scripts/quiz.js');

test('the WhatsApp anchor href is written before the fetch is fired', () => {
  const send = quiz.slice(quiz.indexOf('async function send('));
  assert.ok(send.indexOf('openWa.href') > -1, 'the send flow must set the anchor href');
  assert.ok(send.indexOf('openWa.href') < send.indexOf('fetch('),
    'the href must be written from state the browser already holds, before the POST');
});

test('the abort is 4000 ms, not 2500 and not 6000', () => {
  assert.match(quiz, /SEND_TIMEOUT_MS\s*=\s*4000/);
  assert.match(quiz, /AbortController/);
});

test('the send flow reveals the anchor in a finally, so no path can skip it', () => {
  assert.match(quiz, /finally\s*\{[^}]*openWa\.hidden\s*=\s*false/s);
});

test('quiz.js opens no new tab and no window', () => {
  assert.equal(quiz.includes('window.open'), false);
  assert.equal(/target\s*=\s*['"]_blank['"]/.test(quiz), false);
});

test('the kill switch skips the POST entirely', () => {
  assert.match(quiz, /CFG\.requestsOn/);
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected failure: `TypeError: pure.estimateSentence is not a function`.

- [ ] **Step 3: Implement**

In `site/scripts/quiz.js`, add above `const PURE`:

```js
  /* ---------- the send screen ---------- */
  const RECAP_WHERE = {
    en: { airport: 'Bring it to the airport', hotel: 'Bring it to my hotel', pickup: 'I collect it at Tex' },
    nl: { airport: 'Breng hem naar het vliegveld', hotel: 'Breng hem naar mijn hotel', pickup: 'Ik haal hem op bij Tex' },
  };

  function estimateSentence(s, lang) {
    const car = carBySlug(s.carKey);
    const days = daysBetween(s.startDate, s.endDate);
    const est = estimateFor(car, days, lang);
    if (est === null) return '';
    return t(lang).estimate(money(est, priceCfg(lang)), t(lang).days(days));
  }

  /* A footnote, deliberately outside the estimate. */
  function depositSentence(s, lang) {
    const car = carBySlug(s.carKey);
    if (!car) return '';
    const P = priceCfg(lang);
    return t(lang).deposit(money(car[P.depositKey], P));
  }

  function recapValues(s, lang) {
    const car = carBySlug(s.carKey);
    const days = daysBetween(s.startDate, s.endDate);
    const est = estimateFor(car, days, lang);
    return {
      car: car ? `${car.name} (${car.class})` : '',
      from: s.startDate ? fmtDate(s.startDate, lang) : '',
      until: s.endDate ? fmtDate(s.endDate, lang) : '',
      est: est === null ? '' : money(est, priceCfg(lang)),
      where: (lang === 'nl' ? RECAP_WHERE.nl : RECAP_WHERE.en)[s.delivery] || '',
      note: s.deliveryNote || '',
      name: s.name || '',
      phone: normalisePhone(s.phone),
    };
  }

  /* Exactly the ten keys in the contract. The schema on the other side is
     strict, so an extra key is a 422. vehicleName and vehicleClass are
     deliberately absent: the server derives both from carKey. */
  function requestBody(s, lang, website) {
    /* Clamp first, then price. The server derives estimate_currency from the
       lang in this payload, so the figure has to come from the same language
       the payload carries. Pricing on the raw language and clamping after
       would store a florin number labelled USD for a Papiamento visitor.
       priceCfg keeps its pap branch for the page itself; only the stored
       number is pinned to the language actually sent. */
    const sendLang = lang === 'nl' ? 'nl' : 'en';
    const car = carBySlug(s.carKey);
    const days = daysBetween(s.startDate, s.endDate);
    const est = estimateFor(car, days, sendLang);
    return {
      carKey: s.carKey,
      startDate: s.startDate,
      endDate: s.endDate,
      delivery: s.delivery,
      deliveryNote: s.deliveryNote || '',
      name: String(s.name || '').trim(),
      phone: normalisePhone(s.phone),
      lang: sendLang,
      // undefined rather than null: JSON.stringify drops the key entirely, and
      // the schema on the other side takes an optional integer, never a null
      estimateCents: est === null ? undefined : est * 100,
      website: website || '',
    };
  }

  const endpointUrl = (cfg) =>
    `${(cfg.bookingUrl || 'https://app.tex-cars.com').replace(/\/$/, '')}/api/booking-requests`;
```

Extend `PURE` with `estimateSentence, depositSentence, recapValues, requestBody, endpointUrl`.

In the DOM layer, add the send renderer and the two tap flow. Add to `els` in `boot`:

```js
    els.estimate = document.getElementById('qEstimate');
    els.deposit = document.getElementById('qDeposit');
    els.sendBtn = document.getElementById('qSendBtn');
    els.status = document.getElementById('qStatus');
    els.openWa = document.getElementById('qOpenWa');
    els.recap = {
      rCar: document.getElementById('rCar'), rFrom: document.getElementById('rFrom'),
      rUntil: document.getElementById('rUntil'), rEst: document.getElementById('rEst'),
      rWhere: document.getElementById('rWhere'), rNote: document.getElementById('rNote'),
      rName: document.getElementById('rName'), rPhone: document.getElementById('rPhone'),
    };
    els.estRow = document.getElementById('rEstRow');
    els.noteRow = document.getElementById('rNoteRow');
```

Add `renderSend`, and call it from `render()`:

```js
  function renderSend() {
    if (!els.recap || !els.recap.rCar) return;
    const l = lang();
    const v = recapValues(state, l);
    els.recap.rCar.textContent = v.car;
    els.recap.rFrom.textContent = v.from;
    els.recap.rUntil.textContent = v.until;
    els.recap.rEst.textContent = v.est;
    els.recap.rWhere.textContent = v.where;
    els.recap.rNote.textContent = v.note;
    els.recap.rName.textContent = v.name;
    els.recap.rPhone.textContent = v.phone;
    if (els.estRow) els.estRow.hidden = !v.est;
    if (els.noteRow) els.noteRow.hidden = !v.note;
    if (els.estimate) els.estimate.textContent = estimateSentence(state, l);
    if (els.deposit) els.deposit.textContent = depositSentence(state, l);
    // The anchor is correct the moment the send screen renders, well before
    // anybody taps anything.
    if (els.openWa) els.openWa.href = waHref(state, l);
  }

  function render() {
    renderCars();
    renderCal();
    renderSend();
  }
```

One decision worth stating out loud before the code, so a later reader does not file it as a bug: with `requestsOn: false` the kill switch sets `ok = true`, so the customer reads "Sent. Now open WhatsApp so Tex sees it." while nothing was saved. That line stays exactly as it is, because the WhatsApp message carries the whole request and from the customer's side it genuinely was sent. Only the back office row is skipped, and a code comment in `send()` says so.

Add the two tap flow, just above `boot`:

```js
  /* Tap 1 saves. Tap 2 is a real anchor with no target, in the same tab,
     because _blank has no tab to open into inside the Instagram and
     Facebook webviews. WhatsApp opens in every case: the anchor is
     revealed in a finally, so no branch can skip it. */
  async function send() {
    const l = lang();
    const btn = els.sendBtn, openWa = els.openWa, status = els.status;

    openWa.href = waHref(state, l);   // written BEFORE the fetch, from state we hold

    btn.disabled = true;
    btn.textContent = t(l).sending;
    status.textContent = '';
    status.className = 'q-status';

    let ok = false;
    try {
      if (CFG.requestsOn === false) {
        // Kill switch: no POST at all, straight to WhatsApp. ok stays true on
        // purpose, so the customer still reads "Sent. Now open WhatsApp so Tex
        // sees it." even though nothing was saved. That is not a bug: the
        // WhatsApp message carries the whole request, so from the customer's
        // side it really was sent. Only the back office row is skipped.
        ok = true;
      } else {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
        try {
          const res = await fetch(endpointUrl(CFG), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody(state, l, els.website ? els.website.value : '')),
            signal: ctrl.signal,
          });
          ok = res.ok;
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (err) {
      ok = false;   // offline, aborted at 4000 ms, DNS, CORS: all the same to the customer
    } finally {
      status.textContent = ok ? t(l).sent : t(l).failed;
      status.className = 'q-status ' + (ok ? 'is-ok' : 'is-warn');
      openWa.hidden = false;
      btn.hidden = true;
    }
  }
```

Wire it in `boot`, after the step 4 bindings:

```js
    if (els.sendBtn) els.sendBtn.addEventListener('click', send);
```

And make the last `data-next` land on the send screen with a fresh recap: extend the `[data-next]` handler so it renders the send screen before showing it.

```js
    document.querySelectorAll('[data-next]').forEach((b) =>
      b.addEventListener('click', () => {
        const msg = validateStep(steps[current].dataset.validate, state, arubaTodayISO(), lang());
        if (msg) { setError(msg); return; }
        renderSend();
        show(current + 1);
      }));
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 83 tests pass, 0 fail.

Then walk the whole quiz at `http://localhost:8000/book/` and confirm the send screen shows all eight recap rows, the estimate sentence, the deposit footnote, the consent line with a working Privacy policy link, and that tapping Send request turns the button into "Sending…", then after at most four seconds shows a status line and reveals a green "Open WhatsApp" button. Because the app endpoint is not running locally, the expected local result is the failure line, "We could not save it here, so send it on WhatsApp instead. Nothing is lost.", and the anchor still opens WhatsApp with the full message. That is the G1 path, proven.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/scripts/quiz.js tools/site-tests
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "quiz: the send step, two taps, 4000ms abort, kill switch

The WhatsApp href is written before the fetch and the anchor is revealed
in a finally, so every row of the G1 case table ends in WhatsApp opening."
```

---

## Task 11: The requestsOn kill switch and the fleet.js drift comment

**Files:**
- Modify: `site/data/config.js:20-30`
- Modify: `site/data/fleet.js:1-17`
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `window.TEX_CONFIG.requestsOn: boolean`, read by `send()` from Task 10.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/markup.test.mjs`:

```js
import { loadSite } from './harness.mjs';

test('the kill switch exists and ships on', () => {
  const cfg = loadSite().window.TEX_CONFIG;
  assert.equal(cfg.requestsOn, true);
  assert.equal(typeof cfg.requestsOn, 'boolean');
});

test('the kill switch is documented next to bookingEnabled', () => {
  const config = read('data/config.js');
  assert.ok(config.indexOf('requestsOn') > config.indexOf('bookingEnabled'), 'it mirrors bookingEnabled');
  assert.match(config, /requestsOn[\s\S]{0,400}?WhatsApp/, 'the comment must say what false does');
});

test('fleet.js warns that the app duplicates these six keys', () => {
  const fleet = read('data/fleet.js');
  assert.match(fleet, /src\/lib\/requests\/catalog\.ts/, 'name the file that duplicates this one');
  assert.ok(fleet.indexOf('src/lib/requests/catalog.ts') < fleet.indexOf('window.TEX_FLEET'), 'the note goes at the top');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: undefined !== true`.

- [ ] **Step 3: Implement**

In `site/data/config.js`, add the flag directly under `bookingEnabled` at `:21`:

```js
window.TEX_CONFIG = {
  bookingEnabled: true,
  // The /book/ quiz saves each request to the app before it opens WhatsApp.
  // Set this to false and the quiz skips the POST entirely and goes straight
  // to the WhatsApp anchor: the customer still reaches Tex with the whole
  // request typed out, the back office just does not get a row. This is the
  // one minute rollback and it needs no app deploy.
  requestsOn: true,
```

In `site/data/fleet.js`, add to the top comment block, just above the closing `============================================ */` at `:17`:

```
   The six slug values below are also the car_key allowlist in the app, at
   src/lib/requests/catalog.ts, which maps each key to a display name and a
   class. The two lists are duplicates and will drift if these cards change.
   A unit test in the app asserts they match; nothing prevents the drift.
   These slugs are NOT app vehicle slugs: the app tracks individual cars by
   plate (hyundai-i10-v-7123), the site shows one car per model.
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 86 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/data/config.js site/data/fleet.js tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "config: requestsOn kill switch, and note the app side car allowlist

Flipping requestsOn to false skips the POST and still opens WhatsApp, so
the rollback needs no app deploy."
```

---

## Task 12: Guard localStorage in i18n.js

**Files:**
- Modify: `site/scripts/i18n.js:14-20` and `:39`
- Test: `tools/site-tests/i18n.test.mjs`

**Interfaces:**
- Consumes: the `loadSite({ files, storage })` harness from Task 1.
- Produces: `window.TEX_i18n` is defined even when `localStorage` throws, so the `langchange` event still fires and the quiz's language driven estimate re-render still runs.

Why this matters here and not only on the homepage: line 15 sits inside the top level `DEFAULT` immediately invoked function, so a throw there aborts the whole module and `window.TEX_i18n` is never assigned. Under Safari's Block All Cookies and inside partitioned in app webviews, `localStorage` access throws `SecurityError`. Dutch would silently never render and the estimate would never re-render on a language switch.

- [ ] **Step 1: Write the failing test**

Create `tools/site-tests/i18n.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSite, read } from './harness.mjs';

/* Safari with "Block All Cookies" and partitioned in app webviews throw
   SecurityError on every localStorage touch, read as well as write. */
const blocked = {
  getItem() { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; },
  setItem() { const e = new Error('The operation is insecure.'); e.name = 'SecurityError'; throw e; },
};

const working = (() => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
})();

test('i18n still defines TEX_i18n when localStorage reads throw', () => {
  const { window } = loadSite({ files: ['scripts/i18n.js'], storage: blocked });
  assert.ok(window.TEX_i18n, 'a throw at the getItem line would abort the whole module');
  assert.equal(typeof window.TEX_i18n.applyLang, 'function');
  assert.equal(typeof window.TEX_i18n.getLang, 'function');
});

test('switching language still fires langchange when localStorage writes throw', () => {
  const { window, dispatched } = loadSite({ files: ['scripts/i18n.js'], storage: blocked });
  window.TEX_i18n.applyLang('nl');
  assert.ok(dispatched.some((e) => e.type === 'langchange' && e.detail.lang === 'nl'),
    'the estimate re-render hangs off this event');
});

test('a working localStorage still remembers the choice', () => {
  const { window } = loadSite({ files: ['scripts/i18n.js'], storage: working });
  window.TEX_i18n.applyLang('nl');
  assert.equal(working.getItem('tex_lang'), 'nl');
  const second = loadSite({ files: ['scripts/i18n.js'], storage: working });
  assert.ok(second.window.TEX_i18n, 'the stored value is still read back');
});

test('both localStorage calls are wrapped in try/catch', () => {
  const src = read('scripts/i18n.js');
  assert.equal((src.match(/localStorage\./g) || []).length, 2, 'still exactly two touches');
  for (const call of ['localStorage.getItem', 'localStorage.setItem']) {
    const at = src.indexOf(call);
    const before = src.slice(Math.max(0, at - 160), at);
    assert.match(before, /try\s*\{/, `${call} must sit inside a try block`);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/i18n.test.mjs
```

Expected failure: `Error: The operation is insecure.` thrown while evaluating `scripts/i18n.js`, before any assertion runs.

- [ ] **Step 3: Implement**

In `site/scripts/i18n.js`, replace the `DEFAULT` block at `:14-20`:

```js
  const DEFAULT = (() => {
    // Safari's "Block All Cookies" and partitioned in-app webviews throw
    // SecurityError here. A throw at this line aborts the whole module, so
    // window.TEX_i18n never exists and langchange never fires.
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('nl')) return 'nl';
    return 'en';
  })();
```

And replace `:39`:

```js
    try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 90 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/scripts/i18n.js tools/site-tests/i18n.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "i18n: guard both localStorage calls

A SecurityError at the getItem line aborted the module, so TEX_i18n was
never defined and langchange never fired. This fixes the homepage too."
```

---

## Task 13: Retire the homepage inquiry form

**Files:**
- Modify: `site/index.html:278-330` (the aside copy and the whole `<form id="inquiry-form">`)
- Modify: `site/scripts/main.js:127-140`, `:178-204`, `:206-244`, `:255-257`
- Modify: `site/styles/main.css` (three lines appended to the quiz block)
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This task only removes.

Nobody can send an unstructured inquiry from the homepage after this. That is D6, and it is a deliberate loss.

This task runs **before** the `bookUrl` change in Task 14, and the order is load bearing. `bookUrl` has two call sites today: the fleet card at `site/scripts/main.js:100` and the inquiry form's submit handler at `site/scripts/main.js:221`. Task 14 changes the signature from `(params = {})` to `(slug)`. If that landed first, the surviving call at `:221` would pass an object where a string is expected and submitting the homepage form would navigate to `/book/?car=%5Bobject%20Object%5D` for one whole commit. Retiring the form first deletes that call site, so every commit leaves the site working.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/markup.test.mjs`:

```js
const index = read('index.html');
const mainJs = read('scripts/main.js');

test('the homepage inquiry form is gone', () => {
  assert.equal(index.includes('id="inquiry-form"'), false);
  for (const id of ['f-name', 'f-email', 'f-pickup', 'f-return', 'f-car', 'f-msg', 'daycount']) {
    assert.equal(index.includes(`id="${id}"`), false, `${id} belonged to the retired form`);
  }
});

/* Spec section 11: one line of copy and one button. Nothing else. */
test('a short call to action stands where the form stood', () => {
  assert.match(index, /class="inquiry__cta"/);
  const start = index.indexOf('class="inquiry__cta"');
  const cta = index.slice(start, index.indexOf('</div>', start) + 6);
  assert.equal((cta.match(/<p[\s>]/g) || []).length, 1, 'exactly one line of copy');
  assert.equal((cta.match(/<a[\s>]/g) || []).length, 1, 'exactly one button');
  assert.equal(/<h[1-6][\s>]/.test(cta), false, 'no heading: the spec says one line and one button');
  assert.match(cta, /href="\/book\/"/);
  assert.ok(cta.includes('data-en="Request a car"'));
});

test('the aside no longer promises secure online booking', () => {
  assert.equal(index.includes('secure online booking'), false);
  assert.equal(index.includes('veilige online boeking'), false);
});

test('the JavaScript that existed only for that form is gone too', () => {
  for (const dead of ['renderClassOptions', '#inquiry-form', "$('#f-pickup')", 'daysLabel', 'updateDays']) {
    assert.equal(mainJs.includes(dead), false, `${dead} served only the retired form`);
  }
});

test('the fleet and rates renderers still boot and still follow the language', () => {
  assert.match(mainJs, /function boot\(\) \{ renderFleet\(\); renderRates\(\); observeReveal\(\); \}/);
  assert.match(mainJs, /window\.addEventListener\('langchange', \(\) => \{ renderFleet\(\); renderRates\(\); \}\);/);
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: true !== false` on `id="inquiry-form"`.

- [ ] **Step 3: Implement**

In `site/index.html`, replace the aside paragraph at `:278-279` with a version that has no `data-book-*` variants, so the bridge cannot swap wrong wording back in:

```html
            <p data-en="Tell us which car and which days. Tex answers you on WhatsApp, usually within minutes." data-nl="Vertel ons welke auto en welke dagen. Tex antwoordt je op WhatsApp, meestal binnen enkele minuten." data-es="Envía una solicitud y confirmamos disponibilidad y entrega por WhatsApp. ¿Prefieres chatear? Escríbenos." data-pap="Mandá un petishon i nos ta konfirmá disponibilidat i entrega via WhatsApp. Bo ke chat? Mandá nos mensahe direkt.">Tell us which car and which days. Tex answers you on WhatsApp, usually within minutes.</p>
```

Then replace the whole `<form class="inquiry__form" id="inquiry-form" novalidate> … </form>` block at `:287-330` with exactly one line of copy and one button, which is all spec section 11 asks for:

```html
          <div class="inquiry__cta">
            <p data-en="Pick your car, tap your days, tell us where you want it, and leave your WhatsApp number. Nothing is reserved until Tex confirms it." data-nl="Kies je auto, tik je dagen aan, vertel ons waar je hem wil hebben en laat je WhatsApp nummer achter. Er is niets gereserveerd tot Tex het bevestigt.">Pick your car, tap your days, tell us where you want it, and leave your WhatsApp number. Nothing is reserved until Tex confirms it.</p>
            <a class="btn btn--primary btn--lg" href="/book/" data-en="Request a car" data-nl="Vraag een auto aan">Request a car</a>
          </div>
```

Add its styles at the end of the quiz block in `site/styles/main.css`:

```css
/* ---------- Homepage call to action, where the inquiry form used to be ---------- */
.inquiry__cta { background: #fff; color: var(--ink); padding: clamp(1.8rem, 4vw, 3rem); display: grid; gap: 1rem; align-content: center; justify-items: start; }
.inquiry__cta p { color: var(--ink-soft); }
```

In `site/scripts/main.js`, delete four blocks and nothing else:

1. `renderClassOptions` at `:127-140`, the whole function and its `/* ---------- Car-class options … ---------- */` comment.
2. The `/* ---------- Date-range picker ---------- */` block at `:178-204`, from the comment through the closing brace of `if (pickup && ret) { … }`.
3. The `/* ---------- Inquiry form … ---------- */` block at `:206-244`, from the comment through the closing brace of `if (form) { … }`. This is the block that holds the second `bookUrl` call site at `:221`.
4. The two call sites at `:255-257`, which become:

```js
  /* ---------- Boot + re-render on language change ---------- */
  function boot() { renderFleet(); renderRates(); observeReveal(); }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('langchange', () => { renderFleet(); renderRates(); });
```

Leave the `T` micro translation table alone. Some of its keys are now unused, but it is data that `renderFleet` still reads from, and editing it is not in scope.

After this edit `site/index.html` is 41 lines shorter: 2 lines become 1 in the aside, and 44 lines become 4 where the form stood. Everything below the old `:330` moves up by 41. Tasks 14, 15 and 16 all say so where it matters.

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 95 tests pass, 0 fail.

Then reload `http://localhost:8000/`, open the browser console, and confirm: the Contact section shows the call to action card instead of the form, there are no console errors on load, the language toggle still re-renders the fleet cards and the rates table, the six fleet card buttons still work (they still point at the app wizard at this commit, which Task 14 changes), and the FAQ accordion still opens.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/index.html site/scripts/main.js site/styles/main.css tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "site: retire the homepage inquiry form for a call to action

D6. The form's JavaScript goes with it: the class options, the date range
picker and the submit handler existed only to serve it. The handler held
the second bookUrl call site, which is why this lands before Task 14."
```

---

## Task 14: Repoint all four booking surfaces

**Files:**
- Modify: `site/index.html:62`, `site/index.html:102`, and the footer anchor (`:403` on the file as it stands today, `:362` after Task 13 shortens it by 41 lines; find it by its `data-booking-href="/book"` attribute inside `<footer>`, it is the only one left)
- Modify: `site/scripts/main.js:17-20` and `site/scripts/main.js:100`
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `bookUrl(slug: string): string` returning `/book/?car=<slug>`, used only by `renderFleet`.

There are four entry points, not three. The fourth is generated in JavaScript and no edit to `index.html` reaches it.

The signature change is safe here and only here: Task 13 already deleted the inquiry form's submit handler, which held the only other `bookUrl` call site. After Task 13 the sole caller is the fleet card at `:100`, and this task changes the two together in one commit.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/markup.test.mjs`. `index` and `mainJs` are already declared in the Task 13 block above.

```js
test('no booking anchor is left pointing at the app wizard', () => {
  assert.equal(index.includes('data-booking-href="/book"'), false,
    'the bridge rewrite loop must not reach these three anchors any more');
});

test('the three static call to action anchors go to the local quiz', () => {
  const anchors = [...index.matchAll(/<a[^>]*data-book-en="[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(anchors.length, 3, 'nav, hero and footer');
  for (const a of anchors) {
    assert.match(a, /href="\/book\/"/, a);
    assert.equal(/target\s*=/.test(a), false, 'no new tab: ' + a);
    assert.equal(/rel\s*=/.test(a), false, 'rel goes with target: ' + a);
    assert.match(a, /data-en="Request a car"/, a);
    assert.match(a, /data-nl="Vraag een auto aan"/, a);
    assert.match(a, /data-book-en="Request a car"/, a);
    assert.match(a, /data-book-nl="Vraag een auto aan"/, a);
  }
});

test('the fleet card links are generated at /book/ with the car slug', () => {
  assert.match(mainJs, /const bookUrl = \(slug\) => `\/book\/\?car=\$\{encodeURIComponent\(slug\)\}`;/);
  assert.match(mainJs, /href="\$\{bookUrl\(car\.slug\)\}"/);
  assert.equal(mainJs.includes('CFG.bookingUrl'), false, 'the fleet cards no longer leave this origin');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `AssertionError [ERR_ASSERTION]: the bridge rewrite loop must not reach these three anchors any more`.

- [ ] **Step 3: Implement**

`site/index.html:62`, the nav anchor, becomes:

```html
          <a class="btn btn--wa" href="/book/"
             data-en="Request a car" data-nl="Vraag een auto aan" data-es="Reservar" data-pap="Reservá"
             data-book-en="Request a car" data-book-nl="Vraag een auto aan" data-book-es="Reservar online" data-book-pap="Reservá online">Request a car</a>
```

`site/index.html:102`, the hero anchor, becomes:

```html
              <a class="btn btn--wa btn--lg" href="/book/"
                 data-en="Request a car" data-nl="Vraag een auto aan" data-es="Reservar por WhatsApp" data-pap="Reservá via WhatsApp"
                 data-book-en="Request a car" data-book-nl="Vraag een auto aan" data-book-es="Reservar online" data-book-pap="Reservá online">Request a car</a>
```

The footer anchor, `:362` after Task 13 (it was `:403` before), becomes:

```html
          <a class="btn btn--wa" href="/book/"
             data-en="Request a car" data-nl="Vraag een auto aan" data-es="Reservar por WhatsApp" data-pap="Reservá via WhatsApp"
             data-book-en="Request a car" data-book-nl="Vraag een auto aan" data-book-es="Reservar online" data-book-pap="Reservá online">Request a car</a>
```

In `site/scripts/main.js`, replace **only lines 17 to 20**, the four lines of `bookUrl`. Do **not** include line 16, and do **not** redeclare `bookingOn`: it already exists at `main.js:16` as `const bookingOn = () => !!CFG.bookingEnabled;` and is left untouched. Redeclaring it inside the same IIFE throws `SyntaxError: Identifier 'bookingOn' has already been declared`, which kills the whole file: fleet cards, rates table, FAQ accordion and the reveal animations all stop.

The four lines being replaced are:

```js
  const bookUrl = (params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${(CFG.bookingUrl || 'https://app.tex-cars.com').replace(/\/$/, '')}/book${qs ? '?' + qs : ''}`;
  };
```

Replace them with exactly this, three lines:

```js
  // The quiz lives on this site now, at /book/. It is not the app wizard,
  // so this no longer builds a cross-origin URL out of CFG.bookingUrl.
  const bookUrl = (slug) => `/book/?car=${encodeURIComponent(slug)}`;
```

And the fleet card anchor at `:100`:

```js
              ? `<a class="btn btn--primary" href="${bookUrl(car.slug)}" aria-label="${tr('bookOnline')}">
                  ${tr('bookOnline').split(' ')[0]} →
                </a>`
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 98 tests pass, 0 fail.

Then open `http://localhost:8000/` and check the nav, hero and footer buttons all read "Request a car", all go to `/book/` in the same tab, and each of the six fleet cards goes to `/book/?car=<its slug>` with that car already selected.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/index.html site/scripts/main.js tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "site: point all four booking surfaces at the local quiz

Three static anchors plus the six fleet card links, which exist only in
JavaScript and no index.html edit would have reached."
```

---

## Task 15: The rental_terms 404 and the sitemap entry

**Files:**
- Modify: the footer policy list item in `site/index.html` (`:386` on the file as it stands today, `:345` after Task 13 shortens it by 41 lines; find it by the literal string `/policies/rental-terms`, which appears exactly once)
- Modify: `site/sitemap.xml:3-6`
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

That line links `/policies/rental-terms` with a hyphen. The app's `policy_type` enum accepts only `rental_terms` with an underscore. `site/data/config.js:21` has `bookingEnabled: true`, so `booking-bridge.js:64` unhides that block today, which makes it a live 404 in production right now. One character.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/markup.test.mjs`:

```js
test('the rental terms link matches the policy_type enum', () => {
  assert.equal(index.includes('/policies/rental-terms'), false, 'the enum has an underscore, not a hyphen');
  assert.ok(index.includes('data-booking-href="/policies/rental_terms"'));
});

test('the other two policy links were already right and stay right', () => {
  assert.ok(index.includes('data-booking-href="/policies/cancellation"'));
  assert.ok(index.includes('data-booking-href="/policies/privacy"'));
});

test('the sitemap lists the quiz', () => {
  const map = read('sitemap.xml');
  assert.ok(map.includes('<loc>https://tex-cars.com/book/</loc>'));
  assert.equal((map.match(/<url>/g) || []).length, 5, 'four pages plus the quiz');
  assert.match(map, /<loc>https:\/\/tex-cars\.com\/book\/<\/loc><changefreq>monthly<\/changefreq><priority>0\.9<\/priority>/);
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `AssertionError [ERR_ASSERTION]: the enum has an underscore, not a hyphen`.

- [ ] **Step 3: Implement**

In `site/index.html`, on the line that holds `/policies/rental-terms` (`:345` after Task 13), change the one character:

```html
            <li data-booking-only hidden><a href="#" data-booking-href="/policies/rental_terms" data-en="Rental terms" data-nl="Huurvoorwaarden" data-es="Términos de alquiler" data-pap="Kondishonnan di hür">Rental terms</a></li>
```

`site/sitemap.xml`, add the quiz as the second entry, right after the homepage:

```xml
  <url><loc>https://tex-cars.com/book/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 101 tests pass, 0 fail.

Also confirm the sitemap still parses:

```bash
python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('/Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/site/sitemap.xml'); print('sitemap parses')"
```

Expected output: `sitemap parses`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/index.html site/sitemap.xml tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "site: fix the live rental_terms 404 and add /book/ to the sitemap

The policy_type enum is rental_terms with an underscore; the footer link
has shipped with a hyphen since booking was enabled."
```

---

## Task 16: The three homepage claims the quiz does not keep

**Files:**
- Modify: `site/index.html:222` (the `data-book-*` copy on the "Message us" step)
- Modify: the `data-book-*` copy on the "What do I need to rent?" FAQ answer (`:346` on the file as it stands today, `:305` after Task 13 shortens it by 41 lines; find it by the literal string `we ask for your license details upfront`)
- Modify: the `data-booking-only` online payment FAQ item (`:356-359` today, `:315-318` after Task 13; find it by the literal string `How does paying online work?`)
- Test: `tools/site-tests/markup.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Copy only.

This task is not in the spec. It comes from the owner's decision on 2026-09-09, in their words: "Technically booking via WhatsApp is still online, but you can change them." So wording that merely says "online" stays, because it is still true. Only these three change, because each one makes a specific promise the quiz does not keep:

1. `:222` promises "a small reservation fee". There is no reservation fee any more. The quiz takes no money at all.
2. `:346` promises "when you book online we ask for your license details upfront". The quiz asks for no licence.
3. `:356` is the whole "How does paying online work?" FAQ item, which `booking-bridge.js:64` unhides today because `config.js:21` has `bookingEnabled: true`. It describes paying a reservation fee or a deposit online. Neither happens.

**Explicitly left alone**, because "online" is still true and the owner said so:

- `:137`, the trust badge `data-book-en="Book online in minutes"`.
- `:164`, the fleet section lead, "Tap any car to book it online in minutes."
- `:220`, the "How it works" step heading `data-book-en="Book online"`.
- Every other use of the word "online" anywhere on the site, including the `data-book-es` and `data-book-pap` variants on the three call to action anchors, which Appendix A item 2 already records as stale.

**This copy needs Tex's approval before launch.** It is new wording, not copied from the spec, and it is listed for that approval in `docs/QUIZ-COPY-FOR-APPROVAL.md` (Task 18). Four languages are written because the file's convention is four (`data-en`, `data-nl`, `data-es`, `data-pap`), even though `i18n.js:12` renders only two today.

- [ ] **Step 1: Write the failing test**

Append to `tools/site-tests/markup.test.mjs`:

```js
test('the three claims the quiz does not keep are gone', () => {
  assert.equal(index.includes('reservation fee'), false, 'the quiz takes no money at all');
  assert.equal(index.includes('reserveringsfee'), false);
  assert.equal(index.includes('we ask for your license details upfront'), false, 'the quiz asks for no licence');
  assert.equal(index.includes('rijbewijsgegevens vooraf'), false);
  assert.equal(index.includes('How does paying online work?'), false);
});

/* The owner kept every plain "online" claim, because booking through
   WhatsApp is still online. Only specific broken promises changed. */
test('the online wording the owner kept is untouched', () => {
  assert.ok(index.includes('data-book-en="Book online in minutes"'), 'the trust badge stays');
  assert.ok(index.includes('data-book-en="Book online"'), 'the how it works heading stays');
  assert.ok(index.includes('book it online in minutes'), 'the fleet section lead stays');
});
```

- [ ] **Step 2: Run it and see it fail**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/markup.test.mjs
```

Expected failure: `AssertionError [ERR_ASSERTION]: the quiz takes no money at all`.

- [ ] **Step 3: Implement**

**One.** `site/index.html:222`, the second line of the "Message us" step paragraph. Line `:221` (the `data-en` through `data-pap` values) is not touched. Replace line `:222` with:

```html
               data-book-en="Pick your car and your days online, and Tex answers you on WhatsApp. Done in minutes." data-book-nl="Kies online je auto en je dagen, en Tex antwoordt je op WhatsApp. In een paar minuten geregeld." data-book-es="Elige tu auto y tus días online, y Tex te responde por WhatsApp. Listo en minutos." data-book-pap="Skohe bo outo i bo dianan online, i Tex ta kontestá bo via WhatsApp. Kla den un par di minüt.">Send us your dates and the car you want on WhatsApp. We reply fast.</p>
```

**Two.** The second line of the "What do I need to rent?" FAQ answer (`:346` today, `:305` after Task 13). The line above it, with the `data-en` through `data-pap` values, is not touched. Replace it with:

```html
               data-book-en="A valid driver's license and a form of ID. Drivers need to be 21 or older. You show the license when you pick the car up, so there is nothing to fill in beforehand." data-book-nl="Een geldig rijbewijs en een identiteitsbewijs. Je bent minimaal 21 jaar. Je laat je rijbewijs zien bij het ophalen, dus vooraf hoef je niets in te vullen." data-book-es="Una licencia de conducir válida y una identificación. Los conductores deben tener 21 años o más. Muestras la licencia al recoger el auto, así que no hay nada que rellenar antes." data-book-pap="Un karnet di chofer válido i un identifikashon. Chofer mester tin 21 aña òf mas. Bo ta mustra bo karnet ora bo buska e outo, pues no tin nada pa yena promé.">A valid driver's license and a form of ID. Drivers need to be 21 or older, and the $250 deposit comes back to you when you return the car.</p></div>
```

**Three.** The online payment FAQ item (`:356-359` today, `:315-318` after Task 13). The `data-booking-only hidden` attributes stay exactly as they are, so the item keeps appearing while `bookingEnabled` is true. Only the question and the answer change:

```html
          <div class="faq__item" data-reveal data-booking-only hidden>
            <button class="faq__q" aria-expanded="false"><span data-en="How do I pay?" data-nl="Hoe betaal ik?" data-es="¿Cómo pago?" data-pap="Kon mi ta paga?">How do I pay?</span><span class="plus"></span></button>
            <div class="faq__a"><p data-en="You pay Tex when you pick the car up. Nothing is charged on this website, and sending a request costs you nothing." data-nl="Je betaalt Tex bij het ophalen. Op deze website wordt niets afgeschreven, en een aanvraag versturen kost je niets." data-es="Pagas a Tex al recoger el auto. En esta web no se cobra nada, y enviar una solicitud no cuesta nada." data-pap="Bo ta paga Tex ora bo buska e outo. Riba e website aki no ta kobra nada, i manda un petishon no ta kosta bo nada.">You pay Tex when you pick the car up. Nothing is charged on this website, and sending a request costs you nothing.</p></div>
          </div>
```

- [ ] **Step 4: Run it and see it pass**

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
```

Expected: 103 tests pass, 0 fail.

Then reload `http://localhost:8000/`, open the FAQ, and confirm the payment question reads "How do I pay?" with the pay at pickup answer, the "What do I need to rent?" answer no longer mentions licence details upfront, and the "How it works" step no longer mentions a reservation fee. Switch to NL and read all three again.

- [ ] **Step 5: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add site/index.html tools/site-tests/markup.test.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "site: rewrite the three claims the quiz does not keep

No reservation fee, no licence details upfront, no online payment. Plain
online wording stays, because booking through WhatsApp is still online.
Copy is pending Tex's approval, see docs/QUIZ-COPY-FOR-APPROVAL.md."
```

---
## Task 17: Prove every row of the G1 case table against a stub endpoint

**Files:**
- Create: `tools/site-tests/stub-endpoint.mjs`
- Test: manual, driven by the stub. This is the row of the G1 table the unit tests cannot reach, because it is about what the browser does with a real network.

**Interfaces:**
- Consumes: `endpointUrl(CFG)` from Task 10, `CFG.bookingUrl` from `site/data/config.js`.
- Produces: nothing shipped. A local stub that answers `POST /api/booking-requests` with whatever status you ask for.

- [ ] **Step 1: Write the stub**

Create `tools/site-tests/stub-endpoint.mjs`:

```js
/* A stand-in for POST /api/booking-requests, so the G1 case table can be
   walked in a real browser without the app running.

     node tools/site-tests/stub-endpoint.mjs 201
     node tools/site-tests/stub-endpoint.mjs 422
     node tools/site-tests/stub-endpoint.mjs 500
     node tools/site-tests/stub-endpoint.mjs hang     (never answers)

   Then set bookingUrl to http://localhost:8787 in site/data/config.js for
   the manual pass, and put it back before committing. */
import { createServer } from 'node:http';

const mode = process.argv[2] || '201';
const PORT = 8787;

createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    console.log(body);
    if (mode === 'hang') return;   // the customer's 4000 ms abort has to win
    const code = Number(mode);
    res.writeHead(code, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(code === 201 ? { ok: true } : { error: { message: 'stub' } }));
  });
}).listen(PORT, () => console.log(`stub endpoint on http://localhost:${PORT} answering ${mode}`));
```

- [ ] **Step 2: Set up the two servers**

```bash
cd /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental && python3 -m http.server 8000 --directory site
```

In a second shell:

```bash
node /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/stub-endpoint.mjs 201
```

Temporarily change the `bookingUrl` key in `site/data/config.js` to `bookingUrl: "http://localhost:8787",`. Find it by name, not by line number: it is at `:24` on the file as it stands today, but Task 11 inserts `requestsOn` and its five line comment directly above it, so by the time this task runs it is at `:30`. Write down that it has to go back to `"https://app.tex-cars.com"` before step 5.

- [ ] **Step 3: Walk every row of the G1 case table**

For each row: reload `http://localhost:8000/book/`, complete the quiz (Hyundai i10, two future days, "Bring it to my hotel", note "Divi Village, arriving 11:00", name Monischa, phone `+297 560 1234`), then tap Send request once.

| Restart the stub as | Expected status line | Expected button | Expected anchor href |
| - | - | - | - |
| `201` | "Sent. Now open WhatsApp so Tex sees it." | Send request hidden, green Open WhatsApp shown | `https://wa.me/2975945454?text=` with the full seven line message |
| `201`, with the honeypot filled by hand in devtools (`document.getElementById('qWebsite').value = 'x'`) | same as above, deliberately | same | same |
| `422` | "We could not save it here, so send it on WhatsApp instead. Nothing is lost." | same | same |
| `429` | same failure line | same | same |
| `400` | same failure line | same | same |
| `500` | same failure line | same | same |
| `hang` | same failure line, after about four seconds | same | same |
| stub stopped entirely (offline) | same failure line, immediately | same | same |

Then two more, without the stub:

- Turn JavaScript off in the browser and load `http://localhost:8000/book/`. Expected: the quiz is not shown, the noscript block is, and its Open WhatsApp button carries a real `wa.me` href.
- Turn JavaScript back on, set `requestsOn: false` in `site/data/config.js`, reload, and complete the quiz. Expected: no request reaches the stub log at all, the status line is the success line, and the anchor still opens WhatsApp. Set it back to `true`.

Confirm on every row: the anchor has no `target` attribute, tapping it navigates the same tab, and the console shows no uncaught error.

- [ ] **Step 4: Walk the device matrix**

Serve the site on the local network (`python3 -m http.server 8000 --directory site --bind 0.0.0.0`) and open `http://<your LAN ip>:8000/book/`.

| Device and browser | What to check | Expected |
| - | - | - |
| iPhone, Safari, 375 px wide | Calendar day cells | Every cell is at least 44 px tall and seven columns fit without horizontal scroll |
| iPhone, Safari | Whole page | The body never scrolls sideways at any step |
| iPhone, Safari, Settings, Privacy, Block All Cookies on | Load the page, tap NL | The page loads, the language switches, the estimate re-renders in Dutch. Before Task 12 this was a blank Dutch site. |
| iPhone, Instagram in app browser (paste the link into a DM to yourself and open it) | Tap Open WhatsApp on the send screen | WhatsApp opens with the message prefilled. This is the reason there is no `target="_blank"`. |
| iPhone, Facebook in app browser | Same | Same |
| iPhone, phone timezone set to Amsterdam | Step 2, early morning Aruba time | Today in Aruba is tappable and not greyed out |
| Android, Chrome | Phone field | The numeric telephone keypad opens, not the full alphabet keyboard |
| Android, Chrome | Whole flow | Same as iPhone |
| Desktop, Chrome, 1440 px | Step 2 | The two months sit side by side |
| Desktop, Chrome | Keyboard only, Tab and Enter | Every step is reachable, the focus ring is visible, and the send button and the WhatsApp anchor both activate on Enter |
| Desktop, Chrome, DevTools, Rendering, prefers-reduced-motion reduce | Step changes | No slide animation, everything still switches |
| Desktop, Safari | Whole flow | Dates read the same as Chrome, no off by one day |

- [ ] **Step 5: Put the config back and commit**

Confirm `site/data/config.js` reads `bookingUrl: "https://app.tex-cars.com",` and `requestsOn: true,` again:

```bash
grep -n "bookingUrl\|requestsOn" /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/site/data/config.js
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental diff --stat site/data/config.js
```

Expected: `bookingUrl` is the app URL, `requestsOn` is `true`, and `git diff` on `config.js` is empty.

```bash
node --test /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/tools/site-tests/
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add tools/site-tests/stub-endpoint.mjs
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "tools: a stub endpoint for walking the G1 case table locally

Answers any status, or hangs so the 4000 ms abort can be observed. Not
shipped: tools/ is outside site/ and never reaches gh-pages."
```

---

## Task 18: The copy review sheet for Tex

**Files:**
- Create: `docs/QUIZ-COPY-FOR-APPROVAL.md`

**Interfaces:**
- Consumes: the literal strings written in Tasks 4, 5, 7, 9, 13 and 16.
- Produces: nothing shipped. `docs/` is in the parent repo, not in `site/`, so this file never reaches the `gh-pages` tree.

Spec launch blocker 5 asks Mo and Tex to approve "the customer facing copy in sections 4, 5 and 6". That covers the quiz steps, the estimate sentence and the send step, and those strings are copied from the spec verbatim. It does **not** cover the strings this plan had to invent because the spec did not write them out, and it does not cover the homepage rewrites in Task 16. Those are listed here so Tex can approve or rewrite the lot in one pass instead of finding them one at a time on a live site.

English and Dutch sit side by side. Spanish and Papiamento exist in the homepage markup for Task 16's three items, because that file's convention is four languages, but neither is in `SUPPORTED` (`i18n.js:12`) so neither renders today and neither is up for review here.

- [ ] **Step 1: Write the sheet**

Create `docs/QUIZ-COPY-FOR-APPROVAL.md`. It has one table per group, each row being one string, with an English column, a Dutch column, and a column saying where it appears. The groups, in this order:

1. **The quiz trust line.** The single line above the progress bar on `/book/`. English "Nothing is reserved until Tex confirms it on WhatsApp." Dutch "Er is niets gereserveerd tot Tex het op WhatsApp bevestigt." From Task 5, phrased for a customer from the admin inbox line in spec section 10.
2. **The send screen heading.** English "Send it to Tex". Dutch "Stuur het naar Tex". From Task 5.
3. **The six validation error strings, per language.** From the `T` table in Task 7 and used by `validateStep` in Task 9: `errCar`, `errDates`, `errSpan`, `errDelivery`, `errName`, `errPhone`. Note in the sheet that `errSpan` names the number ninety on purpose, so it stays honest with the server rule, and that the ninety day retention number in the consent line is a separate approval (spec blocker 4).
4. **The two extra calendar hint states.** `hintStart` ("Tap your pick-up day." / "Tik je ophaaldag aan.") and `hintEnd` ("Now tap your return day." / "Tik nu je terugbrengdag aan."). The mis-tap line is spec copy and is not up for review; these two are not in the spec and are lifted from the Little John original.
5. **The full Dutch WhatsApp message.** All seven rows from Task 4, written out as a block exactly as the customer's phone will show it, next to the English block from spec section 6. The English is spec copy and is shown only so the two can be compared; the Dutch is new.
6. **The noscript copy.** The heading, the paragraph and the button label from the `q-noscript` block in Task 5, both languages.
7. **The new call to action line on the homepage.** The one line of copy and the one button label that replace the retired inquiry form, from Task 13.
8. **The three homepage rewrites from Task 16.** The "Message us" step line, the "What do I need to rent?" FAQ answer, and the "How do I pay?" FAQ question and answer. Show the old string and the new string in each row, so Tex can see what changed and why. Say in one line above the table that these three changed because the quiz no longer takes a reservation fee, no longer asks for licence details, and takes no payment.

Two lines at the top of the sheet, before the first table:

- What this is: every customer facing string this work invents. Everything the spec already wrote out verbatim is approved through spec blocker 5 and is not repeated here.
- How to use it: strike through anything wrong and write the replacement next to it. Each string names the task that has to change if the wording changes.

- [ ] **Step 2: Check it against the code**

Every English and Dutch string in the sheet must be byte for byte what the plan ships. Read them back off the plan rather than retyping:

```bash
grep -n "hintStart\|hintEnd\|errCar\|errDates\|errSpan\|errDelivery\|errName\|errPhone" /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/site/scripts/quiz.js
grep -n "q-trust\|q-noscript\|Send it to Tex\|Stuur het naar Tex" /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/site/book/index.html
grep -n "inquiry__cta" -A 3 /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/site/index.html
```

Expected: every string in the sheet appears in that output. If one does not, the sheet is wrong, not the code.

- [ ] **Step 3: Confirm it cannot ship to the public site**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental ls-files site | grep -c QUIZ-COPY-FOR-APPROVAL
```

Expected output: `0`. The subtree push only carries `site/`, and this file is in `docs/`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental add docs/QUIZ-COPY-FOR-APPROVAL.md
git -C /Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental commit -m "docs: one sheet of every new customer facing string, for Tex

Spec blocker 5 only covers sections 4, 5 and 6. This is everything the
plan had to invent, English and Dutch side by side, in one pass."
```

Hand the rendered sheet to Mo as HTML rather than raw Markdown when it goes out for approval.

---
## Appendix A: FOUND NOT FIXED

Things noticed while reading the real files that the spec does not cover. None of them is planned. They are recorded so nobody mistakes them for oversights.

1. **The fleet card button still says "Book" and "Boek".** `site/scripts/main.js:100-102` renders `tr('bookOnline').split(' ')[0]`, which is "Book" in English and "Boek" in Dutch. After Task 14 those cards go to a request quiz, so the word is now slightly wrong. Spec section 11 names the label change for the three static anchors only, so the card label is untouched. Mo may want it changed to "Request"; that is a copy decision, not a bug fix.
2. **The paused Spanish and Papiamento labels on the three call to action anchors are now stale.** `data-es` and `data-pap` still say "Reservar" and "Reservá" and their `data-book-*` variants still say "online". Neither language is in `SUPPORTED` (`i18n.js:12`), so nothing renders them today, and the spec names only `data-en`, `data-nl`, `data-book-en` and `data-book-nl`. If Spanish or Papiamento is ever re-enabled, these four attributes per anchor need a pass first.
3. **`booking-bridge.js:24` rewrites every `wa.me` number on the page.** It is harmless after this work, because the quiz page does not load the bridge and the three repointed anchors are no longer `wa.me` links. Worth knowing if anyone adds a `wa.me` anchor with a `?text=` to the homepage later: the regex only replaces the number, so a prefilled text survives.
4. **`site/scripts/main.js:7` still carries the comment "confirm live WhatsApp with owner" next to the fallback `2975945454`.** Launch blocker 3 in spec section 13 is exactly this. Not a code change, an owner confirmation.
5. **The `T` micro translation table in `main.js:25-46` keeps keys that only the retired form used** (`sum`, `lblName`, `lblEmail`, `lblDates`, `lblCar`, `lblMsg`, `toBooking`). Left in place: it is data that `renderFleet` still reads other keys from, and pruning it is not in scope.
6. **`.daterange`, `.form__msg` and the `#daycount` styles in `site/styles/main.css:222-235` are now unused.** Left in place; removing CSS is a cleanup the spec does not name.
7. **The app repo has two migrate entry points.** `app/scripts/migrate.ts` is what `package.json:20` runs; `app/src/lib/db/migrate.ts` also exists. The spec cites the latter at section 14 step 6. That belongs to the app plan, not this one, and nothing in this plan touches either file.

## Appendix B: Ambiguities resolved while writing this plan

Each of these is a place the spec did not give a literal string or a literal rule, and this plan picked one. If Mo or Tex disagrees, the change is small and lands in the named task.

1. **Dutch WhatsApp message wording.** Spec section 6 gives only the English example. Task 4 defines the Dutch shape with the same seven rows: `Hoi Tex, ik wil graag de … huren.` / `Van:` / `Tot:` / `Waar:` / `Opmerking:` / `Naam:` / `Schatting die ik zag:`.
2. **The delivery phrase inside the WhatsApp message.** The spec's example reads `Where: bring it to my hotel`, lower case, which is the step 3 label lowercased. Lowercasing "I collect it at Tex" would give "i collect it at Tex", so Task 4 uses a separate phrase map instead of lowercasing. The hotel row matches the spec example exactly.
3. **The recap row for delivery uses the sentence case labels**, the same strings as the step 3 buttons, because a recap is a list of what you chose, not a sentence.
4. **The mis-tap reset is announced on both silent wipe paths.** The spec names the "at or before the current start" case. Tapping a third day when a range is already complete also wipes silently in the Little John original. Task 8 announces both with the same copy, which reads correctly for both. This is a superset of what the spec asks for, not a contradiction.
5. **Calendar hint copy.** The spec gives the step helper line and the mis-tap line. The two other hint states are new: "Tap your pick-up day." / "Tik je ophaaldag aan." and "Now tap your return day." / "Tik nu je terugbrengdag aan." Both are lifted from the Little John original's own hint strings.
6. **Validation error copy.** The spec gives no error strings. Task 9 defines five per language. The 90 day one names the number, so it stays honest with the server rule.
7. **The maximum span error is separate from the generic dates error**, so a customer who wants four months is told why rather than being told to tap again.
8. **`estimateCents` is omitted from the JSON rather than sent as `null`** when there is no estimate. The contract says optional integer. In practice validation makes this unreachable at send time.
9. **The send screen heading** ("Send it to Tex" / "Stuur het naar Tex") and the trust line at the top of the quiz are new copy. The trust line reuses the wording of the admin inbox line from spec section 10, phrased for a customer.
10. **The progress bar shows five dots, not four.** The send screen is a step the customer walks through, so hiding it from the progress bar would make the last dot lie.
11. **Tests live in `tools/site-tests/`, outside `site/`.** The spec does not say where. Anything inside `site/` reaches the public `gh-pages` tree through the subtree push, so the tests would be published. `tools/` is not in `.gitignore`, so they stay version controlled.
12. **`bookUrl` in `main.js` changes signature from `(params)` to `(slug)`.** Its only other call site was the inquiry form submit handler at `site/scripts/main.js:221`, so the form has to be retired first. That is why Task 13 retires the form and Task 14 changes the signature, and not the other way round: the reverse order would leave one commit in which submitting the homepage form navigates to `/book/?car=%5Bobject%20Object%5D`. Spec section 11 names the new return value, and after Task 13 there is no caller left that needs the old shape.
13. **The homepage rewrites in Task 16 and the copy sheet in Task 18 are not from the spec.** They are the owner's decision of 2026-09-09. Task 16 changes only wording that makes a promise the quiz does not keep, and Task 18 gathers every invented string in one place because spec blocker 5 covers only sections 4, 5 and 6.
14. **The stored estimate is priced from the clamped language.** Spec section 7 says `estimate_currency` is derived server side from `lang`, and spec section 5 gives the currency rule by language. It does not say which language the stored figure is priced in. Task 10 pins it to the clamped value the payload carries, because any other reading lets a florin number be stored labelled USD. `priceCfg` keeps its `pap` branch for what the page displays, exactly as spec section 5 asks.
15. **`docs/QUIZ-COPY-FOR-APPROVAL.md` lives in `docs/`, not in `site/`.** The spec does not say where a copy sheet goes. `docs/` is in the parent repo and outside the subtree push, so a sheet with draft wording on it cannot reach the public site.
16. **Three test additions that are not spec requirements but make one testable.** The call to action test in Task 13 counts one paragraph, one anchor and no heading, because "one line of copy and one button" is otherwise unenforceable in a repo with no build step. The `requestBody` test in Task 10 asserts the stored figure is the dollar one for `pap`, because the currency and the language agreeing is otherwise invisible. The two tests in Task 16 pin which claims changed and which "online" wording the owner kept, because that distinction is the whole point of the task.
