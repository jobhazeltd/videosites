const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadVideos() {
  const res = await fetch('/api/videos');
  if (!res.ok) throw new Error('Videos load nahi hui');
  return res.json();
}

function card(v) {
  return `<a class="card" href="/watch.html?id=${encodeURIComponent(v.id)}" data-src="${esc(v.src)}">
    <div class="thumb">
      <img loading="lazy" src="${esc(v.thumbnail)}" alt="${esc(v.title)}">
      <span class="dur">${esc(v.duration)}</span>
      <span class="hint">▶ Dobara tap karein</span>
    </div>
    <h3>${esc(v.title)}</h3><p>${esc(v.category)}</p></a>`;
}

/* ---------- Thumbnail preview ----------
   Desktop: mouse le jao to preview chalta hai, click pe video khulti hai.
   Mobile:  pehla tap = preview, doosra tap = video khulti hai. */
const PREVIEW_START = 5;   // second se preview shuru
const PREVIEW_LENGTH = 6;  // kitne second ka loop
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let activeCard = null;

function stopPreview() {
  if (!activeCard) return;
  const v = activeCard.querySelector('video.pv');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
  activeCard.classList.remove('previewing');
  activeCard = null;
}

function startPreview(cardEl) {
  if (activeCard === cardEl) return;
  stopPreview();
  activeCard = cardEl;
  cardEl.classList.add('previewing');

  const v = document.createElement('video');
  v.className = 'pv';
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'metadata';
  v.src = cardEl.dataset.src;

  v.addEventListener('loadedmetadata', () => {
    const start = v.duration > PREVIEW_START + PREVIEW_LENGTH ? PREVIEW_START : 0;
    v.dataset.start = start;
    v.currentTime = start;
  });
  v.addEventListener('timeupdate', () => {
    const start = Number(v.dataset.start || 0);
    if (v.currentTime > start + PREVIEW_LENGTH) v.currentTime = start;
  });
  v.addEventListener('playing', () => v.classList.add('on'));

  cardEl.querySelector('.thumb').appendChild(v);
  v.play().catch(() => {});
}

function bindPreviews(container) {
  container.querySelectorAll('.card').forEach((c) => {
    if (canHover) {
      c.addEventListener('mouseenter', () => startPreview(c));
      c.addEventListener('mouseleave', () => { if (activeCard === c) stopPreview(); });
    } else {
      c.addEventListener('click', (e) => {
        if (activeCard !== c) { e.preventDefault(); startPreview(c); }
      });
    }
  });
}

document.addEventListener('click', (e) => {
  if (activeCard && !e.target.closest('.card')) stopPreview();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreview(); });

function renderGrid(el, list) {
  stopPreview();
  el.innerHTML = list.length ? list.map(card).join('') : '<div class="empty">Koi video nahi mili</div>';
  bindPreviews(el);
}

async function initHome() {
  const grid = document.getElementById('grid');
  const search = document.getElementById('search');
  const cats = document.getElementById('cats');
  let videos = [];
  try { videos = await loadVideos(); } catch (e) { grid.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  let active = 'All';

  const categories = ['All', ...new Set(videos.map((v) => v.category))];
  cats.innerHTML = categories.map((c) => `<button data-c="${esc(c)}" class="${c === active ? 'active' : ''}">${esc(c)}</button>`).join('');

  const update = () => {
    const q = search.value.toLowerCase();
    renderGrid(grid, videos.filter((v) =>
      (active === 'All' || v.category === active) && v.title.toLowerCase().includes(q)));
  };

  cats.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    active = b.dataset.c;
    cats.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.c === active));
    update();
  });
  search.addEventListener('input', update);
  update();
}

async function initWatch() {
  const box = document.getElementById('player');
  const id = new URLSearchParams(location.search).get('id');
  let videos = [];
  try { videos = await loadVideos(); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const v = videos.find((x) => x.id === id);
  if (!v) { box.innerHTML = '<div class="empty">Video nahi mili. <a href="/">Home</a></div>'; return; }
  document.title = v.title;
  box.innerHTML = `<video controls autoplay playsinline poster="${esc(v.thumbnail)}" src="${esc(v.src)}"></video>
    <div class="ctrl">
      <div class="seg">
        <button data-skip="-600">« 10m</button><button data-skip="-60">‹ 1m</button><button data-skip="-10">‹ 10s</button>
      </div>
      <div class="seg">
        <button data-skip="10">10s ›</button><button data-skip="60">1m ›</button><button data-skip="600">10m »</button>
      </div>
    </div>
    <div class="ctrl loop">
      <div class="ab">
        <input id="loopA" value="00:00:00" inputmode="numeric" aria-label="Loop start">
        <button class="pin" data-pin="A" title="Abhi ka time start banao">⏱</button>
        <span>→</span>
        <input id="loopB" value="00:00:00" inputmode="numeric" aria-label="Loop end">
        <button class="pin" data-pin="B" title="Abhi ka time end banao">⏱</button>
      </div>
      <button id="loopBtn" class="loopbtn">Loop <i></i></button>
    </div>
    <h1>${esc(v.title)}</h1>
    <div class="tabs"><button class="on" data-tab="details">Details</button>${v.downloads?.length ? '<button data-tab="dl">Downloads</button>' : ''}</div>
    <div class="tab" data-pane="details"><div class="meta">${esc(v.category)} · ${esc(v.duration)}<br>${esc(v.description)}</div></div>
    <div class="tab" data-pane="dl" hidden>${(v.downloads || []).map((d) => `
      <div class="dl">
        <div class="dlname">${esc(d.label || v.title)}${d.quality ? ` <span class="q">${esc(d.quality)}</span>` : ''}</div>
        <span class="dlsize">${esc(d.size)}</span>
        <a class="dlbtn" href="${esc(d.url)}" rel="nofollow noopener" ${d.url.startsWith('http') ? 'target="_blank"' : ''}>⤓ ${d.url.startsWith('magnet:') ? 'Magnet' : 'Download'}</a>
      </div>`).join('')}</div>`;
  box.querySelector('.tabs').addEventListener('click', (e) => {
    const t = e.target.dataset.tab;
    if (!t) return;
    box.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    box.querySelectorAll('.tab').forEach((p) => { p.hidden = p.dataset.pane !== t; });
  });
  initPlayerControls(box);
  renderGrid(document.getElementById('related'), videos.filter((x) => x.id !== v.id).slice(0, 8));
}

/* ---------- Player controls: skip + A-B loop ---------- */
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};
const parseTime = (str) => {
  const parts = String(str).trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

function initPlayerControls(box) {
  const video = box.querySelector('video');
  const inA = box.querySelector('#loopA');
  const inB = box.querySelector('#loopB');
  const loopBtn = box.querySelector('#loopBtn');
  let looping = false;

  box.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => {
    const t = video.currentTime + Number(b.dataset.skip);
    video.currentTime = Math.min(Math.max(0, t), video.duration || t);
  }));

  box.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => {
    (b.dataset.pin === 'A' ? inA : inB).value = fmt(video.currentTime);
  }));

  [inA, inB].forEach((inp) => inp.addEventListener('change', () => {
    const s = parseTime(inp.value);
    inp.value = fmt(Number.isNaN(s) ? 0 : s);
  }));

  const range = () => {
    const a = parseTime(inA.value);
    let b = parseTime(inB.value);
    if (!b || b <= a) b = video.duration || Infinity; // B khali ho to video ke end tak
    return [a || 0, b];
  };

  loopBtn.addEventListener('click', () => {
    looping = !looping;
    loopBtn.classList.toggle('on', looping);
    if (looping) {
      const [a, b] = range();
      if (video.currentTime < a || video.currentTime >= b) video.currentTime = a;
      video.play().catch(() => {});
    }
  });

  video.addEventListener('timeupdate', () => {
    if (!looping) return;
    const [a, b] = range();
    if (video.currentTime >= b - 0.15) video.currentTime = a;
  });
  video.addEventListener('ended', () => {
    if (looping) { video.currentTime = range()[0]; video.play().catch(() => {}); }
  });

  // Keyboard: ← → = 10s, Shift+← → = 1m
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = (e.shiftKey ? 60 : 10) * (e.key === 'ArrowLeft' ? -1 : 1);
    video.currentTime = Math.max(0, video.currentTime + step);
  });
}
