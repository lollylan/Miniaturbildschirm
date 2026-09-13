/* Praxisbildschirm – Szenen-Engine (Renderer) */
(() => {
  'use strict';

  const stage = document.getElementById('stage');
  const bg = document.getElementById('bg');
  const progressBar = document.getElementById('progressBar');
  const tickerText = document.getElementById('tickerText');
  const errorBox = document.getElementById('errorBox');

  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/><path d="M4 20l1-4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path fill="#F0A05A" stroke="#D4713F" stroke-width="1" stroke-linejoin="round" d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    syringe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4M19 5l-9 9M6 12l6 6M4 20l3-3M8 10l6 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  };
  const ENTER_ANIMS = ['rise', 'wipe', 'slide', 'zoom', 'curtain'];

  let config = null;
  let scenes = [];
  let index = -1;
  let sceneTimer = null;
  let tickerTimer = null;
  let tickerIndex = 0;
  let animSeq = 0;
  let current = null;

  // ---------- Hilfen ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  function titleHtml(text, size, startDelay = 0.15) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    return `<h1 class="title ${size}">${words.map((w, i) => `<span class="w" style="--d:${(startDelay + i * 0.07).toFixed(2)}s">${esc(w)}</span>`).join(' ')}</h1>`;
  }
  const rv = (html, delay) => html.replace(/^<(\w+)/, `<$1 class="rv" style="--d:${delay.toFixed(2)}s"`);
  const rvc = (cls, delay) => `class="${cls} rv" style="--d:${delay.toFixed(2)}s"`;

  function inSeason(s) {
    if (!s.from && !s.until) return true;
    const now = new Date();
    const md = (now.getMonth() + 1) * 100 + now.getDate();
    const parse = v => { const [m, d] = String(v).split('-').map(Number); return m * 100 + d; };
    const from = s.from ? parse(s.from) : 101;
    const until = s.until ? parse(s.until) : 1231;
    return from <= until ? (md >= from && md <= until) : (md >= from || md <= until);
  }

  function qrCard(s, extraClass = '') {
    if (!s.qrSvg) return '';
    return `<div class="qr-card ${extraClass}">
      <div class="qr-frame">${s.qrSvg}<div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div><div class="scanline"></div></div>
      ${s.qrLabel ? `<div class="qr-label">${esc(s.qrLabel)}</div>` : ''}
      ${s.qrHint ? `<div class="qr-hint">${esc(s.qrHint)}</div>` : ''}
      <div class="phone">${ICONS.phone}</div>
    </div>`;
  }
  function bulletsHtml(list, start = 0.5) {
    if (!list || !list.length) return '';
    return `<ul class="bullets">${list.map((b, i) => `<li class="rv" style="--d:${(start + i * 0.16).toFixed(2)}s"><span class="ico">${ICONS.check}</span><span>${esc(b)}</span></li>`).join('')}</ul>`;
  }
  const ctaHtml = (s, delay) => s.cta ? `<div ${rvc('cta', delay)}>${ICONS.arrow}<span>${esc(s.cta)}</span></div>` : '';
  const badgeHtml = (s, delay = 0) => s.badge ? `<div ${rvc('badge', delay)}>${esc(s.badge)}</div>` : '';

  // ---------- Szenen-Vorlagen ----------
  const TEMPLATES = {
    welcome(s) {
      return `<section class="scene welcome">
        <div class="logo-wrap"><div class="ring"></div><div class="ring r2"></div><img src="assets/logo.png" alt=""></div>
        ${titleHtml(s.title, 'xl', 0.4)}
        ${s.subtitle ? `<div ${rvc('subtitle', 0.9)}>${esc(s.subtitle)}</div>` : ''}
        ${s.text ? `<p ${rvc('text', 1.15)}>${esc(s.text)}</p>` : ''}
      </section>`;
    },
    hero(s) {
      const hasImg = !!(s.image || s.video);
      const size = (s.title || '').length > 30 ? 'm' : 'l';
      return `<section class="scene hero ${hasImg ? '' : 'no-image'}">
        <div class="col">
          ${badgeHtml(s, 0.05)}
          ${titleHtml(s.title, size, 0.2)}
          ${s.text ? `<p ${rvc('text', 0.6)}>${esc(s.text)}</p>` : ''}
          ${bulletsHtml(s.bullets, 0.6)}
          ${ctaHtml(s, 1.15)}
        </div>
        <div class="visual">
          ${(s.videoUrl || s.video)
            ? `<video src="${esc(s.videoUrl || s.video)}" ${hasImg ? `poster="${esc(s.imageUrl || s.image)}"` : ''} autoplay muted loop playsinline disablepictureinpicture style="object-position:${esc(s.imagePosition || 'center')}"></video>`
            : (hasImg ? `<img src="${esc(s.imageUrl || s.image)}" alt="" style="object-position:${esc(s.imagePosition || 'center')}">` : '')}
          ${s.qrSvg ? `<div ${rvc('qr-mini', 1.0)}>${s.qrSvg}<span>${esc(s.qrLabel || '')}</span></div>` : ''}
        </div>
      </section>`;
    },
    steps(s) {
      const cards = (s.steps || []).map((st, i) => `
        <div class="card rv" style="--d:${(0.55 + i * 0.22).toFixed(2)}s">
          <div class="num">${i + 1}</div>
          <div class="ico">${ICONS[st.icon] || ICONS.check}</div>
          <h3>${esc(st.title)}</h3>
          <p>${esc(st.text)}</p>
        </div>`).join('');
      return `<section class="scene steps">
        ${badgeHtml(s, 0.05)}
        ${titleHtml(s.title, 'l', 0.2)}
        <div class="cards">${cards}</div>
        ${ctaHtml(s, 1.4)}
      </section>`;
    },
    qr(s) {
      return `<section class="scene qr">
        <div class="col">
          ${badgeHtml(s, 0.05)}
          ${titleHtml(s.title, 'l', 0.2)}
          ${s.text ? `<p ${rvc('text', 0.55)}>${esc(s.text)}</p>` : ''}
          ${bulletsHtml(s.bullets, 0.55)}
          ${ctaHtml(s, 1.3)}
        </div>
        ${qrCard(s, 'rv').replace('class="qr-card rv"', 'class="qr-card rv" style="--d:0.7s"')}
      </section>`;
    },
    team(s) {
      const initials = n => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const cards = (s.persons || []).map((p, i) => `
        <div class="person rv" style="--d:${(0.55 + i * 0.28).toFixed(2)}s">
          <div class="avatar">${(p.photoUrl || p.photo) ? `<img src="${esc(p.photoUrl || p.photo)}" alt="">` : `<span>${esc(initials(p.name))}</span>`}</div>
          <div class="pinfo">
            <div class="pname">${esc(p.name)}</div>
            <div class="prole">${esc(p.role)}</div>
            ${p.text ? `<div class="ptext">${esc(p.text)}</div>` : ''}
          </div>
        </div>`).join('');
      return `<section class="scene team">
        ${badgeHtml(s, 0.05)}
        ${titleHtml(s.title, 'l', 0.2)}
        ${s.text ? `<p ${rvc('text', 0.5)}>${esc(s.text)}</p>` : ''}
        <div class="persons">${cards}</div>
        ${ctaHtml(s, 1.4)}
      </section>`;
    },
    stars(s) {
      const stars = [0, 1, 2, 3, 4].map(i => `<div class="star" style="--d:${(0.6 + i * 0.2).toFixed(2)}s">${ICONS.star}</div>`).join('');
      return `<section class="scene stars">
        <div class="col">
          ${badgeHtml(s, 0.05)}
          ${titleHtml(s.title, 'xl', 0.2)}
          <div class="row shine">${stars}</div>
          ${s.text ? `<p ${rvc('text', 1.5)}>${esc(s.text)}</p>` : ''}
          ${s.cta ? `<div ${rvc('thanks', 1.9)}>${esc(s.cta)}</div>` : `<div ${rvc('thanks', 1.9)}>Vielen Dank – Ihr Praxisteam</div>`}
        </div>
        ${qrCard(s, 'rv').replace('class="qr-card rv"', 'class="qr-card rv" style="--d:1.0s"')}
      </section>`;
    },
  };

  // ---------- Ablauf ----------
  function applyTheme(theme) {
    const dark = theme === 'dark';
    bg.classList.toggle('theme-dark', dark);
    bg.classList.toggle('theme-light', !dark);
    document.body.classList.toggle('dark', dark);
  }

  function showScene(i) {
    if (!scenes.length) return;
    index = ((i % scenes.length) + scenes.length) % scenes.length;
    const s = scenes[index];
    const tpl = TEMPLATES[s.type] || TEMPLATES.hero;
    const node = el(tpl(s));
    const anim = ENTER_ANIMS[animSeq++ % ENTER_ANIMS.length];
    // Fehlende Bilder: Bildspalte ausblenden, Text nutzt die volle Breite
    node.querySelectorAll('.visual img').forEach(img => img.addEventListener('error', () => node.classList.add('no-image')));
    // Fehlendes Video: auf das Standbild zurückfallen
    node.querySelectorAll('.visual video').forEach(v => v.addEventListener('error', () => {
      const img = document.createElement('img'); img.src = v.getAttribute('poster') || ''; img.alt = ''; img.style.objectPosition = v.style.objectPosition;
      if (!img.src) { node.classList.add('no-image'); return; }
      img.addEventListener('error', () => node.classList.add('no-image'));
      v.replaceWith(img);
    }));

    applyTheme(s.theme);
    const old = current;
    if (old) {
      old.className = old.className.replace(/enter-\w+/g, '') + ' leave-' + anim;
      old.addEventListener('animationend', () => old.remove(), { once: true });
      setTimeout(() => old.remove(), 1500);
    }
    node.classList.add('enter-' + anim);
    stage.appendChild(node);
    current = node;

    const dur = Number(s.duration) || Number(config.timing?.defaultDuration) || 12;
    progressBar.classList.remove('run');
    void progressBar.offsetWidth; // Animation neu starten
    progressBar.style.setProperty('--dur', dur + 's');
    progressBar.classList.add('run');

    clearTimeout(sceneTimer);
    sceneTimer = setTimeout(() => showScene(index + 1), dur * 1000);
  }

  function startTicker() {
    clearInterval(tickerTimer);
    const items = (config.ticker || []).filter(Boolean);
    document.getElementById('ticker').style.display = items.length ? '' : 'none';
    if (!items.length) return;
    const interval = Number(config.timing?.tickerInterval) || 8;
    const show = () => {
      tickerText.textContent = items[tickerIndex % items.length];
      tickerText.classList.remove('swap', 'marquee'); void tickerText.offsetWidth;
      // Überlange Hinweise langsam nach links schieben statt abzuschneiden
      const overflow = tickerText.scrollWidth - tickerText.parentElement.clientWidth;
      if (overflow > 0) {
        tickerText.style.setProperty('--shift', `-${overflow + 8}px`);
        tickerText.style.setProperty('--scroll-dur', `${Math.max(3, interval - 3)}s`);
        tickerText.classList.add('marquee');
      } else {
        tickerText.classList.add('swap');
      }
      tickerIndex++;
    };
    show();
    tickerTimer = setInterval(show, interval * 1000);
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('clockTime').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('clockDate').textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  function applyConfig(cfg) {
    config = cfg || {};
    document.getElementById('brandName').textContent = config.praxis?.name || 'Praxis Dr. Florian Rasche';
    document.getElementById('brandSub').textContent = config.praxis?.subtitle || '';
    scenes = (config.scenes || []).filter(s => s && s.enabled !== false && inSeason(s));
    if (config.error) { errorBox.textContent = config.error; errorBox.hidden = false; }
    else if (!scenes.length) { errorBox.textContent = 'Keine aktiven Szenen in config.json.'; errorBox.hidden = false; }
    else errorBox.hidden = true;
    startTicker();
    showScene(0);
  }

  // Jahreszeiten-Filter einmal täglich neu prüfen (z. B. Grippe-Szene ab 1. September)
  setInterval(() => { if (config) scenes = (config.scenes || []).filter(s => s && s.enabled !== false && inSeason(s)); }, 60 * 60 * 1000);

  updateClock();
  setInterval(updateClock, 10000);

  window.__praxis = { sceneCount: () => scenes.length, goto: (i) => showScene(i) };

  window.praxisAPI.getConfig().then(applyConfig);
  window.praxisAPI.onConfigUpdated(applyConfig);
})();
