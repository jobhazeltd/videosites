# StreamBox – Video Site + Admin Panel (Vercel)

- `/` – home (search, categories, thumbnail preview)
- `/watch.html?id=...` – video player
- `/admin.html` – admin panel (add / edit / delete, thumbnail upload, video se frame)

## Thumbnail preview
- **Mobile:** pehla tap = muted preview, doosra tap = video khulti hai
- **Desktop:** mouse le jayein to preview, click pe video

## Vercel setup (ek dafa)
1. Folder GitHub pe push karein → vercel.com → **Add New → Project** → repo import → Deploy.
2. Project → **Storage** tab:
   - **Upstash for Redis** (Marketplace) add karein → project se connect. (Videos yahan save hongi.)
   - **Blob** store banayein → project se connect. (Thumbnails yahan upload hongi.)
   Dono ke env variables Vercel khud daal deta hai.
3. Project → **Settings → Environment Variables** → `ADMIN_PASSWORD` = koi strong password.
4. **Deployments → Redeploy** (taake naye env variables lag jayein).
5. `https://your-site.vercel.app/admin.html` khol kar login karein.

Pehli dafa database khali ho to sample videos khud add ho jati hain; chahein to delete kar dein.

## Videos kahan rakhein
Vercel pe badi video files upload na karein. Video ko Cloudflare R2, Bunny.net, Backblaze B2 waghera pe rakhein aur direct `.mp4` link admin panel mein daalein.
"Video se frame lo" tabhi chalega jab video server CORS allow kare (R2/Bunny pe `Access-Control-Allow-Origin` set kar sakte hain). Warna screenshot le kar "Image upload" karein.

## Local chalana
```
npm i -g vercel
npm install
vercel link
vercel env pull .env.local
vercel dev
```

## Security notes
- Password sirf server pe check hota hai (`x-admin-password` header, timing-safe compare).
- Admin ke liye strong password rakhein; zarurat ho to baad mein rate-limit ya proper auth (NextAuth/Clerk) add karein.

## Note
Sirf woh content lagayein jis ka license aap ke paas hai, aur Vercel ki Acceptable Use Policy follow karein (adult content allowed nahi).
