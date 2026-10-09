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
const fmtViews = (n) => {
  n = Number(n) || 0;
  const c = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  return `${c} ${n === 1 ? 'view' : 'views'}`;
};
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
      <span class="hint">▶ Tap Again </span>
    </div>
    <h3>${esc(v.title)}</h3><p>${esc(v.category)} · ${fmtViews(v.views)}</p></a>`;
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

/* ---------- Apna player: poster + apna play button + apne controls ----------
   Engine (HTML5 file ya YouTube) neeche ka kaam karta hai, UI hamari apni hai. */
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.6 3 2.7-2.7-1.3-1.3-2.7 2.7-2.7-2.7-1.3 1.3 2.7 2.7-2.7 2.7 1.3 1.3 2.7-2.7 2.7 2.7 1.3-1.3z"/></svg>',
  fs: '<svg viewBox="0 0 24 24"><path d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z"/></svg>',
};
const clock = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function html5Engine(media, v) {
  const el = document.createElement('video');
  el.playsInline = true;
  el.setAttribute('playsinline', '');
  el.preload = 'metadata';
  el.src = v.src;
  media.appendChild(el);
  return {
    start: () => el.play(),
    play: () => el.play().catch(() => {}),
    pause: () => el.pause(),
    paused: () => el.paused,
    buffering: () => !el.paused && el.readyState < 3,
    time: () => el.currentTime,
    duration: () => el.duration || 0,
    seek: (t) => { el.currentTime = t; },
    muted: () => el.muted,
    setMuted: (m) => { el.muted = m; },
    onEnded: (cb) => el.addEventListener('ended', cb),
    onError: (cb) => el.addEventListener('error', cb),
    nativeFullscreen: () => el.webkitEnterFullscreen && el.webkitEnterFullscreen(),
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

function ytEngine(media, id) {
  let p = null;
  let pending = null;
  const endCbs = [];
  const errCbs = [];
  const ensure = () => {
    if (p) return Promise.resolve(p);
    if (pending) return pending;
    pending = loadYT().then(() => new Promise((resolve) => {
      const div = document.createElement('div');
      media.appendChild(div);
      const pl = new YT.Player(div, {
        videoId: id,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { p = pl; resolve(pl); },
          onStateChange: (e) => { if (e.data === 0) endCbs.forEach((f) => f()); },
          onError: () => errCbs.forEach((f) => f()),
        },
      });
    }));
    return pending;
  };
  const state = () => (p ? p.getPlayerState() : -1);
  return {
    start: () => ensure().then((pl) => pl.playVideo()),
    play: () => { ensure().then((pl) => pl.playVideo()); },
    pause: () => p && p.pauseVideo(),
    paused: () => ![1, 3].includes(state()),
    buffering: () => state() === 3,
    time: () => (p ? p.getCurrentTime() || 0 : 0),
    duration: () => (p ? p.getDuration() || 0 : 0),
    seek: (t) => p && p.seekTo(t, true),
    muted: () => (p ? p.isMuted() : false),
    setMuted: (m) => p && (m ? p.mute() : p.unMute()),
    onEnded: (cb) => endCbs.push(cb),
    onError: (cb) => errCbs.push(cb),
    nativeFullscreen: null,
  };
}

function createPlayer(mount, v) {
  mount.innerHTML = `
    <div class="vp" tabindex="0">
      <div class="vp-media"></div>
      <div class="vp-poster"></div>
      <div class="vp-hit"></div>
      <div class="vp-spin" hidden></div>
      <button class="vp-big" aria-label="Play">${ICON.play}</button>
      <div class="vp-bar">
        <button class="vp-btn vp-pp" aria-label="Play / Pause">${ICON.play}</button>
        <span class="vp-t">0:00 / 0:00</span>
        <input class="vp-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">
        <button class="vp-btn vp-mute" aria-label="Mute">${ICON.vol}</button>
        <button class="vp-btn vp-fs" aria-label="Fullscreen">${ICON.fs}</button>
      </div>
    </div>`;
  const root = mount.querySelector('.vp');
  const $q = (s) => root.querySelector(s);
  const poster = $q('.vp-poster');
  poster.style.backgroundImage = `url(${JSON.stringify(thumbOf(v))})`;

  const yt = ytId(v.src);
  const eng = yt ? ytEngine($q('.vp-media'), yt) : html5Engine($q('.vp-media'), v);
  let started = false;
  let dragging = false;
  let hideTimer = null;
  const timeCbs = [];

  const showBar = () => {
    root.classList.add('ui');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!eng.paused() && !dragging) root.classList.remove('ui'); }, 2800);
  };

  const start = async () => {
    if (started) return;
    started = true;
    root.classList.add('started');
    $q('.vp-spin').hidden = false;
    try { await eng.start(); } catch { /* autoplay block: user dobara tap kare */ }
  };

  const toggle = () => {
    if (!started) return start();
    if (eng.paused()) eng.play(); else eng.pause();
    showBar();
  };

  $q('.vp-big').addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  $q('.vp-pp').addEventListener('click', toggle);
  $q('.vp-hit').addEventListener('click', () => {
    if (!started) return start();
    // Touch pe pehla tap sirf controls dikhata hai
    if (window.matchMedia('(hover: none)').matches && !root.classList.contains('ui')) return showBar();
    toggle();
  });
  root.addEventListener('pointermove', showBar);
  root.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
  });

  $q('.vp-mute').addEventListener('click', () => { eng.setMuted(!eng.muted()); showBar(); });

  $q('.vp-fs').addEventListener('click', () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    } else if (eng.nativeFullscreen) {
      eng.nativeFullscreen(); // iPhone Safari
    }
  });

  const seek = $q('.vp-seek');
  seek.addEventListener('input', () => {
    dragging = true;
    const d = eng.duration();
    $q('.vp-t').textContent = `${clock((seek.value / 1000) * d)} / ${clock(d)}`;
  });
  seek.addEventListener('change', () => {
    dragging = false;
    eng.seek((seek.value / 1000) * eng.duration());
    showBar();
  });

  eng.onError(() => {
    $q('.vp-spin').hidden = true;
    mount.insertAdjacentHTML('beforeend', `<p class="perr">${yt
      ? 'Yeh YouTube video embed ki ijazat nahi deti ya private hai.'
      : 'Video load nahi hui. Link direct .mp4/.webm file ka hona chahiye.'}</p>`);
  });

  // UI update loop
  let wasPaused = null;
  setInterval(() => {
    if (!started) return;
    const t = eng.time();
    const d = eng.duration();
    const paused = eng.paused();
    if (!dragging) {
      seek.value = d ? Math.round((t / d) * 1000) : 0;
      $q('.vp-t').textContent = `${clock(t)} / ${clock(d)}`;
    }
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    if (paused !== wasPaused) {
      wasPaused = paused;
      root.classList.toggle('paused', paused);
      $q('.vp-pp').innerHTML = paused ? ICON.play : ICON.pause;
      if (paused) root.classList.add('ui'); else showBar();
    }
    $q('.vp-spin').hidden = !(eng.buffering() || (!d && !paused));
    $q('.vp-mute').innerHTML = eng.muted() ? ICON.mute : ICON.vol;
    timeCbs.forEach((f) => f());
  }, 250);

  // Skip / loop controls ke liye wahi purana interface
  return {
    time: () => eng.time(),
    duration: () => eng.duration(),
    seek: (t) => { if (!started) start().then(() => setTimeout(() => eng.seek(t), 600)); else eng.seek(t); },
    play: () => (started ? eng.play() : start()),
    onTime: (cb) => timeCbs.push(cb),
    onEnded: (cb) => eng.onEnded(cb),
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
    <div class="tab" data-pane="details"><div class="meta"><span id="viewCount">${fmtViews(v.views)}</span> · ${esc(v.category)}${v.duration ? ` · ${esc(v.duration)}` : ''}<br>${esc(v.description)}</div>${extraHtml(v)}</div>
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

  const recs = recommend(v, videos);
  renderSide(document.getElementById('related'), recs.slice(0, 5));
  const rest = recs.slice(5);
  document.getElementById('moreWrap').hidden = !rest.length;
  if (rest.length) renderGrid(document.getElementById('more'), rest);

  // View count (server ek visitor ko 6 ghante mein ek dafa ginta hai)
  fetch(`/api/view?id=${encodeURIComponent(v.id)}`, { method: 'POST' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && typeof d.views === 'number') box.querySelector('#viewCount').textContent = fmtViews(d.views); })
    .catch(() => {});

  const player = createPlayer(box.querySelector('#mount'), v);
  initPlayerControls(box, player);

  // Video khatam -> agli video (agar Autoplay on hai aur Loop band hai)
  const auto = document.getElementById('autoNext');
  try { auto.checked = localStorage.getItem('autoNext') !== '0'; } catch {}
  auto.addEventListener('change', () => { try { localStorage.setItem('autoNext', auto.checked ? '1' : '0'); } catch {} });
  player.onEnded(() => {
    if (!auto.checked || box.querySelector('#loopBtn').classList.contains('on') || !recs[0]) return;
    location.href = `/watch.html?id=${encodeURIComponent(recs[0].id)}&autoplay=1`;
  });
  if (new URLSearchParams(location.search).get('autoplay') === '1') player.play();
}

/* ---------- Extra fields (fields.js) ---------- */
function extraHtml(v) {
  const rows = (window.EXTRA_FIELDS || []).filter((f) => f.public && String(v[f.key] || '').trim());
  if (!rows.length) return '';
  return `<dl class="extra">${rows.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(v[f.key])}</dd>`).join('')}</dl>`;
}

/* ---------- Recommendations (side list) ----------
   Pehle same category, phir zyada views, phir nayi. Current video nahi. */
function recommend(current, all) {
  const score = (x) => (x.category === current.category ? 1e12 : 0) + (Number(x.views) || 0) * 1e3 + (x.createdAt || 0) / 1e10;
  return all.filter((x) => x.id !== current.id).sort((a, b) => score(b) - score(a)).slice(0, 48);
}

function sideItem(v) {
  return `<a class="ritem" href="/watch.html?id=${encodeURIComponent(v.id)}">
    <div class="rthumb">
      <img loading="lazy" src="${esc(thumbOf(v))}" alt="" onerror="thumbErr(this)">
      ${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ''}
    </div>
    <div class="rinfo">
      <h3>${esc(v.title)}</h3>
      <p>${esc(v.category)}</p>
      <p>${fmtViews(v.views)}</p>
    </div></a>`;
}

function renderSide(el, list) {
  el.innerHTML = list.length ? list.map(sideItem).join('') : '<div class="empty">Aur videos nahi</div>';
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
