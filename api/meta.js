import { isAdmin, ytId, ytThumb } from './_store.js';

// GET /api/meta?url=...  -> { title, thumbnail, duration, type }
// Sirf YouTube / Vimeo ke official oEmbed endpoints ko call karta hai (koi open proxy nahi).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  const url = String(req.query.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL sahi nahi' });

  try {
    const yt = ytId(url);
    if (yt) {
      const watch = `https://www.youtube.com/watch?v=${yt}`;
      const data = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`);
      return res.json({
        type: 'youtube',
        title: data?.title || '',
        author: data?.author_name || '',
        thumbnail: ytThumb(yt),
        duration: '',
      });
    }

    if (/^https?:\/\/(www\.|player\.)?vimeo\.com\//i.test(url)) {
      const data = await getJson(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      return res.json({
        type: 'vimeo',
        title: data?.title || '',
        author: data?.author_name || '',
        thumbnail: data?.thumbnail_url || '',
        duration: data?.duration ? fmt(data.duration) : '',
      });
    }

    // Direct file: naam file name se
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
      .replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_.]+/g, ' ').trim();
    return res.json({ type: 'file', title: name, thumbnail: '', duration: '' });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Details fetch nahi ho sakin (video private ya ghalat link?)' });
  }
}

async function getJson(u) {
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`oEmbed ${r.status}`);
  return r.json();
}

function fmt(s) {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
