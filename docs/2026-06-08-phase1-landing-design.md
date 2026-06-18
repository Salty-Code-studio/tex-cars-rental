# Tex Cars & Leasing — Design Spec (Phase 1 Landing + Phase 2 Concept)

**Date:** 2026-06-08 · **By:** saltycodestudio · **Status:** Approved, building Phase 1

---

## Goal
Replace the "under construction" page at tex-cars.com with a real, informative, modern landing
page that tells visitors who Tex is, shows the fleet + rates, and funnels them to **WhatsApp** (and
a backup inquiry form) to book. Make it feel unique and premium using the `saltycodestudio-parts`
library, recolored to Tex's brand.

## Phasing
- **Phase 1 (NOW):** Static informative landing page. No backend.
- **Phase 2 (LATER, separate build):** Standalone, admin-driven online **booking system** — admin can
  add/edit cars, change prices, manage availability; customers search dates → book → pay deposit →
  confirmation. Built as its own app (e.g. Supabase + Stripe), reusing this brand. The static fleet
  data file in Phase 1 is structured to mirror the future `Vehicle` model so content migrates as a
  copy, not a redesign.
- *(Phase 3 online POS — scrapped.)*

## Stack & structure (Phase 1)
Static **HTML/CSS/JS**, mirroring the proven Slijterij United Liquors site structure:
```
tex-cars-rental/site/
├── index.html
├── 404.html
├── styles/   reset.css · tokens.css · layout.css · components.css · effects.css
├── scripts/  main.js · animations.js · i18n.js · form.js
├── data/     fleet.js (vehicle data, mirrors future Vehicle model) · content i18n strings
├── assets/   logo/ (from brand-kit) · img/ (fleet photos — placeholder until owner sends)
├── favicon, apple-touch-icon, robots.txt, sitemap.xml, .htaccess
```
- **Placeholder-first:** all fleet/rates/copy live in `data/` keyed by language — swap data, not markup.
- **Parts:** start from `saltycodestudio-parts` `section.html` variants (navbar, hero, features/pricing,
  faq, contact-form, cta-band, footer), **recolored** from Sand & Surf → Tex brand tokens.

## Brand (confirmed from logo pack)
- **Electric Blue `#0044FF`** (primary) · **Orange `#FF4600`** (accent/CTA) · **Navy `#15192F`** (text)
  · Black (illustration) · White (base). Full detail in `brand-kit/colors/colors.md`.
- **Logo:** circular Aruba-scene badge (palm, anchor, car, divi-divi, California Lighthouse). PNGs in
  `brand-kit/logo/` (request true SVG later).
- **Taglines:** "Easily from A to B" · "We bring the car to you!" (→ **delivery** is the lead USP).
- **Type:** bold condensed sans for headings (wordmark feel) + clean sans for body.

## Languages
**EN · NL · ES · PAP**, via an `i18n.js` switcher (mirrors Slijterij). EN drafted first; ES first-pass;
**NL + PAP flagged for native review** before launch.

## Page structure (10 sections)
1. Header/nav — logo, links (Fleet · Rates · How it works · Contact), 4-lang switcher, WhatsApp btn
2. Hero — "Easily from A to B" + delivery subline + WhatsApp CTA + "See the fleet"
3. Trust strip — Delivery · Budget rates · Airport pickup · Local & friendly · WhatsApp booking
4. Fleet — vehicle cards (photo, class, seats/transmission/AC, "from $XX/day", WhatsApp "Reserve")
5. Rates — daily/weekly/monthly table + what's included (placeholder figures)
6. How it works — Message on WhatsApp → We deliver the car → Drive & enjoy Aruba
7. Why Tex — budget · delivery · serves locals + students (leasing) · personal service
8. Inquiry form — name/email/dates/car/message → email + WhatsApp fallback
9. FAQ — license/age, insurance, fuel, delivery area (placeholder Q&A to confirm)
10. Footer — WhatsApp, email (TBC), location/map, hours, socials, lang, small print

## Booking behavior (Phase 1)
- Primary: WhatsApp deep-links (`wa.me/2975642825`) with pre-filled message incl. selected car.
- Backup: inquiry form via a form service (delivers to email + optional WhatsApp forward) — wire real
  email when owner provides it.

## Open items to confirm with owner
Real fleet list + photos · confirmed rates · email · address/pickup + delivery area · hours · which
number is live WhatsApp · Instagram/Google links · reviews · true vector logo · brand font name.
