/* ============================================
   config.js — Tex Cars site configuration
   The Phase 1 / Phase 2 seam lives here.

   When the Phase 2 booking platform (app.tex-cars.com) goes live,
   set bookingEnabled to true. That single flip:
   • turns the nav / hero / footer CTAs into "Book online" links
   • makes fleet cards link into the booking flow (per-car slug)
   • makes the inquiry form hand off dates + car class to the app
   • swaps the WhatsApp-first copy blocks to their data-book-* variants
   • reveals the policy links and the online-payment FAQ
   WhatsApp stays available as the secondary channel either way.

   Flip checklist (manual, crawlers don't run JS):
   1. Set bookingEnabled: true below.
   2. Review the <meta name="description"> and og:description in
      index.html; they are written mode-neutral but deserve a read.
   3. Smoke-test all four languages after the flip.
   ============================================ */
window.TEX_CONFIG = {
  bookingEnabled: false,
  // Where the booking app lives. LOCAL dev = http://localhost:3000 (the running
  // Phase 2 app). At go-live, change this one line to the deployed app URL.
  // Interim (2026-07-09): booking disabled for the static GitHub Pages demo so
  // CTAs fall back to WhatsApp; flip true + set the Vercel app URL once live.
  bookingUrl: "http://localhost:3000",
  waNumber: "2975945454", // single source for every WhatsApp link on the site
  // Currency is chosen by LANGUAGE in main.js (priceCfg): Aruban florin (Afl.)
  // for Papiamento — locals — and US dollars ($) for English / Dutch / Spanish
  // — visitors. Each car in fleet.js carries both price lists.
  currency: "AWG",
};
