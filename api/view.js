import { addView } from './_store.js';

// POST /api/view?id=...  -> { views }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(req.query.id || '').slice(0, 80);
  if (!id) return res.status(400).json({ error: 'id chahiye' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const views = await addView(id, ip);
    if (views === null) return res.status(404).json({ error: 'Video nahi mili' });
    return res.json({ views });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
