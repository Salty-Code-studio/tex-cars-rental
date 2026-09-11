/* Loads the real shipped site scripts into a node:vm context with stub DOM
   globals, so the pure helpers can be unit tested without a bundler and
   without a browser. The site has no build step, so the file under test is
   byte for byte the file that ships. */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE = join(REPO, 'site');

export function read(rel) {
  return readFileSync(join(SITE, rel), 'utf8');
}

/* A stub element good enough for the top level of a plain script: it records
   listeners and answers every query with nothing, so no DOM layer can run. */
function stubDoc(listeners) {
  return {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    documentElement: { lang: 'en' },
    body: { classList: { contains: () => false, add() {}, remove() {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  };
}

export function loadSite({ files = ['data/config.js', 'data/fleet.js', 'scripts/quiz.js'], storage = null } = {}) {
  const listeners = {};
  const dispatched = [];
  const window = {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(ev) { dispatched.push(ev); return true; },
    location: { search: '' },
  };
  window.window = window;
  const context = createContext({
    window,
    document: stubDoc(listeners),
    navigator: { language: 'en-GB' },
    localStorage: storage,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console,
  });
  for (const file of files) runInContext(read(file), context, { filename: file });
  return { window, document: context.document, pure: window.TEX_QUIZ, listeners, dispatched };
}
