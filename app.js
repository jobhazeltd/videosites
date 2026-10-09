const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Thumbnail na mile to yeh dikhe
const FALLBACK_THUMB = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#181a21"/>' +
  '<path d="M6.5 3v3l2.6-1.5z" fill="#3a3e4c"/></svg>');
window.thumbErr = (img) => { img.onerror = null; img.src = FALLBACK_THUMB; };

function ytId(url) {
  const m = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i.exec(url || '');
  return m ? m[1] : null;
}
const thumbOf = (v) => v.thumbnail || (ytId(v.src) ? `https://i.ytimg.com/vi/${ytId(v.src)}/hqdefault.jpg` : FALLBACK_THUMB);

async function loadVideos() {
  const res = await fetch('/api/videos');
  if (!res.ok) throw new Error('Videos load nahi hui');
  return res.json();
}

function card(v) {
  return `<a class="card" href="/watch.html?id=${encodeURIComponent(v.id)}" data-src="${esc(v.src)}">
    <div class="thumb">
      <img loading="lazy" src="${esc(thumbOf(v))}" alt="${esc(v.title)}" onerror="thumbErr(this)">
      ${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ''}
      <span class="hint">▶ Dobara tap karein</span>
    </div>
    <h3>${esc(v.title)}</h3><p>${esc(v.category)}</p></a>`;
}

/* ---------- Thumbnail preview ----------
   Desktop: hover = preview. Mobile: pehla tap = preview, doosra tap = video. */
const PREVIEW_START = 5;
const PREVIEW_LENGTH = 6;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let activeCard = null;

function stopPreview() {
  if (!activeCard) return;
  const el = activeCard.querySelector('.pv');
  if (el) {
    if (el.tagName === 'VIDEO') { el.pause(); el.removeAttribute('src'); el.load(); }
    el.remove();
  }
  activeCard.classList.remove('previewing');
  activeCard = null;
}

function startPreview(cardEl) {
  if (activeCard === cardEl) return;
  stopPreview();
  activeCard = cardEl;
  cardEl.classList.add('previewing');
  const src = cardEl.dataset.src;
  const yt = ytId(src);
  let el;

  if (yt) {
    el = document.createElement('iframe');
    el.className = 'pv';
    el.allow = 'autoplay; encrypted-media';
    el.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&controls=0&start=${PREVIEW_START}` +
      `&end=${PREVIEW_START + PREVIEW_LENGTH}&loop=1&playlist=${yt}&playsinline=1&modestbranding=1&rel=0&disablekb=1`;
    el.addEventListener('load', () => setTimeout(() => el.classList.add('on'), 400));
  } else {
    el = document.createElement('video');
    el.className = 'pv';
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.preload = 'metadata';
    el.src = src;
    el.addEventListener('loadedmetadata', () => {
      const start = el.duration > PREVIEW_START + PREVIEW_LENGTH ? PREVIEW_START : 0;
      el.dataset.start = start;
      el.currentTime = start;
    });
    el.addEventListener('timeupdate', () => {
      const start = Number(el.dataset.start || 0);
      if (el.currentTime > start + PREVIEW_LENGTH) el.currentTime = start;
    });
    el.addEventListener('playing', () => el.classList.add('on'));
    el.addEventListener('error', () => cardEl.classList.add('nopreview'));
  }
  cardEl.querySelector('.thumb').appendChild(el);
  if (el.play) el.play().catch(() => {});
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

/* ---------- Player (HTML5 file ya YouTube) — dono ka ek hi interface ---------- */
function html5Player(mount, v) {
  mount.innerHTML = `<video controls autoplay playsinline poster="${esc(thumbOf(v))}" src="${esc(v.src)}"></video>`;
  const el = mount.querySelector('video');
  el.addEventListener('error', () => {
    mount.insertAdjacentHTML('beforeend', '<p class="perr">Video load nahi hui. Link direct .mp4/.webm file ka hona chahiye.</p>');
  }, { once: true });
  return {
    time: () => el.currentTime,
    duration: () => el.duration || 0,
    seek: (t) => { el.currentTime = t; },
    play: () => el.play().catch(() => {}),
    onTime: (cb) => el.addEventListener('timeupdate', cb),
    onEnded: (cb) => el.addEventListener('ended', cb),
  };
}

let ytReady;
function loadYT() {
  if (!ytReady) {
    ytReady = new Promise((resolve) => {
      window.onYouTubeIframeAPIReady = resolve;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return ytReady;
}

async function youtubePlayer(mount, id) {
  mount.innerHTML = '<div class="frame"><div id="ytp"></div></div>';
  await loadYT();
  const timeCbs = [];
  const endCbs = [];
  const p = await new Promise((resolve) => {
    const player = new YT.Player('ytp', {
      videoId: id,
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) endCbs.forEach((f) => f()); },
        onError: () => mount.insertAdjacentHTML('beforeend', '<p class="perr">Yeh YouTube video embed ki ijazat nahi deti ya private hai.</p>'),
      },
    });
  });
  setInterval(() => timeCbs.forEach((f) => f()), 250);
  return {
    time: () => p.getCurrentTime() || 0,
    duration: () => p.getDuration() || 0,
    seek: (t) => p.seekTo(t, true),
    play: () => p.playVideo(),
    onTime: (cb) => timeCbs.push(cb),
    onEnded: (cb) => endCbs.push(cb),
  };
}

async function initWatch() {
  const box = document.getElementById('player');
  const id = new URLSearchParams(location.search).get('id');
  let videos = [];
  try { videos = await loadVideos(); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const v = videos.find((x) => x.id === id);
  if (!v) { box.innerHTML = '<div class="empty">Video nahi mili. <a href="/">Home</a></div>'; return; }
  document.title = v.title;

  box.innerHTML = `<div id="mount"></div>
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
    <div class="tab" data-pane="details"><div class="meta">${esc(v.category)}${v.duration ? ` · ${esc(v.duration)}` : ''}<br>${esc(v.description)}</div></div>
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

  renderGrid(document.getElementById('related'), videos.filter((x) => x.id !== v.id).slice(0, 8));

  const mount = box.querySelector('#mount');
  const yt = ytId(v.src);
  const player = yt ? await youtubePlayer(mount, yt) : html5Player(mount, v);
  initPlayerControls(box, player);
}

/* ---------- Skip + A-B loop ---------- */
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};
const parseTime = (str) => {
  const parts = String(str).trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

function initPlayerControls(box, player) {
  const inA = box.querySelector('#loopA');
  const inB = box.querySelector('#loopB');
  const loopBtn = box.querySelector('#loopBtn');
  let looping = false;

  const skip = (delta) => {
    const d = player.duration();
    const t = Math.max(0, player.time() + delta);
    player.seek(d ? Math.min(t, d - 0.5) : t);
  };

  box.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', () => skip(Number(b.dataset.skip))));
  box.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => {
    (b.dataset.pin === 'A' ? inA : inB).value = fmt(player.time());
  }));
  [inA, inB].forEach((inp) => inp.addEventListener('change', () => {
    const s = parseTime(inp.value);
    inp.value = fmt(Number.isNaN(s) ? 0 : s);
  }));

  const range = () => {
    const a = parseTime(inA.value) || 0;
    let b = parseTime(inB.value);
    if (!b || b <= a) b = player.duration() || Infinity;
    return [a, b];
  };

  loopBtn.addEventListener('click', () => {
    looping = !looping;
    loopBtn.classList.toggle('on', looping);
    if (looping) {
      const [a, b] = range();
      const t = player.time();
      if (t < a || t >= b) player.seek(a);
      player.play();
    }
  });

  player.onTime(() => {
    if (!looping) return;
    const [a, b] = range();
    if (player.time() >= b - 0.25) player.seek(a);
  });
  player.onEnded(() => { if (looping) { player.seek(range()[0]); player.play(); } });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    skip((e.shiftKey ? 60 : 10) * (e.key === 'ArrowLeft' ? -1 : 1));
  });
}
