/* ============================================
   quiz.js, Tex Cars WhatsApp request quiz (/book/)
   Four steps, then a send screen. Nothing here reserves a car, and
   nothing here saves, sends or stores anything: the whole file is a pure
   function from four answers to one wa.me link. There is deliberately no
   fetch, no XMLHttpRequest, no sendBeacon and no localStorage in this
   file. If you are adding one, you are changing the design.

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
    NOTE_MAX, NOTE_COUNTER_FROM,
  };
  window.TEX_QUIZ = PURE;
})();
