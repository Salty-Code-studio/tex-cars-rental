import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSite } from './harness.mjs';

/* Safari "Block All Cookies", and partitioned storage inside some in-app
   webviews, make localStorage.getItem and localStorage.setItem throw
   SecurityError. i18n.js used to call both unguarded inside a top level
   IIFE. A throw at the getItem call aborts the whole IIFE before
   window.TEX_i18n is ever assigned, so the page never gets a language
   switcher, and nothing that listens for langchange (the quiz estimate,
   the calendar, the WhatsApp message, the homepage) ever re-renders.

   This is a language preference, not customer data. Losing it just means
   the visitor sees the browser-language default on their next visit. */

class ThrowingStorage {
  getItem() {
    const err = new Error('The operation is insecure.');
    err.name = 'SecurityError';
    throw err;
  }
  setItem() {
    const err = new Error('The operation is insecure.');
    err.name = 'SecurityError';
    throw err;
  }
}

test('i18n.js survives a localStorage whose getItem and setItem both throw SecurityError', () => {
  let result;
  assert.doesNotThrow(() => {
    result = loadSite({ files: ['scripts/i18n.js'], storage: new ThrowingStorage() });
  }, 'a blocked localStorage must degrade to no saved preference, not take the page down');

  const { window, document, dispatched } = result;
  assert.ok(window.TEX_i18n, 'window.TEX_i18n must exist even when storage is blocked');
  assert.equal(typeof window.TEX_i18n.applyLang, 'function');
  assert.equal(typeof window.TEX_i18n.getLang, 'function');

  /* Prove it is not merely defined but actually usable: drive a real
     language change through it and confirm the visible effects the quiz
     and the homepage depend on, all with the same throwing storage. */
  assert.doesNotThrow(() => window.TEX_i18n.applyLang('nl'),
    'setItem throwing must not stop applyLang from finishing its work');
  assert.equal(document.documentElement.lang, 'nl', 'the DOM must still update on a blocked-storage device');

  const last = dispatched[dispatched.length - 1];
  assert.ok(last, 'applyLang must still dispatch langchange so the quiz can re-render');
  assert.equal(last.type, 'langchange');
  assert.equal(last.detail.lang, 'nl');
});

test('a working localStorage still remembers the chosen language, unaffected by the try/catch', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
  const { window, document, dispatched } = loadSite({ files: ['scripts/i18n.js'], storage });

  window.TEX_i18n.applyLang('nl');

  assert.equal(store.get('tex_lang'), 'nl', 'setItem must still run normally when storage works');
  assert.equal(document.documentElement.lang, 'nl');
  const last = dispatched[dispatched.length - 1];
  assert.equal(last.type, 'langchange');
  assert.equal(last.detail.lang, 'nl');
});
