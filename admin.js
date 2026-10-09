const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let password = sessionStorage.getItem('adminPw') || '';
let videos = [];
let editingId = null;
let caps = { database: false, uploads: false };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error('Session khatam, dobara login karein'); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/* ---------- Login ---------- */
async function tryLogin(pw) {
  password = pw;
  const res = await fetch('/api/login', { method: 'POST', headers: { 'x-admin-password': pw } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { password = ''; throw new Error(data.error || 'Login fail'); }
  sessionStorage.setItem('adminPw', pw);
  caps = data;
  showApp();
}

function logout() {
  password = '';
  sessionStorage.removeItem('adminPw');
  $('#app').hidden = true;
  $('#logout').hidden = true;
  $('#login').hidden = false;
}

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  try { await tryLogin($('#pw').value); } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#logout').addEventListener('click', logout);

async function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#logout').hidden = false;
  const warns = [];
  if (!caps.database) warns.push('Database (Upstash Redis) connect nahi hai — abhi sirf sample videos dikh rahi hain, add/edit/delete kaam nahi karega.');
  if (!caps.uploads) warns.push('Vercel Blob connect nahi hai — thumbnail upload/frame grab nahi chalega, sirf URL paste kar sakte hain.');
  $('#warn').hidden = !warns.length;
  $('#warn').innerHTML = warns.map(esc).join('<br>');
  await refresh();
}

/* ---------- List ---------- */
async function refresh() {
  videos = await api('/api/videos');
  renderList();
}

function renderList() {
  const q = $('#filter').value.toLowerCase();
  const list = videos.filter((v) => (v.title + ' ' + v.category).toLowerCase().includes(q));
  $('#count').textContent = videos.length;
  $('#list').innerHTML = list.length ? list.map((v) => `
    <div class="item">
      <img src="${esc(v.thumbnail)}" alt="" loading="lazy">
      <div class="info"><h3>${esc(v.title)}</h3><p>${esc(v.category)} · ${esc(v.duration || '—')}</p></div>
      <div class="btns">
        <a class="btn ghost" href="/watch.html?id=${encodeURIComponent(v.id)}" target="_blank">View</a>
        <button class="btn ghost" data-edit="${esc(v.id)}">Edit</button>
        <button class="btn danger" data-del="${esc(v.id)}">Delete</button>
      </div>
    </div>`).join('') : '<div class="empty">Koi video nahi</div>';
  $('#catList').innerHTML = [...new Set(videos.map((v) => v.category))].map((c) => `<option value="${esc(c)}">`).join('');
}

$('#filter').addEventListener('input', renderList);

$('#list').addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;
  if (editId) openEditor(videos.find((v) => v.id === editId));
  if (delId) {
    const v = videos.find((x) => x.id === delId);
    if (!confirm(`"${v.title}" delete kar dein?`)) return;
    e.target.disabled = true;
    try { await api(`/api/videos?id=${encodeURIComponent(delId)}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { alert(err.message); e.target.disabled = false; }
  }
});

/* ---------- Editor ---------- */
const form = $('#form');
const dlg = $('#editor');

function openEditor(v) {
  editingId = v ? v.id : null;
  form.reset();
  $('#formTitle').textContent = v ? 'Video Edit' : 'Nayi Video';
  $('#formErr').textContent = '';
  $('#thumbMsg').textContent = '';
  if (v) for (const k of ['title', 'category', 'duration', 'src', 'thumbnail', 'description']) form.elements[k].value = v[k] || '';
  $('#dlRows').innerHTML = '';
  (v?.downloads || []).forEach(addDlRow);
  updateThumbPreview();
  updateSrcPreview();
  dlg.showModal();
}

$('#addBtn').addEventListener('click', () => openEditor(null));
$('#cancel').addEventListener('click', () => dlg.close());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#formErr').textContent = '';
  const fd = new FormData(form);
  const body = {};
  for (const k of ['title', 'category', 'duration', 'src', 'thumbnail', 'description']) body[k] = fd.get(k) || '';
  body.downloads = [...$('#dlRows').children].map((row) => ({
    label: row.querySelector('[data-f=label]').value,
    quality: row.querySelector('[data-f=quality]').value,
    size: row.querySelector('[data-f=size]').value,
    url: row.querySelector('[data-f=url]').value.trim(),
  })).filter((d) => d.url);
  const btn = $('#save');
  btn.disabled = true;
  try {
    if (editingId) await api(`/api/videos?id=${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/videos', { method: 'POST', body: JSON.stringify(body) });
    dlg.close();
    await refresh();
  } catch (err) {
    $('#formErr').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

/* Download rows */
function addDlRow(d = {}) {
  const row = document.createElement('div');
  row.className = 'dlrow';
  row.innerHTML = `
    <input data-f="url" placeholder="magnet:?xt=... ya https://..." value="${esc(d.url)}">
    <div class="dlmeta">
      <input data-f="label" placeholder="Naam" value="${esc(d.label)}" maxlength="80">
      <input data-f="quality" placeholder="HD / 720p" value="${esc(d.quality)}" maxlength="12">
      <input data-f="size" placeholder="Size" value="${esc(d.size)}" maxlength="16">
      <button type="button" class="btn danger sm" title="Hatao">✕</button>
    </div>`;
  row.querySelector('button').addEventListener('click', () => row.remove());
  $('#dlRows').appendChild(row);
}
$('#addDl').addEventListener('click', () => addDlRow());

/* Thumbnail preview */
function updateThumbPreview() {
  const url = form.elements.thumbnail.value.trim();
  const img = $('#thumbPreview');
  img.hidden = !url;
  if (url) img.src = url;
}
form.elements.thumbnail.addEventListener('input', updateThumbPreview);

/* Video preview + auto duration */
const srcVid = $('#srcPreview');
function updateSrcPreview() {
  const url = form.elements.src.value.trim();
  srcVid.hidden = !/^https?:\/\//.test(url);
  if (srcVid.hidden) { srcVid.removeAttribute('src'); return; }
  if (srcVid.src !== url) srcVid.src = url;
}
form.elements.src.addEventListener('change', updateSrcPreview);
srcVid.addEventListener('loadedmetadata', () => {
  if (!form.elements.duration.value && isFinite(srcVid.duration)) {
    const s = Math.round(srcVid.duration);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
    form.elements.duration.value = h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }
});
srcVid.addEventListener('error', () => { $('#thumbMsg').textContent = 'Video URL load nahi hua — link check karein.'; });

/* Image -> 640px JPEG -> upload */
function toJpeg(source, w, h) {
  const scale = Math.min(1, 640 / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8); // CORS na ho to yahan error aata hai
}

async function uploadDataUrl(dataUrl) {
  $('#thumbMsg').textContent = 'Upload ho raha hai...';
  const { url } = await api('/api/upload', { method: 'POST', body: JSON.stringify({ dataUrl }) });
  form.elements.thumbnail.value = url;
  updateThumbPreview();
  $('#thumbMsg').textContent = 'Thumbnail upload ho gaya ✓';
}

$('#thumbFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const img = await createImageBitmap(file);
    await uploadDataUrl(toJpeg(img, img.width, img.height));
  } catch (err) { $('#thumbMsg').textContent = err.message || 'Image read nahi hui'; }
});

$('#grabFrame').addEventListener('click', async () => {
  if (srcVid.hidden || !srcVid.videoWidth) {
    $('#thumbMsg').textContent = 'Pehle video URL daalein aur player mein us jagah le jayein jahan ka frame chahiye.';
    return;
  }
  srcVid.pause();
  let dataUrl;
  try { dataUrl = toJpeg(srcVid, srcVid.videoWidth, srcVid.videoHeight); }
  catch { $('#thumbMsg').textContent = 'Is video ka server frame lene nahi deta (CORS). Screenshot le kar "Image upload" karein.'; return; }
  try { await uploadDataUrl(dataUrl); } catch (err) { $('#thumbMsg').textContent = err.message; }
});

/* Auto-login agar session mein password hai */
if (password) tryLogin(password).catch(logout);
