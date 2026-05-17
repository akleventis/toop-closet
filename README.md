## Toop's closet

Spring cleaning resulted in a large pile of clothes I don't wear often enough. Sending them off to my parents house for ease of future travel — built this to keep track of what's there via a virtual closet inventory.

### Stack ~
- React frontend on netlify
- Serverless functions for the backend
- AWS s3 for images + inventory data
- Netlify identity for auth (just me, and maybe one other person)
- AI background remover running on my at-home synology NAS, reachable via tailscale funnel

https://github.com/user-attachments/assets/800ec3e8-679f-44b8-9caf-6ffe2413268f

---

### Background removal pipeline

Wanted clothes to look somewhat uniformed in-app, but didn't want to manually remove the background on each upload. Stumbled across **[withoutbg](https://github.com/withoutbg/withoutbg)** — an open-source ai background removal tool I was able to self-host via docker. Running it on a Synology DS1522+ NAS.

```
browser
  └─▶ netlify function (/withoutbg)
        └─▶ tailscale funnel
              └─▶ nginx proxy (secret header check)
                    └─▶ withoutbg container  ←── AI runs here, on my NAS
                          └─▶ WebP with transparent background
```


<p align="center"><img src="assets/nas.jpeg" width="450" /></p>

### NAS Exposure

withoutbg container listens on `localhost:8088` (NAS-local only). in front of it sits an **nginx proxy on port 8089** that validates a shared secret header — so random internet traffic gets a 401 before it ever touches the model.

exposing that port to the internet uses **[tailscale funnel](https://tailscale.com/kb/1223/funnel)**:

```bash
sudo tailscale serve --bg 8089
sudo tailscale funnel --bg 8089
```

the NAS is now reachable at `https://my-nas.tail******.ts.net` with TLS cert, no port forwarding, no static IP needed. the netlify function knows the URL and the secret — everything else is just HTTPS.

> images get client-side resized to ≤1500px / JPEG 0.85 before hitting the function. netlify has a 6MB body limit and a 7MB iPhone HEIC will breach it.

---

### Auth — Netlify Identity

Single-owner auth via **netlify identity** with JWT. If you're logged in, you can edit any closet. Valid slugs are defined in a `CLOSETS` env var:

```
CLOSETS=denver,central-coast
```

Netlify functions read `context.clientContext.user` — no database needed.

### Storage — AWS s3

| path | what |
|---|---|
| `inventory/{slug}.json` | the full item list for a closet, as JSON |
| `clothing/{slug}/{uuid}` | the uploaded image |

images never pass through the netlify function. the client gets a **presigned PUT URL** (5 min TTL, content-type whitelisted to image MIME types) and uploads directly to S3. the function only generates the URL.

### Backend — Netlify Functions

| function | does what |
|---|---|
| `clothes.ts` | `GET / POST / PUT / DELETE` for the item list |
| `upload-url.ts` | issues a presigned S3 URL for image upload |
| `withoutbg.ts` | proxies binary image data to the NAS, returns WebP |
| `whoami.ts` | returns the slug for the logged-in user |

every write is auth-gated and scoped to the requesting user's slug before anything touches S3.

### Frontend — React 19 + Tailwind v4

```
src/
  App.tsx            ← root state, all business logic
  api.ts             ← single seam for all backend calls
  components/
    ClothingCard.tsx  ← card + lightbox on click
    ItemModal.tsx     ← add/edit form, image preview, remove-bg button
    CategoryFilter.tsx ← filter pills + add button
    Header.tsx
```

---

## Local Development

The full stack — React, Netlify Functions, AWS S3, and Netlify Identity — runs locally via `netlify dev`. No pushing to prod to test.

### Prerequisites

- Node.js 18+
- A Netlify site deployed with these env vars set in the dashboard: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET_NAME`, `USERS_JSON`, `WITHOUTBG_URL`, `WITHOUTBG_SECRET`
- AWS S3 CORS updated to allow `http://localhost:8888` (one-time, see below)

### 1. S3 CORS — allow localhost

The browser uploads images directly to S3 via presigned PUT URLs. The bucket's CORS policy must include `http://localhost:8888` or the PUT will be blocked.

In **AWS Console → S3 → your bucket → Permissions → Cross-origin resource sharing (CORS)**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": [
      "https://your-site.netlify.app",
      "http://localhost:8888"
    ],
    "ExposeHeaders": []
  }
]
```

This is the only AWS change needed for local dev.

### 2. Install and link (one-time)

```bash
npm install

# Authenticate with Netlify
npx netlify login

# Link this directory to your deployed Netlify site.
# This allows netlify dev to pull env vars (AWS keys, USERS, WITHOUTBG_*) automatically.
npx netlify link
```

When prompted by `netlify link`, choose your site from the list. A `.netlify/state.json` file is created locally (gitignored).

### 3. Run

```bash
npx netlify dev
```

This starts:
- **Vite** on port 5173 (React frontend, HMR)
- **Netlify Functions** runtime serving `netlify/functions/`
- A unified proxy on **http://localhost:8888** that wires them together

Open **http://localhost:8888** — the app is fully functional including functions and auth.

### How env vars work

`netlify dev` pulls all env vars from the linked Netlify site via the API. No `.env` file required if the site is linked.

To override a variable locally (e.g. point background removal at a local instance), create `.env` in the project root (gitignored):

```
WITHOUTBG_URL=http://192.168.1.143:8088
WITHOUTBG_SECRET=your-secret
```

Local `.env` and `.env.local` values take precedence over the site's env vars.

### How auth works locally

Netlify Identity is a hosted service — there is no local mock. The Identity widget in the browser connects to your live Netlify Identity instance. `netlify dev` intercepts the JWT and injects `context.clientContext.user` into function calls, exactly as it does in production.

Log in using the same email and password you use on the live site. Auth works identically.

### Background removal

Background removal calls your NAS via `WITHOUTBG_URL`. For it to work during local dev, the NAS must be reachable (Tailscale must be connected). If the NAS is offline, bg removal fails silently — the item saves with the raw image and a toast is shown.

To develop against a local withoutbg instance instead:

```bash
# Run withoutbg locally via Docker
docker run -p 8088:8088 withoutbg/app:latest
```

Then set in `.env`:
```
WITHOUTBG_URL=http://localhost:8088
WITHOUTBG_SECRET=
```

### `npm run dev` vs `netlify dev`

| Command | What runs | Use when |
|---|---|---|
| `npm run dev` | Vite only (port 5173) | Pure frontend work, no function calls needed |
| `npx netlify dev` | Vite + Functions + Identity (port 8888) | Any feature that touches functions or auth |

---

## Credits

- **[withoutbg](https://github.com/withoutbg/withoutbg)** — open-source background removal you can actually self-host. runs as a single docker container, no cloud account required.
- **[tailscale](https://tailscale.com)** — used funnel to punch the NAS through to the public internet in two commands.
