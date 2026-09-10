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

/* The WhatsApp number is hardcoded in five places on purpose (a static
   anchor needs a working href before any script runs, and this page never
   loads booking-bridge.js to patch it later). Nothing else checks these
   five against each other, so a number change in one place silently drifts
   from the rest unless this test catches it. */
test('the WhatsApp number matches across all five hardcoded places', () => {
  const PLACES = 'site/data/config.js:25 (waNumber, the declared single source), '
    + 'site/scripts/main.js:7 (WA_NUMBER fallback literal), '
    + 'site/scripts/quiz.js:26 (WA_NUMBER fallback literal), '
    + 'site/book/index.html noscript fallback anchor (q-noscript), '
    + 'site/book/index.html initial href on qOpenWa';

  const config = read('data/config.js');
  const configMatch = config.match(/waNumber:\s*"(\d+)"/);
  assert.ok(configMatch, `could not find waNumber in site/data/config.js. Check: ${PLACES}`);
  const waNumber = configMatch[1];

  const mainJs = read('scripts/main.js');
  const mainMatch = mainJs.match(/const WA_NUMBER = CFG\.waNumber \|\| '(\d+)'/);
  assert.ok(mainMatch, `could not find the WA_NUMBER fallback in site/scripts/main.js. Check: ${PLACES}`);

  const quizJs = read('scripts/quiz.js');
  const quizMatch = quizJs.match(/const WA_NUMBER = CFG\.waNumber \|\| '(\d+)'/);
  assert.ok(quizMatch, `could not find the WA_NUMBER fallback in site/scripts/quiz.js. Check: ${PLACES}`);

  const waLinksInBook = [...book.matchAll(/wa\.me\/(\d+)/g)].map((m) => m[1]);
  assert.equal(waLinksInBook.length, 2,
    `expected exactly two wa.me links in site/book/index.html (noscript fallback anchor + qOpenWa initial href), found ${waLinksInBook.length}. Check: ${PLACES}`);

  const found = {
    'site/data/config.js:25': waNumber,
    'site/scripts/main.js:7': mainMatch[1],
    'site/scripts/quiz.js:26': quizMatch[1],
    'site/book/index.html noscript anchor': waLinksInBook[0],
    'site/book/index.html qOpenWa href': waLinksInBook[1],
  };

  for (const [place, number] of Object.entries(found)) {
    assert.equal(number, waNumber,
      `${place} has WhatsApp number "${number}", expected "${waNumber}" to match site/data/config.js. `
      + `All five places must carry the same number: ${PLACES}`);
  }
});

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
    '.q-notice', '.q-count', '.q-help', '.q-error', '.q-nav', '.q-recap',
    '.q-estimate', '.q-deposit', '.q-consent', '.q-openwa',
    '.cal2-nav', '.cal2-months', '.cal2-title', '.cal2-hint',
  ]) {
    assert.ok(css.includes(cls), `missing style for ${cls}`);
  }
});

test('the quiz styles are appended, not interleaved into the existing sheet', () => {
  assert.ok(css.indexOf('/* ---------- Quiz page (/book/)') > css.indexOf('@media (prefers-reduced-motion: reduce)'),
    'the quiz block goes at the end of the file');
});

const quiz = read('scripts/quiz.js');

/* The whole design in one assertion. The quiz is a message composer: the
   only thing that ever leaves this page is the customer's own tap on a
   wa.me link. One well meant fetch would quietly undo that. */
test('the quiz sends nothing anywhere and keeps nothing', () => {
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'document.cookie']) {
    assert.equal(quiz.includes(forbidden), false, `${forbidden} has no place in a page that stores nothing`);
  }
});

test('the send screen rebuilds the anchor href from state every render', () => {
  const render = quiz.slice(quiz.indexOf('function renderSend('));
  assert.match(render, /openWa\.href\s*=\s*waHref\(state, l\)/,
    'the anchor must carry the current answers, not the markup fallback');
});

test('quiz.js opens no new tab and no window', () => {
  assert.equal(quiz.includes('window.open'), false);
  assert.equal(/target\s*=\s*['"]_blank['"]/.test(quiz), false);
});

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
