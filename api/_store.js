import { Redis } from '@upstash/redis';
import crypto from 'node:crypto';
import seed from './_seed.js';

const KEY = 'videos';
const VIEWS = 'views';

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

// Pehli dafa database khali ho to sample videos daal deta hai
async function ensureSeed(redis) {
  const exists = await redis.exists(KEY);
  if (!exists) {
    const entries = {};
    for (const v of seed) entries[v.id] = JSON.stringify(v);
    await redis.hset(KEY, entries);
  }
}

const parse = (x) => (typeof x === 'string' ? JSON.parse(x) : x);

export async function listVideos() {
  const redis = getRedis();
  if (!redis) return [...seed];
  await ensureSeed(redis);
  const [all, views] = await Promise.all([redis.hgetall(KEY), redis.hgetall(VIEWS)]);
  return Object.values(all || {}).map(parse)
    .map((v) => ({ ...v, views: Number(views?.[v.id]) || 0 }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getVideo(id) {
  const redis = getRedis();
  if (!redis) return seed.find((v) => v.id === id) || null;
  const [v, views] = await Promise.all([redis.hget(KEY, id), redis.hget(VIEWS, id)]);
  return v ? { ...parse(v), views: Number(views) || 0 } : null;
}

// Ek IP se ek video ka view 6 ghante mein sirf ek dafa count hota hai
export async function addView(id, ip) {
  const redis = getRedis();
  if (!redis) return null;
  if (!(await redis.hexists(KEY, id))) return null;
  const who = crypto.createHash('sha256').update(`${ip}|${process.env.ADMIN_PASSWORD || 'salt'}`).digest('hex').slice(0, 16);
  const fresh = await redis.set(`seen:${id}:${who}`, 1, { nx: true, ex: 6 * 3600 });
  if (fresh) return redis.hincrby(VIEWS, id, 1);
  return Number(await redis.hget(VIEWS, id)) || 0;
}

export async function saveVideo(video) {
  const redis = mustRedis();
  await ensureSeed(redis);
  const { views, ...data } = video; // views alag hash mein rehte hain
  await redis.hset(KEY, { [video.id]: JSON.stringify(data) });
  return video;
}

export async function deleteVideo(id) {
  const redis = mustRedis();
  await ensureSeed(redis);
  const ok = (await redis.hdel(KEY, id)) > 0;
  if (ok) await redis.hdel(VIEWS, id);
  return ok;
}

function mustRedis() {
  const r = getRedis();
  if (!r) {
    const e = new Error('Database connect nahi hai. Vercel pe Upstash Redis add karein (README dekhein).');
    e.status = 501;
    throw e;
  }
  return r;
}

export function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const got = Buffer.from(String(req.headers['x-admin-password'] || ''));
  const want = Buffer.from(pw);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);

export function ytId(url) {
  const m = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i.exec(url || '');
  return m ? m[1] : null;
}
export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const isMagnet = (s) => /^magnet:\?\S*xt=urn:btih:[a-z0-9]{32,40}\S*$/i.test(s);
const str = (s, max) => String(s ?? '').trim().slice(0, max);

export function cleanInput(body, existing) {
  const v = {
    title: str(body.title, 150),
    category: str(body.category, 50) || 'General',
    duration: str(body.duration, 12),
    thumbnail: str(body.thumbnail, 1000),
    srcType: body.srcType === 'embed' ? 'embed' : 'file',
    src: str(body.src, 1000),
    description: str(body.description, 2000),
  };
  // Extra fields (fields.js wale) — extra1 ... extra6
  for (let i = 1; i <= 6; i++) v[`extra${i}`] = str(body[`extra${i}`], 1000);
  v.downloads = (Array.isArray(body.downloads) ? body.downloads : []).slice(0, 10).map((d) => ({
    label: str(d?.label, 80),
    quality: str(d?.quality, 12),
    size: str(d?.size, 16),
    url: str(d?.url, 3000),
  })).filter((d) => d.url);
  for (const d of v.downloads) {
    if (!isUrl(d.url) && !isMagnet(d.url)) throw badReq(`Download link sahi nahi: ${d.url.slice(0, 40)}`);
  }
  if (!v.title) throw badReq('Title zaroori hai');
  if (!isUrl(v.src)) throw badReq('Video / Embed URL http(s) link hona chahiye');
  if (v.srcType === 'embed' && !/^https:\/\//i.test(v.src)) throw badReq('Embed URL HTTPS hona chahiye');
  if (v.thumbnail && !isUrl(v.thumbnail)) throw badReq('Thumbnail URL http(s) link hona chahiye');
  const yt = ytId(v.src);
  if (yt && !v.thumbnail) v.thumbnail = ytThumb(yt);
  if (existing) return { ...existing, ...v, updatedAt: Date.now() };
  const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video';
  return { id: `${slug}-${crypto.randomBytes(3).toString('hex')}`, ...v, createdAt: Date.now() };
}

function badReq(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

export function sendError(res, err) {
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  if (!err.status) console.error(err);
}
