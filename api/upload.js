import { put } from '@vercel/blob';
import { isAdmin } from './_store.js';

// Admin panel thumbnail ko browser mein chhota (640px) kar ke base64 bhejta hai
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(501).json({ error: 'Vercel Blob connect nahi hai. Thumbnail ka URL paste karein ya Blob add karein.' });
  }

  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Sirf JPG, PNG ya WEBP image' });

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(413).json({ error: 'Image 2MB se badi hai' });

  try {
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const blob = await put(`thumbs/thumb.${ext}`, buf, {
      access: 'public',
      contentType: `image/${m[1]}`,
      addRandomSuffix: true,
    });
    return res.json({ url: blob.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Upload fail ho gaya' });
  }
}
