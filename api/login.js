import { isAdmin, getRedis } from './_store.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(501).json({ error: 'ADMIN_PASSWORD env variable set nahi hai' });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: 'Galat password' });
  return res.json({
    ok: true,
    database: Boolean(getRedis()),
    uploads: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}
