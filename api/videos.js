import {
  listVideos, getVideo, saveVideo, deleteVideo, isAdmin, cleanInput, sendError,
} from './_store.js';

// GET    /api/videos            -> sab videos (public)
// GET    /api/videos?id=x       -> ek video (public)
// POST   /api/videos            -> nayi video (admin)
// PUT    /api/videos?id=x       -> edit (admin)
// DELETE /api/videos?id=x       -> remove (admin)
export default async function handler(req, res) {
  try {
    const id = req.query.id;

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      if (id) {
        const v = await getVideo(id);
        return v ? res.json(v) : res.status(404).json({ error: 'Video nahi mili' });
      }
      return res.json(await listVideos());
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'POST') {
      const v = cleanInput(req.body || {});
      return res.status(201).json(await saveVideo(v));
    }

    if (req.method === 'PUT') {
      const existing = id && (await getVideo(id));
      if (!existing) return res.status(404).json({ error: 'Video nahi mili' });
      return res.json(await saveVideo(cleanInput(req.body || {}, existing)));
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id chahiye' });
      const ok = await deleteVideo(id);
      return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Video nahi mili' });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
