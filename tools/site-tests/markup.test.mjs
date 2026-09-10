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
  assert.ok(anchor, 'the one send anchor must be in the markup');
  assert.match(anchor[0], /href="https:\/\/wa\.me\/2975945454\?text=/);
  assert.equal(/\shidden[\s>=]/.test(anchor[0]), false, 'one tap: the anchor is never hidden waiting on anything');
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

/* The consent line has to describe what actually happens. Nothing is
   stored, so every clause about saving, deleting and 90 days is gone. */
test('the consent line describes the handoff and claims no storage', () => {
  assert.ok(book.includes('This opens WhatsApp with your details ready to send. You press send yourself, and nothing is reserved until Tex confirms it.'));
  assert.ok(book.includes('Dit opent WhatsApp met je gegevens klaar om te versturen. Je drukt zelf op verzenden, en er is niets gereserveerd tot Tex het bevestigt.'));
  assert.equal(/we save|bewaren we|90 days|90 dagen|policies\/privacy/i.test(book), false,
    'the page keeps nothing, so it must not claim to keep, delete or govern anything');
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

test('the send screen has all eight recap slots', () => {
  for (const id of ['rCar', 'rFrom', 'rUntil', 'rEst', 'rWhere', 'rNote', 'rName', 'rPhone']) {
    assert.ok(book.includes(`id="${id}"`), `missing recap slot ${id}`);
  }
});
