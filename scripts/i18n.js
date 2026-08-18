/* ============================================
   i18n.js — EN / NL / ES / PAP switcher
   Swaps textContent from data-en / data-nl / data-es / data-pap.
   Placeholders via data-{lang}-placeholder. Persists in localStorage.
   (PAP + NL strings flagged for native review before launch.)
   ============================================ */
(() => {
  const KEY = 'tex_lang';
  // ES + PAP paused until native review; translations stay in the markup.
  // Re-enable: restore ['en', 'nl', 'es', 'pap'], the two buttons in
  // index.html, and the es/pap navigator checks below.
  const SUPPORTED = ['en', 'nl'];

  const DEFAULT = (() => {
    const stored = localStorage.getItem(KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('nl')) return 'nl';
    return 'en';
  })();

  function applyLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'en';
    document.documentElement.lang = lang === 'pap' ? 'pap' : lang;
    document.body.classList.remove(...SUPPORTED.map(l => 'lang-' + l));
    document.body.classList.add('lang-' + lang);

    document.querySelectorAll('[data-' + lang + ']').forEach((el) => {
      const txt = el.getAttribute('data-' + lang);
      if (/<br\s*\/?>|<em>|<strong>/i.test(txt)) el.innerHTML = txt;
      else el.textContent = txt;
    });
    document.querySelectorAll('[data-' + lang + '-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', el.getAttribute('data-' + lang + '-placeholder'));
    });
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.setLang === lang);
    });
    localStorage.setItem(KEY, lang);
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set-lang]');
    if (btn) applyLang(btn.dataset.setLang);
  });
  document.addEventListener('DOMContentLoaded', () => applyLang(DEFAULT));

  window.TEX_i18n = {
    applyLang,
    getLang: () => SUPPORTED.find(l => document.body.classList.contains('lang-' + l)) || 'en'
  };
})();
