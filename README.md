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
