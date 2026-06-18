/* ============================================
   booking-bridge.js — the Phase 1 → Phase 2 seam
   Reads window.TEX_CONFIG (data/config.js).

   bookingEnabled: false  → site behaves exactly as today (WhatsApp first)
   bookingEnabled: true   → CTAs marked [data-booking-href] point into the
   booking app, labels with data-book-* swap to "Book online" wording,
   and [data-booking-only] blocks (policy links, payment FAQ) appear.

   Reversible at runtime: window.TEX_BOOKING.apply() re-reads the config,
   so QA can flip modes from the console without reloading.
   Also normalizes every static wa.me link to the single configured number.
   ============================================ */
(() => {
  const CFG = window.TEX_CONFIG || {};
  const LANGS = ['en', 'nl', 'es', 'pap'];
  const appUrl = (path) =>
    `${(CFG.bookingUrl || 'https://app.tex-cars.com').replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;

  /* One WhatsApp number for the whole site, sourced from config */
  function normalizeWaLinks() {
    if (!CFG.waNumber) return;
    document.querySelectorAll('a[href*="wa.me/"]').forEach((a) => {
      a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${CFG.waNumber}`);
    });
  }

  function apply() {
    const on = !!CFG.bookingEnabled;
    document.body.classList.toggle('booking-live', on);

    // Swap hrefs (remember the originals so flipping back works)
    document.querySelectorAll('[data-booking-href]').forEach((a) => {
      if (!a.dataset.origHref) {
        a.dataset.origHref = a.getAttribute('href') || '';
        a.dataset.origTarget = a.getAttribute('target') || '';
      }
      if (on) {
        a.setAttribute('href', appUrl(a.dataset.bookingHref));
        a.removeAttribute('target'); // booking flow opens in the same tab
      } else {
        a.setAttribute('href', a.dataset.origHref);
        if (a.dataset.origTarget) a.setAttribute('target', a.dataset.origTarget);
      }
    });

    // Swap i18n label sets (data-book-en → data-en, etc.)
    document.querySelectorAll('[data-book-en]').forEach((el) => {
      LANGS.forEach((l) => {
        const bookLabel = el.getAttribute(`data-book-${l}`);
        if (bookLabel == null) return;
        const origKey = `data-orig-${l}`;
        if (!el.hasAttribute(origKey)) el.setAttribute(origKey, el.getAttribute(`data-${l}`) || '');
        el.setAttribute(`data-${l}`, on ? bookLabel : el.getAttribute(origKey));
      });
      // Pages without the i18n engine (the English-only blog) get the text directly
      if (!window.TEX_i18n) {
        if (!el.dataset.origText) el.dataset.origText = el.textContent;
        el.textContent = on ? el.getAttribute('data-book-en') : el.dataset.origText;
      }
    });

    // Reveal / hide booking-only blocks (policy links, payment FAQ)
    document.querySelectorAll('[data-booking-only]').forEach((el) => { el.hidden = !on; });

    // Refresh visible text in the active language; this also dispatches
    // langchange, which re-renders the fleet cards in the right mode.
    if (window.TEX_i18n) window.TEX_i18n.applyLang(window.TEX_i18n.getLang());
  }

  document.addEventListener('DOMContentLoaded', () => {
    normalizeWaLinks();
    apply();
  });

  window.TEX_BOOKING = { apply };
})();
