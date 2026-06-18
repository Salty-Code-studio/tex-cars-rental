/* ============================================
   main.js — Tex Cars interactivity
   nav · fleet/rates render · WhatsApp links · FAQ · reveal · form
   ============================================ */
(() => {
  const CFG = window.TEX_CONFIG || {};
  const WA_NUMBER = CFG.waNumber || '2975642825'; // ⚠️ confirm live WhatsApp with owner
  // Currency follows the language: Aruban florin for Papiamento (locals),
  // US dollars for English / Dutch / Spanish (visitors). Re-rendered on
  // langchange, so prices flip with the language toggle.
  function priceCfg() {
    return lang() === 'pap'
      ? { sym: 'Afl.', day: 'priceDay', week: 'priceWeek', month: 'priceMonth' }
      : { sym: '$',    day: 'usdDay',   week: 'usdWeek',   month: 'usdMonth' };
  }
  const bookingOn = () => !!CFG.bookingEnabled;
  const bookUrl = (params = {}) => {
    const qs = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${(CFG.bookingUrl || 'https://app.tex-cars.com').replace(/\/$/, '')}/book${qs ? '?' + qs : ''}`;
  };
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---- micro-translations used by JS-rendered content ---- */
  const T = {
    en: { seats: 'seats', auto: 'Automatic', manual: 'Manual', ac: 'A/C', from: 'from', day: '/day',
          reserve: 'Reserve on WhatsApp', book: "Hi! I'd like to rent the {car}. Is it available?",
          bookOnline: 'Book online', toBooking: 'Taking you to secure booking…',
          sum: 'New rental inquiry', lblName: 'Name', lblEmail: 'Email', lblDates: 'Dates', lblCar: 'Car', lblMsg: 'Message',
          cls: { Economy: 'Economy', Compact: 'Compact', SUV: 'SUV', '4x4': '4x4', Van: 'Van' } },
    nl: { seats: 'zitplaatsen', auto: 'Automaat', manual: 'Handgeschakeld', ac: 'Airco', from: 'vanaf', day: '/dag',
          reserve: 'Reserveer via WhatsApp', book: 'Hallo! Ik wil graag de {car} huren. Is die beschikbaar?',
          bookOnline: 'Boek online', toBooking: 'We brengen je naar de veilige boeking…',
          sum: 'Nieuwe huuraanvraag', lblName: 'Naam', lblEmail: 'E-mail', lblDates: 'Data', lblCar: 'Auto', lblMsg: 'Bericht',
          cls: { Economy: 'Economy', Compact: 'Compact', SUV: 'SUV', '4x4': '4x4', Van: 'Van' } },
    es: { seats: 'asientos', auto: 'Automático', manual: 'Manual', ac: 'A/C', from: 'desde', day: '/día',
          reserve: 'Reservar por WhatsApp', book: '¡Hola! Quiero alquilar el {car}. ¿Está disponible?',
          bookOnline: 'Reservar online', toBooking: 'Te llevamos a la reserva segura…',
          sum: 'Nueva solicitud de alquiler', lblName: 'Nombre', lblEmail: 'Correo', lblDates: 'Fechas', lblCar: 'Auto', lblMsg: 'Mensaje',
          cls: { Economy: 'Económico', Compact: 'Compacto', SUV: 'SUV', '4x4': '4x4', Van: 'Van' } },
    pap: { seats: 'asiento', auto: 'Outomátiko', manual: 'Manual', ac: 'A/C', from: 'for di', day: '/dia',
          reserve: 'Reservá via WhatsApp', book: 'Hopi bon dia! Mi ke hür e {car}. E ta disponibel?',
          bookOnline: 'Reservá online', toBooking: 'Nos ta hiba bo na e reservashon sigur…',
          sum: 'Petishon di hür nobo', lblName: 'Nòmber', lblEmail: 'Email', lblDates: 'Fecha', lblCar: 'Outo', lblMsg: 'Mensahe',
          cls: { Economy: 'Ekonómiko', Compact: 'Kompakto', SUV: 'SUV', '4x4': '4x4', Van: 'Van' } },
  };
  const lang = () => (window.TEX_i18n ? window.TEX_i18n.getLang() : 'en');
  const tr = (k) => (T[lang()] || T.en)[k];
  const clsLabel = (cls) => (tr('cls') || {})[cls] || cls; // display label; canonical value stays for URLs/data
  const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

  /* ---------- Header scroll state ---------- */
  const header = $('.header');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const nav = $('.nav'), toggle = $('.nav__toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open);
    });
    $$('.nav__links a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('is-open'); toggle.classList.remove('is-open');
    }));
  }

  /* ---------- Render fleet cards ---------- */
  function renderFleet() {
    const grid = $('#fleet-grid');
    if (!grid || !window.TEX_FLEET) return;
    const active = window.TEX_ACTIVE || ((c) => !c.status || c.status === 'active');
    const P = priceCfg();
    grid.innerHTML = window.TEX_FLEET.filter(active).map(car => {
      const trans = car.transmission === 'Manual' ? tr('manual') : tr('auto');
      const msg = tr('book').replace('{car}', `${car.name} (${clsLabel(car.class)})`);
      return `
      <article class="car" data-reveal>
        <div class="car__media">
          <span class="car__class">${clsLabel(car.class)}</span>
          <img src="${car.image}" alt="${car.name}" loading="lazy"
               onerror="this.src='assets/img/car-placeholder.svg'">
        </div>
        <div class="car__body">
          <h3 class="car__name">${car.name}</h3>
          <div class="car__specs">
            <span class="car__spec">👥 ${car.seats} ${tr('seats')}</span>
            <span class="car__spec">⚙️ ${trans}</span>
            ${car.ac ? `<span class="car__spec">❄️ ${tr('ac')}</span>` : ''}
            <span class="car__spec">🚪 ${car.doors}</span>
          </div>
          <div class="car__foot">
            <div class="car__price">
              <span class="from">${tr('from')}</span>
              <b>${P.sym} ${car[P.day]}</b><small>${tr('day')}</small>
            </div>
            ${bookingOn()
              ? `<a class="btn btn--primary" href="${bookUrl({ class: car.class })}" aria-label="${tr('bookOnline')}">
                  ${tr('bookOnline').split(' ')[0]} →
                </a>`
              : `<a class="btn btn--wa" href="${waLink(msg)}" target="_blank" rel="noopener" aria-label="${tr('reserve')}">
                  ${waSvg()} ${tr('reserve').split(' ')[0]}
                </a>`}
          </div>
        </div>
      </article>`;
    }).join('');
    observeReveal();
  }

  /* ---------- Render rates table ---------- */
  function renderRates() {
    const body = $('#rates-body');
    if (!body || !window.TEX_RATES) return;
    const P = priceCfg();
    body.innerHTML = window.TEX_RATES.map(r => `
      <tr>
        <td class="cls">${clsLabel(r.class)}</td>
        <td>${P.sym} ${r[P.day]}</td>
        <td>${P.sym} ${r[P.week]}</td>
        <td>${P.sym} ${r[P.month]}</td>
      </tr>`).join('');
  }

  /* ---------- Car-class options, derived from the fleet data ---------- */
  function renderClassOptions() {
    const sel = $('#f-car');
    if (!sel || !window.TEX_RATES) return;
    const current = sel.value;
    $$('option', sel).slice(1).forEach(o => o.remove()); // keep the i18n placeholder option
    window.TEX_RATES.forEach(r => {
      const o = document.createElement('option');
      o.value = r.class;             // canonical value, what the booking deep link carries
      o.textContent = clsLabel(r.class);
      sel.appendChild(o);
    });
    sel.value = current;
  }

  /* ---------- FAQ accordion ---------- */
  $$('.faq__item').forEach(item => {
    const q = $('.faq__q', item), a = $('.faq__a', item);
    q.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      q.setAttribute('aria-expanded', open);
      a.style.maxHeight = open ? a.scrollHeight + 'px' : 0;
    });
  });
  // recompute open FAQ heights on language change (text length changes)
  window.addEventListener('langchange', () => {
    $$('.faq__item.is-open .faq__a').forEach(a => { a.style.maxHeight = a.scrollHeight + 'px'; });
  });

  /* ---------- Scroll reveal ---------- */
  let io;
  function observeReveal() {
    if (!('IntersectionObserver' in window)) { $$('[data-reveal]').forEach(el => el.classList.add('is-in')); return; }
    io = io || new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        // drop the stagger delay once revealed so hover transitions stay snappy
        e.target.addEventListener('transitionend', () => { e.target.style.transitionDelay = ''; }, { once: true });
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal]:not(.is-in)').filter(el => !el.hidden).forEach(el => {
      // stagger siblings so grids cascade in (hidden booking-only blocks don't count)
      const sibs = Array.from(el.parentElement.querySelectorAll(':scope > [data-reveal]')).filter(s => !s.hidden);
      const i = sibs.indexOf(el);
      if (i > 0) el.style.transitionDelay = Math.min(i * 0.08, 0.4) + 's';
      io.observe(el);
    });
  }

  /* ---------- Date-range picker ---------- */
  const pickup = $('#f-pickup'), ret = $('#f-return'), dayCount = $('#daycount');
  const todayISO = () => new Date().toISOString().split('T')[0];
  const daysLabel = (n) => ({
    en: `${n} day${n>1?'s':''} rental`, nl: `${n} dag${n>1?'en':''} huur`,
    es: `alquiler de ${n} día${n>1?'s':''}`, pap: `${n} dia di hür`
  }[lang()]);
  function updateDays() {
    if (!pickup || !ret) return;
    if (ret.value) ret.min = pickup.value || todayISO();
    if (pickup.value && ret.value) {
      const a = new Date(pickup.value), b = new Date(ret.value);
      const n = Math.round((b - a) / 86400000);
      if (n >= 1) { dayCount.textContent = daysLabel(n); dayCount.hidden = false; return; }
    }
    dayCount.hidden = true;
  }
  if (pickup && ret) {
    pickup.min = ret.min = todayISO();
    pickup.addEventListener('change', () => {
      ret.min = pickup.value;
      if (ret.value && ret.value < pickup.value) ret.value = pickup.value;
      updateDays();
    });
    ret.addEventListener('change', updateDays);
    window.addEventListener('langchange', () => { if (!dayCount.hidden) updateDays(); });
  }

  /* ---------- Inquiry form (Phase 1: hands off to WhatsApp) ---------- */
  const form = $('#inquiry-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msgEl = $('.form__msg', form);
      const data = Object.fromEntries(new FormData(form));
      if (!data.name || !data.email) {
        msgEl.textContent = { en:'Please add your name and email.', nl:'Vul je naam en e-mail in.', es:'Añade tu nombre y correo.', pap:'Yena bo nòmber i email.' }[lang()];
        msgEl.className = 'form__msg err'; return;
      }
      if (bookingOn()) {
        // Phase 2 seam: hand dates + class straight into the booking app.
        msgEl.textContent = tr('toBooking');
        msgEl.className = 'form__msg ok';
        window.location.href = bookUrl({ class: data.car, pickup: data.pickup, return: data.return });
        return;
      }
      const dates = (data.pickup || data.return) ? `${data.pickup || '?'} → ${data.return || '?'}` : '-';
      // (When the owner's email is confirmed, wire a form service here instead.)
      const summary = [
        tr('sum'),
        `• ${tr('lblName')}: ${data.name}`,
        `• ${tr('lblEmail')}: ${data.email}`,
        `• ${tr('lblDates')}: ${dates}`,
        `• ${tr('lblCar')}: ${data.car ? clsLabel(data.car) : '-'}`,
        `• ${tr('lblMsg')}: ${data.message || '-'}`,
      ].join('\n');
      window.open(waLink(summary), '_blank', 'noopener');
      msgEl.textContent = { en:'Opening WhatsApp to send your request…', nl:'WhatsApp wordt geopend…', es:'Abriendo WhatsApp…', pap:'Ta habri WhatsApp…' }[lang()];
      msgEl.className = 'form__msg ok';
      form.reset(); if (dayCount) dayCount.hidden = true;
    });
    // a status line in the old language reads as a glitch; clear it on switch
    window.addEventListener('langchange', () => {
      const msgEl = $('.form__msg', form);
      if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form__msg'; }
    });
  }

  /* ---------- WhatsApp icon ---------- */
  function waSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.738-.979zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;
  }

  /* ---------- Footer year ---------- */
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ---------- Boot + re-render on language change ---------- */
  function boot() { renderFleet(); renderRates(); renderClassOptions(); observeReveal(); }
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('langchange', () => { renderFleet(); renderRates(); renderClassOptions(); });
})();
