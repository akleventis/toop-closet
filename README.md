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
- Browse "fits" — AI-composed outfits — on the shared `/fits` page
- Browse "suitcases" — packed trip collections — and the fits made from each

**Managing (owner login required)**
- Add, edit, and delete items — name, tag, up to 4 photos, short note
- Reorder photos per item with left/right arrows in the edit form
- Auto background removal per photo — runs async after save, raw image shows immediately
- Custom tags: create, rename (batch), delete
- Multiple closets: create, rename, delete
- Transfer items between your own closets
- Build "fits": pick items across closets and generate an image of them worn together on a base subject (you or a mannequin) — regenerate, rename, or edit anytime
- Pack a "suitcase" for a trip and generate fits from only the items you packed

---

### Stack

| Layer | Tech | Role |
|---|---|---|
| **Frontend** | React 19 + Vite + Tailwind v4 | UI, hosted on Netlify |
| **Backend** | Netlify Functions (Node.js) | serverless API + background jobs |
| **Storage** | AWS S3 | item inventory + images |
| **Auth** | Netlify Identity | invite-only JWT auth |
| **Bg removal** | [withoutbg](https://github.com/withoutbg/withoutbg) on a Synology NAS | self-hosted AI cutouts, exposed via Tailscale Funnel |
| **Fit generation** | OpenAI `gpt-4o` image generation | composes "fits" onto a base subject |

---

### How it works

Each closet has a unique slug (e.g. `toop`) that doubles as its URL path (`/toop`) and its S3 key prefix. The root redirects to my personal closet. Anyone can browse; owners log in to manage items and categories. Accounts are invite-only — I can create one for someone and they get their own separate closets.

**S3 layout:**

```
toop-closet/                        ← the bucket
│
├── inventory/
│   └── {slug}.json                 ·  item list for one closet
│
├── users/
│   └── {slug}/config.json          ·  owner email · categories · display name
│
├── _users/
│   └── {netlify-sub}.json          ·  closets owned by one user (login nav index)
│
├── fits/
│   ├── items/{id}.json             ·  one object per fit  ─┐ no shared index,
│   └── _jobs/{jobId}.json          ·  transient jobs       ┘ so concurrent
│                                                             writes can't race
├── suitcases/
│   └── items/{id}.json             ·  one packed trip (item snapshots)
│
└── clothing/
    ├── {slug}/{uuid}               ·  item photos          (public read)
    └── fits-{id}.webp              ·  composed fit images  (public read)
```

> Each fit is its own object under `fits/items/` rather than rows in one big
> `index.json` — generating or editing fits only ever touches independent keys,
> so two creates can't clobber each other. Job files under `fits/_jobs/` are
> deleted as soon as the browser reads a terminal result.

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
{ "closets": [{ "slug": "toop", "name": "Denver" }, { "slug": "central-coast" }] }
```
`sub` is the Netlify Identity UUID from the JWT. Written on closet create/rename/delete; read on login to populate the owner nav.

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

Each item has a permanent UUID. Clicking "Copy link" on any card writes `/{slug}?item={first-8-chars-of-uuid}` to the clipboard. On load, the app finds the matching item by ID prefix, opens its lightbox, and strips the param from the URL. No new data is stored — the ID has existed since the item was created. Fits share the same way via `/fits?fit={first-8-chars}`.

---

### AI fits

Pick items across your closets, add an optional styling note, and the app renders them **worn together on a base subject** — a photo of you or a mannequin (`public/base-subject.webp`). OpenAI's `gpt-4o` image generation is fed the base subject plus each item's image and composes a single outfit. The result is then run through the same background-removal pipeline as item photos for a clean, consistent look, and stored at a fixed `clothing/fits-{id}.webp`.

Generation easily outruns a normal function's 26s timeout, so it runs in a Netlify **background function** (15-min limit) and the whole flow is **fire-and-forget**: the UI drops a loading card the moment you hit *Generate* and swaps in the finished image whenever it lands — navigate away and back, it's still working.

```
┌─ browser ────────────────────────────────────────────────────────────┐
│  pick items  +  styling note   →   Generate (fire-and-forget)        │
└──────────────────────────────────────────────────────────────────────┘
   │ POST + jobId                                           ▲
   ▼ 202 instant                                            │ poll /fit-status (2s)
┌─ create-fit-background ──────────────────────────────────────────────┐
│                          Netlify background fn · 15-min limit        │
│                                                                      │
│   base-subject.webp ─┐                                               │
│                      ├─▶  OpenAI gpt-4o image_generation             │
│   item image URLs ───┘                                               │
│                                        │                             │
│                                        ▼                             │
│                         withoutbg on NAS  (bg removed)               │
│                                        │  falls back to raw if down  │
│                                        ▼                             │
│                             fits/_jobs/{jobId}.json                  │
└──────────────────────────────────────────────────────────────────────┘
   │ on success
   ▼
   clothing/fits-{id}.webp   +   fits/items/{id}.json
```

Regenerating overwrites the same `fits-{id}.webp` key, so the image URL carries a `?v=` cache-bust to dodge stale browser caches. The `withoutbg` step below is the same pipeline used for individual item photos.

---

### Suitcases

Packing for a trip? Make a **suitcase** — a named pile of clothes you "pack" from any closet — then generate fits using *only what's in the bag*. Each suitcase gets its own page listing its packed items and the fits made from them; the fit builder opened from there is restricted to the packed set, so you're styling from what you actually brought.

A suitcase is structurally a fit minus the generated image — packed items are the same `{ itemId, slug, name, imageUrl }` snapshots, stored one-object-per-suitcase under `suitcases/items/` (no shared index, same race-free pattern as fits). Fits generated from a suitcase carry its `suitcaseId`, so they show up both on the suitcase's page and in the global `/fits` list. The generation flow is identical to regular fits — just scoped to the packed items.

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

https://github.com/user-attachments/assets/e52cdc9c-ac42-45f1-858b-7072b894cf0a

### Local dev

```bash
npx netlify dev   # http://localhost:8888
```

Netlify Identity is bypassed in local dev — set `DEV_USER_EMAIL` in `.env.local` and the backend returns a fake authenticated user automatically. See `docs/CONFIG.md` for full setup.

---

### Credits

- **[withoutbg](https://github.com/withoutbg/withoutbg)** — open-source background removal, single Docker container, no cloud account needed
- **[Tailscale](https://tailscale.com)** — punched the NAS through to the public internet in two commands
