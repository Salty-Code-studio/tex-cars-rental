# Phase 1 → Phase 2 booking bridge

**Date:** 2026-06-11 · **By:** saltycodestudio · **Status:** Built and verified (flag off)

The Phase 1 marketing site is now structured to fit the Phase 2 booking platform
(see `2026-06-11-phase2-booking-system-spec.md`). Nothing about today's live behavior
changed; the site gained a seam that flips it into booking-app mode the day Phase 2 ships.

## The one switch

`site/data/config.js`:

```js
window.TEX_CONFIG = {
  bookingEnabled: false,                    // flip to true at Phase 2 launch
  bookingUrl: "https://app.tex-cars.com",
  waNumber: "2975642825",                   // single source for every wa.me link
  currency: "USD",
};
```

## What flips when `bookingEnabled` goes true

| Element | Off (today) | On (Phase 2 live) |
|---|---|---|
| Nav CTA | "Book now" → WhatsApp | "Book now" → `app.tex-cars.com/book` |
| Hero CTA | "Book on WhatsApp" | "Book online" → `/book` |
| Fleet cards | "Reserve" → WhatsApp message | "Book" → `/book?car=<slug>` |
| Inquiry form | Hands summary to WhatsApp | Redirects to `/book?class=&pickup=&return=` |
| Footer CTA | "Book on WhatsApp" | "Book online" → `/book` |
| Footer links | Hidden | Rental terms, Cancellation & refunds, Privacy → `/policies/*` |
| FAQ | 4 questions | 5th appears: "How does paying online work?" (reservation fee / deposit) |
| Copy blocks | WhatsApp-first wording | Booking-first variants swap in: fleet lead, "How it works" step 1, trust strip, inquiry aside, form button, license FAQ answer |
| Blog pages | "Book now" / "Book your car on WhatsApp" → WhatsApp | Same CTAs → `/book` with "online" wording (bridge loaded on all 3 blog pages) |

WhatsApp stays available in every mode (floating button, contact section); it just stops
being the primary booking path.

## How it works

- `scripts/booking-bridge.js` reads the config at load. Elements carry
  `data-booking-href` (app path), `data-book-en/nl/es/pap` (swap labels), or
  `data-booking-only` (hidden until live). All four languages are preserved
  through the swap, and the swap is fully reversible.
- QA can flip modes live in the console: `TEX_CONFIG.bookingEnabled = true; TEX_BOOKING.apply()`.
- `data/fleet.js` now mirrors the Phase 2 `vehicles` table (spec §12): `slug`, `class`,
  `name`, `seats`, `transmission`, `ac`, `doors`, `priceDay/Week/Month`, `deposit`
  (null until the owner confirms per class), `status`. Seeding the Phase 2 database is a copy.
- The rates table is derived from the fleet (cheapest active car per class), so there is
  no second price list to keep in sync; same as how Phase 2 computes it. The class list and
  the form's class dropdown are derived from the same data, and cars with a non-active
  `status` drop out of the grid, the table and the dropdown together. Class names show
  localized labels (Económico, Ekonómiko) while URLs and data keep the canonical values.
- The deep-link contract is now pinned in the Phase 2 spec (§15, "Phase 1 hand-off contract").
- An adversarial multi-agent audit (spec alignment, i18n, copy rules, JS regression) ran over
  the seam; all 16 confirmed findings were fixed, 19 false positives documented and dismissed.

## Deep-link contract the Phase 2 app must accept

- `GET /book` (no params) — start of flow
- `GET /book?car=<vehicle-slug>` — preselected vehicle
- `GET /book?class=<Economy|Compact|SUV|4x4|Van>&pickup=YYYY-MM-DD&return=YYYY-MM-DD` — from the inquiry form
- `GET /policies/rental-terms`, `/policies/cancellation`, `/policies/privacy`

## Verified

Both modes tested in the browser (desktop + the runtime flip): default mode is identical
to pre-bridge behavior, booking mode swaps every CTA and label in all four languages,
flipping back restores everything, and the form deep link carries class and dates correctly.
