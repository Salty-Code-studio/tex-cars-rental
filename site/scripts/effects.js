/* ============================================
   effects.js — Tex Cars "alive" layer
   Adapted from saltycodestudio-parts:
   scroll-progress-bar · scroll-velocity-skew-marquee
   magnetic-button · spotlight-card · parallax-layers
   All vanilla, no dependencies. Respects reduced motion and touch.
   ============================================ */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- Scroll progress bar ---------- */
  const bar = $('.progress span');
  if (bar) {
    let ticking = false;
    const paint = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1) : 0})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();
  }

  /* ---------- Marquee leans with scroll velocity ---------- */
  const skewEl = $('.marquee__skew');
  if (skewEl && !reduceMotion) {
    let target = 0, current = 0, lastY = window.scrollY, raf = null;
    const tick = () => {
      current += (target - current) * 0.12;
      target *= 0.86; // snap back to rest when scrolling stops
      if (Math.abs(current) > 0.03 || Math.abs(target) > 0.03) {
        skewEl.style.transform = `skewX(${current.toFixed(2)}deg)`;
        raf = requestAnimationFrame(tick);
      } else {
        skewEl.style.transform = '';
        raf = null;
      }
    };
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      target = clamp((y - lastY) * 0.35, -10, 10);
      lastY = y;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  /* ---------- Magnetic hero CTAs + WhatsApp float ---------- */
  if (canHover && !reduceMotion) {
    document.querySelectorAll('.hero__cta .btn, .wa-float').forEach(el => {
      const pull = el.classList.contains('wa-float') ? 0.3 : 0.22;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * pull;
        const y = (e.clientY - r.top - r.height / 2) * (pull + 0.08);
        el.style.transform = `translate(${clamp(x, -10, 10)}px, ${clamp(y, -8, 8)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Cursor spotlight position on cards ---------- */
  if (canHover) {
    [['.why__grid', '.why__card'], ['.steps', '.step']].forEach(([gridSel, cardSel]) => {
      const grid = $(gridSel);
      if (!grid) return;
      grid.addEventListener('pointermove', (e) => {
        const card = e.target.closest(cardSel);
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }

  /* ---------- Hero collage mouse parallax ---------- */
  const hero = $('.hero'), collage = $('.hero__collage');
  if (hero && collage && canHover && !reduceMotion) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      collage.style.transform = `translate3d(${(x * 14).toFixed(1)}px, ${(y * 10).toFixed(1)}px, 0)`;
    });
    hero.addEventListener('pointerleave', () => { collage.style.transform = ''; });
  }
})();
