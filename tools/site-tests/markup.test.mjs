import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { read, SITE } from './harness.mjs';

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

test('step 4 carries no phone field: the quiz never sends it and never stores it', () => {
  assert.equal(book.includes('id="qPhone"'), false, 'the phone input must be gone from the markup');
  assert.equal(/WhatsApp number|WhatsApp nummer/.test(book), false, 'the phone label and recap row must be gone too');
});

test('the send screen has all seven remaining recap slots and no phone row', () => {
  for (const id of ['rCar', 'rFrom', 'rUntil', 'rEst', 'rWhere', 'rNote', 'rName']) {
    assert.ok(book.includes(`id="${id}"`), `missing recap slot ${id}`);
  }
  assert.equal(book.includes('id="rPhone"'), false, 'the phone recap row was removed with the field');
});

/* The WhatsApp number is hardcoded in five places on purpose (a static
   anchor needs a working href before any script runs, and this page never
   loads booking-bridge.js to patch it later). Nothing else checks these
   five against each other, so a number change in one place silently drifts
   from the rest unless this test catches it. */
test('the WhatsApp number matches across all six hardcoded places', () => {
  const PLACES = 'site/data/config.js:25 (waNumber, the declared single source), '
    + 'site/scripts/main.js:7 (WA_NUMBER fallback literal), '
    + 'site/scripts/quiz.js:26 (WA_NUMBER fallback literal), '
    + 'site/book/index.html header WhatsApp link (the always visible fallback), '
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
  // Three, in document order: the header link that is always visible even if
  // quiz.js never loads, the noscript fallback, and the send anchor's initial
  // href. If this count changes, a WhatsApp route was added or removed from
  // the only page that now carries the whole booking funnel. Read why before
  // you change the number.
  assert.equal(waLinksInBook.length, 3,
    `expected exactly three wa.me links in site/book/index.html (header fallback + noscript fallback + qOpenWa initial href), found ${waLinksInBook.length}. Check: ${PLACES}`);

  const found = {
    'site/data/config.js:25': waNumber,
    'site/scripts/main.js:7': mainMatch[1],
    'site/scripts/quiz.js:26': quizMatch[1],
    'site/book/index.html header link': waLinksInBook[0],
    'site/book/index.html noscript anchor': waLinksInBook[1],
    'site/book/index.html qOpenWa href': waLinksInBook[2],
  };

  for (const [place, number] of Object.entries(found)) {
    assert.equal(number, waNumber,
      `${place} has WhatsApp number "${number}", expected "${waNumber}" to match site/data/config.js. `
      + `All six places must carry the same number: ${PLACES}`);
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

test('no booking anchor is left pointing at the app wizard', () => {
  assert.equal(index.includes('data-booking-href="/book"'), false,
    'the bridge rewrite loop must not reach these three anchors any more');
});

test('the three static call to action anchors go to the local quiz', () => {
  const anchors = [...index.matchAll(/<a[^>]*data-book-en="[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(anchors.length, 3, 'nav, hero and footer');
  for (const a of anchors) {
    assert.match(a, /href="\/book\/"/, a);
    assert.equal(/target\s*=/.test(a), false, 'no new tab: ' + a);
    assert.equal(/rel\s*=/.test(a), false, 'rel goes with target: ' + a);
    assert.match(a, /data-en="Request a car"/, a);
    assert.match(a, /data-nl="Vraag een auto aan"/, a);
    assert.match(a, /data-book-en="Request a car"/, a);
    assert.match(a, /data-book-nl="Vraag een auto aan"/, a);
  }
});

test('the fleet card links are generated at /book/ with the car slug', () => {
  assert.match(mainJs, /const bookUrl = \(slug\) => `\/book\/\?car=\$\{encodeURIComponent\(slug\)\}`;/);
  assert.match(mainJs, /href="\$\{bookUrl\(car\.slug\)\}"/);
  assert.equal(mainJs.includes('CFG.bookingUrl'), false, 'the fleet cards no longer leave this origin');
});

test('the rental terms link matches the policy_type enum', () => {
  assert.equal(index.includes('/policies/rental-terms'), false, 'the enum has an underscore, not a hyphen');
  assert.ok(index.includes('data-booking-href="/policies/rental_terms"'));
});

test('the other two policy links were already right and stay right', () => {
  assert.ok(index.includes('data-booking-href="/policies/cancellation"'));
  assert.ok(index.includes('data-booking-href="/policies/privacy"'));
});

test('the sitemap lists the quiz', () => {
  const map = read('sitemap.xml');
  assert.ok(map.includes('<loc>https://tex-cars.com/book/</loc>'));
  assert.equal((map.match(/<url>/g) || []).length, 5, 'four pages plus the quiz');
  assert.match(map, /<loc>https:\/\/tex-cars\.com\/book\/<\/loc><changefreq>monthly<\/changefreq><priority>0\.9<\/priority>/);
});

test('the three claims the quiz does not keep are gone', () => {
  assert.equal(index.includes('reservation fee'), false, 'the quiz takes no money at all');
  assert.equal(index.includes('reserveringsfee'), false);
  assert.equal(index.includes('we ask for your license details upfront'), false, 'the quiz asks for no licence');
  assert.equal(index.includes('rijbewijsgegevens vooraf'), false);
  assert.equal(index.includes('How does paying online work?'), false);
});

/* The owner kept every plain "online" claim, because booking through
   WhatsApp is still online. Only specific broken promises changed. */
test('the online wording the owner kept is untouched', () => {
  assert.ok(index.includes('data-book-en="Book online in minutes"'), 'the trust badge stays');
  assert.ok(index.includes('data-book-en="Book online"'), 'the how it works heading stays');
  assert.ok(index.includes('book it online in minutes'), 'the fleet section lead stays');
});

/* ============================================
   Final review finding 1: the blog pages carried data-booking-href="/book"
   while booking-bridge.js ran on them, so their five "Book now" / "Book
   your car online" buttons silently rewrote onto the app wizard this whole
   branch exists to retire. Every test above this point only ever read
   index.html, which is exactly why three whole pages were missed. This
   block walks every HTML page under site/ so the same drift cannot happen
   again from any page, and then checks the blog CTAs by name.
   ============================================ */
function allHtmlFiles(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(allHtmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

test('no page under site/ carries a booking CTA the bridge would rewrite onto the app wizard', () => {
  const pages = allHtmlFiles(SITE);
  assert.ok(pages.length >= 6, `expected to find at least six HTML pages under site/, found ${pages.length}`);
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    assert.equal(html.includes('data-booking-href="/book"'), false,
      `${file} carries data-booking-href="/book"; the bridge rewrites that straight onto the app wizard`);
    assert.equal(/href\s*=\s*"[^"]*app\.tex-cars\.com\/book/.test(html), false,
      `${file} points a booking CTA at app.tex-cars.com/book directly`);
  }
});

const blogFiles = {
  'blog/index.html': read('blog/index.html'),
  'blog/driving-in-aruba.html': read('blog/driving-in-aruba.html'),
  'blog/best-beaches-by-car-aruba.html': read('blog/best-beaches-by-car-aruba.html'),
};

test('every blog booking CTA is a plain relative link to the local quiz', () => {
  for (const [name, html] of Object.entries(blogFiles)) {
    const anchors = [...html.matchAll(/<a[^>]*data-book-en="[^"]*"[^>]*>[^<]*<\/a>/g)].map((m) => m[0]);
    assert.ok(anchors.length > 0, `${name}: expected at least one booking CTA anchor`);
    for (const a of anchors) {
      assert.match(a, /href="\.\.\/book\/"/, `${name}: ${a}`);
      assert.equal(/target\s*=/.test(a), false, `${name}: no new tab into an in-app webview: ${a}`);
      assert.equal(/rel\s*=/.test(a), false, `${name}: rel goes with target: ${a}`);
      assert.match(a, /data-book-en="Request a car"/, `${name}: ${a}`);
      assert.match(a, /data-book-nl="Vraag een auto aan"/, `${name}: ${a}`);
      assert.match(a, />Request a car<\/a>$/, `${name}: visible label must read Request a car: ${a}`);
    }
  }
});

test('every blog page has the expected count of booking CTAs', () => {
  assert.equal((blogFiles['blog/index.html'].match(/data-book-en="Request a car"/g) || []).length, 1, 'nav only');
  assert.equal((blogFiles['blog/driving-in-aruba.html'].match(/data-book-en="Request a car"/g) || []).length, 2, 'nav and article CTA');
  assert.equal((blogFiles['blog/best-beaches-by-car-aruba.html'].match(/data-book-en="Request a car"/g) || []).length, 2, 'nav and article CTA');
});

test('the retired blog CTA wording is gone', () => {
  for (const [name, html] of Object.entries(blogFiles)) {
    assert.equal(html.includes('Book now'), false, `${name}: retired label`);
    assert.equal(html.includes('Book your car on WhatsApp'), false, `${name}: retired label`);
    assert.equal(html.includes('data-book-en="Book online"'), false, `${name}: retired booking-only label`);
    assert.equal(html.includes('data-book-en="Book your car online"'), false, `${name}: retired booking-only label`);
  }
});
