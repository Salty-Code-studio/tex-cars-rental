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
});

const i10 = () => pure.carBySlug('hyundai-i10');

test('carBySlug finds the six site cards and nothing else', () => {
  assert.equal(i10().name, 'Hyundai i10');
  assert.equal(i10().class, 'Economy');
  assert.equal(pure.carBySlug('kia-rio').class, 'Compact');
  assert.equal(pure.carBySlug('hyundai-i10-v-7123'), null, 'app vehicle slugs are not site car keys');
  assert.equal(pure.carBySlug(''), null);
});

test('priceCfg follows the language, exactly like main.js priceCfg()', () => {
  /* priceCfg runs inside the vm context from harness.mjs, so the plain
     object it returns carries that context's Object.prototype, not this
     file's. Node's strict deepEqual treats that as "not reference-equal"
     even when every key and value matches. Spreading re-creates the object
     in this realm so the comparison is a real value check, not a vm quirk. */
  assert.deepEqual({ ...pure.priceCfg('en') }, { sym: '$', day: 'usdDay', week: 'usdWeek', month: 'usdMonth', depositKey: 'usdDeposit' });
  assert.deepEqual({ ...pure.priceCfg('nl') }, { sym: '$', day: 'usdDay', week: 'usdWeek', month: 'usdMonth', depositKey: 'usdDeposit' });
  assert.deepEqual({ ...pure.priceCfg('pap') }, { sym: 'Afl.', day: 'priceDay', week: 'priceWeek', month: 'priceMonth', depositKey: 'deposit' });
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

/* This covers the month-level cap only: every case below is priced on the
   Hyundai i10, whose day rate times six equals its week rate exactly
   (35 x 6 = 210), so the week-level cap never has a chance to fire here.
   The week-level cap has its own test below, on cars where day rate times
   six is genuinely more than the week rate. */
test('estimateFor never charges more than the next larger month bucket', () => {
  assert.equal(pure.estimateFor(i10(), 7, 'en'), 210, 'a full week is a week');
  assert.equal(pure.estimateFor(i10(), 13, 'en'), 420, 'six days over a week caps at two weeks');
  assert.equal(pure.estimateFor(i10(), 29, 'en'), 700, '875 of week and day cost caps at one month');
  assert.equal(pure.estimateFor(i10(), 60, 'en'), 1400, 'two whole months');
  assert.equal(pure.estimateFor(i10(), 64, 'en'), 1540, 'two months plus four days, under the three month cap');
});

/* The Hyundai i10 cannot prove the week-level cap: 35 x 6 = 210, its own
   week rate, so the capped and uncapped answers are the same number and
   deleting the inner cap line would not break a single i10 assertion.
   The Chevrolet Aveo and Kia Rio are the two site cars where six day
   rates genuinely exceed the week rate (usdDay 38 x 6 = 228, usdWeek 225),
   so pricing six days on them only comes out to 225 if the week cap
   actually fires. Without the cap this test would see 228. */
test('the week cap fires when six day rates exceed one week rate', () => {
  const aveo = pure.carBySlug('chevrolet-aveo');
  const rio = pure.carBySlug('kia-rio');
  assert.equal(pure.estimateFor(aveo, 6, 'en'), 225, 'uncapped six days would be 38 x 6 = 228, but the week rate is 225');
  assert.equal(pure.estimateFor(rio, 6, 'en'), 225, 'same shape on a second car, so this is not a fluke of one fleet row');
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

/* The send screen writes openWa.href on every render pass, including the
   first one before the customer has tapped a car, and state.carKey starts
   empty. Without the guard in buildWaText both of these throw a TypeError
   and take the whole page down at boot. */
test('buildWaText returns empty rather than throwing when no car is chosen', () => {
  const nothing = { carKey: '', startDate: '', endDate: '', delivery: 'airport', deliveryNote: '', name: '' };
  assert.equal(pure.buildWaText(nothing, 'en'), '');
  assert.equal(pure.buildWaText(nothing, 'nl'), '');
  assert.equal(pure.buildWaText({ ...nothing, carKey: 'not-in-the-fleet' }, 'en'), '');
});

test('waHref stays a real WhatsApp link when the message is not composed yet', () => {
  const nothing = { carKey: '', startDate: '', endDate: '', delivery: 'airport', deliveryNote: '', name: '' };
  const href = pure.waHref(nothing, 'en');
  assert.match(href, /^https:\/\/wa\.me\/\d+$/);
  assert.ok(!href.includes('?text='));
});

/* Final review finding 2: a deep link like /book/?car=kia-rio resolves a
   car at boot while the dates and delivery choice are still empty. The old
   guard in buildWaText only checked the car, so it fell through into
   fmtDate('') and WA_WHERE.en[undefined], and renderSend writes
   openWa.href on every render pass including boot, so that broken text
   landed on the anchor immediately, before the customer touched anything.
   It was invisible only because .q-step { display: none } keeps that
   anchor out of the tab order, which is CSS standing in for a logic guard.
   This pins the real fix: a resolved car alone must still produce a bare
   wa.me link, with no trace of a half built message. */
test('a deep linked car with no dates and no delivery choice still yields a bare wa.me link', () => {
  const deepLinked = { carKey: 'kia-rio', startDate: '', endDate: '', delivery: '', deliveryNote: '', name: '' };
  assert.equal(pure.buildWaText(deepLinked, 'en'), '');
  assert.equal(pure.buildWaText(deepLinked, 'nl'), '');
  const href = pure.waHref(deepLinked, 'en');
  assert.match(href, /^https:\/\/wa\.me\/\d+$/, href);
  assert.ok(!href.includes('?text='), href);
  assert.equal(/Invalid Date/i.test(href), false, href);
  assert.equal(/undefined/.test(href), false, href);
});

test('a resolved car with dates but no delivery choice yet also stays a bare wa.me link', () => {
  const partial = { carKey: 'kia-rio', startDate: '2026-09-20', endDate: '2026-09-26', delivery: '', deliveryNote: '', name: '' };
  assert.equal(pure.buildWaText(partial, 'en'), '');
  const href = pure.waHref(partial, 'en');
  assert.match(href, /^https:\/\/wa\.me\/\d+$/, href);
  assert.equal(/undefined/.test(href), false, href);
});

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

/* pickDay's return value is a plain object literal built inside the vm
   context harness.mjs loads quiz.js into, so it carries that context's
   Object.prototype, not this test file's. assert.deepEqual from
   node:assert/strict is deepStrictEqual, which checks the prototype too,
   so every expected literal below is spread to re-create it in this
   realm first, same fix as priceCfg's test above. */
test('pickDay sets the pick-up day first', () => {
  assert.deepEqual({ ...pure.pickDay({ startDate: '', endDate: '' }, '2026-03-14') },
    { startDate: '2026-03-14', endDate: '', moved: false });
});

test('pickDay sets the return day second', () => {
  assert.deepEqual({ ...pure.pickDay({ startDate: '2026-03-14', endDate: '' }, '2026-03-20') },
    { startDate: '2026-03-14', endDate: '2026-03-20', moved: false });
});

/* The Little John original wipes both dates here with no message at all
   (its quiz.js:176). Same reset, but it reports itself. */
test('pickDay announces the reset when you tap at or before the pick-up day', () => {
  assert.deepEqual({ ...pure.pickDay({ startDate: '2026-03-14', endDate: '' }, '2026-03-10') },
    { startDate: '2026-03-10', endDate: '', moved: true });
  assert.deepEqual({ ...pure.pickDay({ startDate: '2026-03-14', endDate: '' }, '2026-03-14') },
    { startDate: '2026-03-14', endDate: '', moved: true });
});

test('pickDay announces the reset when a finished range is restarted', () => {
  assert.deepEqual({ ...pure.pickDay({ startDate: '2026-03-14', endDate: '2026-03-20' }, '2026-03-25') },
    { startDate: '2026-03-25', endDate: '', moved: true });
});

test('hintText walks the customer through the two taps', () => {
  const empty = { startDate: '', endDate: '' };
  const half = { startDate: '2026-03-14', endDate: '' };
  const full = { startDate: '2026-03-14', endDate: '2026-03-20' };
  assert.equal(pure.hintText(empty, 'en', false), 'Tap your pick-up day.');
  assert.equal(pure.hintText(half, 'en', false), 'Now tap your return day.');
  assert.equal(pure.hintText(full, 'en', false), 'Sat 14 Mar \u2192 Fri 20 Mar \u00b7 6 days');
  assert.equal(pure.hintText(empty, 'nl', false), 'Tik je ophaaldag aan.');
  assert.equal(pure.hintText(full, 'nl', false), 'za 14 mrt \u2192 vr 20 mrt \u00b7 6 dagen');
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

/* Task 8 review finding: a customer could paint a range past the ninety
   day span on the calendar itself, see a clean blue fill and a day count,
   and only be told it was too long after tapping Continue. These two
   tests pin the fix: before any start is picked only the 365 day cap
   applies, and once a start exists but no end yet, days more than
   MAX_SPAN_DAYS beyond the start are disabled too. 2026-03-14 plus ninety
   days is 2026-06-12, so 2026-06-13 is the first disabled day. */
test('monthBlockHTML does not apply the span cap before any start is picked', () => {
  const html = pure.monthBlockHTML(2026, 5, { startDate: '', endDate: '' }, '2026-01-01', '2027-01-01', 'en');
  assert.ok(!/data-day="2026-06-13"[^>]*disabled/.test(html), 'with no start chosen, only the 365 day cap applies');
});

test('monthBlockHTML applies the ninety day span cap once a start is picked and no end yet', () => {
  const s = { startDate: '2026-03-14', endDate: '' };
  const html = pure.monthBlockHTML(2026, 5, s, '2026-01-01', '2027-01-01', 'en');
  assert.ok(!/data-day="2026-06-12"[^>]*disabled/.test(html), 'exactly ninety days out is still allowed');
  assert.match(html, /data-day="2026-06-13"[^>]*disabled/, 'one day beyond the ninety day span is disabled');
});

const TODAY = '2026-09-09';
const base = {
  carKey: 'hyundai-i10', startDate: '2026-09-20', endDate: '2026-09-26',
  delivery: 'hotel', deliveryNote: '', name: 'Monischa',
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
  const nlMsg = 'Tik een ophaaldag en een terugbrengdag aan op de kalender.';
  assert.equal(pure.validateStep('dates', { ...base, endDate: '' }, TODAY, 'nl'), nlMsg);
  assert.equal(pure.validateStep('dates', { ...base, startDate: '' }, TODAY, 'nl'), nlMsg);
  assert.equal(pure.validateStep('dates', { ...base, endDate: base.startDate }, TODAY, 'nl'), nlMsg);
});

test('validateStep enforces the three date rules the spec sets', () => {
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2027-09-10', endDate: '2027-09-14' }, TODAY, 'en'),
    'Tap a pick-up day and a return day on the calendar.', 'more than 365 days ahead is rejected');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-20', endDate: '2026-12-20' }, TODAY, 'en'),
    'Ninety days is the longest we can take here. Ask Tex on WhatsApp for a longer rental.');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-20', endDate: '2026-12-20' }, TODAY, 'nl'),
    'Negentig dagen is het langste dat hier kan. Vraag Tex op WhatsApp naar een langere huur.');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-20', endDate: '2026-12-19' }, TODAY, 'en'),
    '', 'exactly ninety days is allowed');
});

/* Task 9 quality review finding: a start date earlier than today is
   reachable in ordinary use (pick today, then sit on this step across the
   Aruba midnight boundary), so it needs its own message rather than the
   generic errDates, which would misdescribe what happened: the customer
   did tap a day, it just aged out from under them. */
test('validateStep tells the customer their pick-up day has passed, not the generic dates message', () => {
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-08', endDate: '2026-09-12' }, TODAY, 'en'),
    'That pick-up day has passed. Tap a new one.');
  assert.equal(pure.validateStep('dates', { ...base, startDate: '2026-09-08', endDate: '2026-09-12' }, TODAY, 'nl'),
    'Die ophaaldag is al voorbij. Tik een nieuwe aan.');
});

test('validateStep asks where the car should go', () => {
  assert.equal(pure.validateStep('delivery', { ...base, delivery: '' }, TODAY, 'en'), 'Tell us where you would like the car.');
  assert.equal(pure.validateStep('delivery', { ...base, delivery: 'desk' }, TODAY, 'en'), 'Tell us where you would like the car.');
  assert.equal(pure.validateStep('delivery', { ...base, delivery: '' }, TODAY, 'nl'), 'Vertel ons waar je de auto wil hebben.');
  assert.equal(pure.validateStep('delivery', { ...base, delivery: 'desk' }, TODAY, 'nl'), 'Vertel ons waar je de auto wil hebben.');
});

test('validateStep wants a name of two to sixty characters', () => {
  const msg = 'We need a name so Tex knows who to answer.';
  assert.equal(pure.validateStep('who', { ...base, name: '' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, name: 'M' }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, name: 'x'.repeat(61) }, TODAY, 'en'), msg);
  assert.equal(pure.validateStep('who', { ...base, name: 'Mo' }, TODAY, 'en'), '');
  assert.equal(pure.validateStep('who', { ...base, name: 'x'.repeat(60) }, TODAY, 'en'), '', 'exactly sixty characters passes');
  assert.equal(pure.validateStep('who', { ...base, name: '' }, TODAY, 'nl'), 'We hebben een naam nodig, zodat Tex weet wie hij antwoordt.');
});

const SEND = {
  carKey: 'hyundai-i10', startDate: '2026-03-14', endDate: '2026-03-20',
  delivery: 'hotel', deliveryNote: 'Divi Village, arriving 11:00',
  name: 'Monischa',
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

test('recapValues fills all seven rows and carries no phone row', () => {
  const r = pure.recapValues(SEND, 'en');
  assert.equal(r.car, 'Hyundai i10 (Economy)');
  assert.equal(r.from, 'Sat 14 Mar');
  assert.equal(r.until, 'Fri 20 Mar');
  assert.equal(r.est, '$210');
  assert.equal(r.where, 'Bring it to my hotel');
  assert.equal(r.note, 'Divi Village, arriving 11:00');
  assert.equal(r.name, 'Monischa');
  assert.equal('phone' in r, false, 'the phone field was removed, so recapValues must not carry a phone key');
});

test('recapValues translates the delivery row', () => {
  assert.equal(pure.recapValues(SEND, 'nl').where, 'Breng hem naar mijn hotel');
  assert.equal(pure.recapValues({ ...SEND, delivery: 'pickup' }, 'nl').where, 'Ik haal hem op bij Tex');
});
