## toop-closet

Spring cleaning resulted in a large pile of clothes I don't wear enough, but don't quite want to rid of. I'll be sending them to my parents house for ease of future travels. Built this to keep track of all my clothes — a shareable virtual closet inventory anyone can browse, with owner-only add/edit/delete behind a login.

https://github.com/user-attachments/assets/800ec3e8-679f-44b8-9caf-6ffe2413268f

---

### Features

**Browsing (public, no login)**
- Browse any closet via its unique URL
- Filter items by tag
- Click any photo to open a full-screen lightbox — keyboard ←/→/Escape, swipe on mobile
- Up to 4 photos per item, swipeable in both card and lightbox views
- Notes visible in lightbox

**Managing (owner login required)**
- Add, edit, and delete items — name, tag, up to 4 photos, short note
- Reorder photos per item with left/right arrows in the edit form
- Auto background removal per photo — runs async after save, raw image shows immediately
- Custom tags: create, rename (batch), delete
- Multiple closets: create, rename, delete
- Transfer items between your own closets

---

### Stack

- **React 19 + Vite** — frontend, hosted on Netlify
- **Netlify Functions** — serverless backend (Node.js)
- **AWS S3** — item inventory + images
- **Netlify Identity** — invite-only auth
- **withoutbg on Synology NAS** — self-hosted AI background removal, exposed via Tailscale Funnel

---

### How it works

Each closet has a unique URL. The root redirects to my personal closet. Anyone can browse; owners log in to manage items and categories. Accounts are invite-only — I can create one for someone and they get their own separate closets.

**S3 layout:**

```
toop-closet/
  inventory/{slug}.json          item list for each closet
  users/{slug}/config.json       closet config — owner, categories, display name
  _users/{netlify-sub}.json      index of closets owned by each user
  clothing/{slug}/{uuid}         item images (public read)
```

Images never pass through a function — the browser gets a **presigned PUT URL** and uploads directly to S3. Ownership is verified server-side on every write by checking `ownerEmail` in the closet config against the JWT.

---

### Background removal

Wanted a consistent look without manually editing each photo. Self-hosted **[withoutbg](https://github.com/withoutbg/withoutbg)** in Docker on a Synology DS1522+ NAS.

```
browser
  └─▶ netlify function (/withoutbg)
        └─▶ tailscale funnel
              └─▶ nginx proxy (secret header check)
                    └─▶ withoutbg container  ←── AI runs here, on my NAS
                          └─▶ WebP with transparent background
```

The NAS is reachable at a stable HTTPS hostname via **[Tailscale Funnel](https://tailscale.com/kb/1223/funnel)** — no port forwarding, no static IP. An nginx proxy in front validates a shared secret before anything reaches the model.

Images are resized client-side to ≤1500px / JPEG 0.85 before upload — Netlify has a 6MB function body limit and an iPhone HEIC will breach it.

When bg removal is toggled on, the item saves immediately with the raw image and the removal runs async. If it fails, the raw image stays and a toast is shown.

<p align="center"><img src="assets/nas.jpeg" width="450" /></p>

---

### Local dev

```bash
npx netlify dev   # http://localhost:8888
```

Netlify Identity is bypassed in local dev — set `DEV_USER_EMAIL` in `.env.local` and the backend returns a fake authenticated user automatically. See `docs/CONFIG.md` for full setup.

---

### Credits

- **[withoutbg](https://github.com/withoutbg/withoutbg)** — open-source background removal, single Docker container, no cloud account needed
- **[Tailscale](https://tailscale.com)** — punched the NAS through to the public internet in two commands
