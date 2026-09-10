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

  /* CAREFUL: m here is ZERO based, so 2 is March, matching Date.UTC and the
     calendar's own month cursor. Three lines up, fmtDate's m is the ONE based
     month straight off the ISO string, which is why it subtracts 1. Two live
     conventions for the same letter in one file, so read the call site before
     you copy either. Date.UTC rolls an out of range month over silently
     (month 12 gives January of the next year, which the calendar relies on),
     so passing a one based month here does not throw, it just titles the
     wrong month. */
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

  /* ---------- the prefilled WhatsApp message ----------
     Built from state the browser already holds. This message IS the
     request: it is the only copy of what the customer chose, and it lives
     in their chat with Tex from the moment they press send in WhatsApp.
     Nothing on this page keeps a second copy. */
  const WA_WHERE = {
    en: { airport: 'bring it to the airport', hotel: 'bring it to my hotel', pickup: 'I collect it at Tex' },
    nl: { airport: 'breng hem naar het vliegveld', hotel: 'breng hem naar mijn hotel', pickup: 'ik haal hem op bij Tex' },
  };

  function buildWaText(req, lang) {
    const nl = lang === 'nl';
    const car = carBySlug(req.carKey);
    /* No car chosen yet, or a stale ?car= slug that is not in the fleet.
       Return empty rather than throwing: renderSend writes openWa.href on
       every render pass, including the first one before the customer has
       tapped anything, and state.carKey starts empty. Throwing here would
       take the whole page down at boot, which is a far worse failure than
       the send screen being briefly incomplete. Every sibling helper that
       resolves a car guards it the same way. */
    if (!car) return '';
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

  /* With nothing chosen yet the link is a bare wa.me with no ?text=, so the
     anchor in the markup is always a real, tappable WhatsApp link. That is
     the no-JS and half-filled fallback the G1 rule asks for: WhatsApp opens
     in every case, even if the message has not been composed. */
  const waHref = (req, lang) => {
    const text = buildWaText(req, lang);
    return text
      ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${WA_NUMBER}`;
  };

  const PURE = {
    isoOf, arubaTodayISO, addDaysISO, daysBetween,
    carBySlug, priceCfg, money, estimateFor,
    fmtDate, monthLabel, normalisePhone,
    buildWaText, waHref,
    MAX_SPAN_DAYS, MAX_AHEAD_DAYS, MAX_AHEAD_MONTHS,
    NOTE_MAX, NOTE_COUNTER_FROM,
  };
  window.TEX_QUIZ = PURE;
})();
