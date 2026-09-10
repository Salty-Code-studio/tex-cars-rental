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
