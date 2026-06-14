## toop-closet

Spring cleaning resulted in a large pile of clothes I don't wear enough, but don't quite want to rid of. I'll be sending them to my parents house for ease of future travels. Built this to keep track of all my clothes — a shareable virtual closet inventory anyone can browse, with owner-only add/edit/delete behind a login.

https://closet.tooper.io 

[![Netlify Status](https://api.netlify.com/api/v1/badges/75d60925-1f7e-4bae-86f7-041d961a5455/deploy-status)](https://app.netlify.com/projects/toop-closet/deploys)

https://github.com/user-attachments/assets/3a6b0e31-c757-4b60-a301-f755a87ffec1

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

Each closet has a unique slug (e.g. `toop`) that doubles as its URL path (`/toop`) and its S3 key prefix. The root redirects to my personal closet. Anyone can browse; owners log in to manage items and categories. Accounts are invite-only — I can create one for someone and they get their own separate closets.

**S3 layout:**

```
toop-closet/
  inventory/{slug}.json          item list for each closet
  users/{slug}/config.json       closet config — owner, categories, display name
  _users/{netlify-sub}.json      index of closets owned by each user
  clothing/{slug}/{uuid}         item images (public read)
```

**Data shapes:**

`inventory/{slug}.json` — array of items:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "White tee",
    "category": "Tops",
    "imageUrl": "https://s3…/clothing/toop/abc123",
    "imageUrls": ["https://s3…/clothing/toop/abc123", "https://s3…/clothing/toop/def456"],
    "notes": "Cotton, size M"
  }
]
```
`imageUrl` always mirrors `imageUrls[0]` for backwards compat — old single-image items may only have `imageUrl`. Always read via `getImages(item)`.

`users/{slug}/config.json` — closet metadata:
```json
{
  "slug": "toop",
  "ownerEmail": "owner@example.com",
  "categories": ["Tops", "Bottoms", "Shoes"],
  "name": "Denver"
}
```
`slug` is permanent (URL + S3 key). `name` is the editable display label.

`_users/{netlify-sub}.json` — per-user closet index:
```json
{ "slugs": ["toop", "central-coast"] }
```
`sub` is the Netlify Identity UUID from the JWT. Written on closet create/delete; read on login to populate the owner nav. Lazy-migrated on first login if missing.

**Auth:**

Netlify Identity issues a JWT on login. Every write endpoint reads `ownerEmail` from the closet's config and checks it against `user.email` from the decoded JWT — no separate ACL table. In local dev, `requireAuth` returns a fake user from `DEV_USER_EMAIL` in `.env.local` so the full CRUD flow works without a real login.

**Read vs. write lifecycle:**

```
GET  /toop          →  fetch inventory/{slug}.json (public, direct S3 read via function)
POST /clothes       →  auth check → append to inventory array → write back to S3
PUT  /upload-url    →  auth + ownership check → return presigned PUT URL (300s TTL)
                         browser uploads directly to S3 — image never passes through a function
DELETE /clothes     →  auth + ownership check → filter item from array → write back to S3
```

**Share links:**

Each item has a permanent UUID. Clicking "Copy link" on any card writes `/{slug}?item={first-8-chars-of-uuid}` to the clipboard. On load, the app finds the matching item by ID prefix, opens its lightbox, and strips the param from the URL. No new data is stored — the ID has existed since the item was created.

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
