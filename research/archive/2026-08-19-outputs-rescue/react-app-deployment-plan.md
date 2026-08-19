# Catch'em React App — Deployment Pre-Flight & Plan

**Date prepared:** April 20, 2026 (late-night prep session)
**For execution:** Tomorrow morning, fresh eyes
**Target state:** Live React app at `app.catchemtcg.com` (or alternate subdomain), demo mode, browser-persisted state

---

## 1. Pre-flight check — `catchem.jsx` deployment readiness

Scanned the 4,012-line app file. **Extremely clean deployment profile.** Notes:

### ✅ What's already good
- **Single import:** just React hooks. No Recharts, Lucide, Tailwind, shadcn, chart libs, or anything exotic
- **Styling is all inline** (`style={{...}}`) — zero external CSS, no Tailwind
- **Zero `localStorage`/`sessionStorage`** direct calls
- **Single default export:** `export default function CatchEm()`
- **No build-time env vars** required
- **Graceful fallback** when `window.storage` doesn't exist (app runs fine without persistence)
- **External data only from whitelist:**
  - `cdn.jsdelivr.net` (for sealed-prices.json from `Tbaker-maker/catchem-data`)
  - `api.pokemontcg.io` (card image data)
  - `api.frankfurter.app` (currency exchange rates)
  - `images.pokemontcg.io` (card images)
  All of these are CORS-friendly public APIs. No API keys embedded in client code.

### ⚠️ Blockers to fix BEFORE deployment

**Blocker 1 — Line 293: Placeholder GitHub username**
```js
const CATCHEM_DATA_GH_USER = "YOUR_GITHUB_USERNAME";
```
Must change to `Tbaker-maker` so sealed prices load from the correct jsDelivr CDN path. (This file in `/outputs` appears to be an older copy — our conversation history shows the actual deployed version already had this set correctly, so verify which version you pull from.)

**Blocker 2 — `window.storage` API won't work on real hosting**
App uses `window.storage` (Claude artifact API) for persistence. Falls back to in-memory gracefully, BUT for real demo mode we want browser persistence. **Fix:** add a tiny shim at the top of the file that maps `window.storage` calls to `localStorage`. Simple wrapper — 10 lines.

Shim to add:
```js
// Browser localStorage shim for window.storage API
// In Claude artifacts, window.storage is provided. Outside, shim it to localStorage.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    set: async (key, value) => { localStorage.setItem(key, value); return true; },
    delete: async (key) => { localStorage.removeItem(key); return true; },
    list: async (prefix) => {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
      return { keys };
    },
  };
}
```
Place this BEFORE the React component code. Works in both environments.

### 📝 Minor notes (not blockers)

- Line 497: `NEXT_ROTATION_DATE = new Date("2027-04-10T00:00:00Z")` — we later corrected to `2027-04-09` based on research. Low priority, one day off.
- Rotation date is hardcoded — for a polished version, could be pulled from the `rotation-dates.json` database we built tonight. Not needed for launch.

---

## 2. Deployment architecture decision

### Subdomain recommendation: `app.catchemtcg.com`

Why:
- **Clean separation:** marketing site at `catchemtcg.com`, app at `app.catchemtcg.com`
- **No routing conflicts:** the marketing site is served by a Cloudflare Worker, the app will be a separate Pages project
- **Easy to link between them:** "Launch app →" button on marketing page, "Learn more" link back
- **SEO-friendly:** marketing page stays indexable, app can be `noindex` if desired
- **Industry standard:** Linear, Notion, Figma, etc. all use `app.domain.com`

Alternatives considered and rejected:
- `catchemtcg.com/app` — would require complex Worker routing rules on the marketing site
- `demo.catchemtcg.com` — signals "not real" when we want it to feel like THE product
- `catchemtcg.com` with marketing elsewhere — loses the launch story ("we have a marketing site" is valuable proof-of-legitimacy for waitlist signups)

---

## 3. Tooling decision: Vite

**Why Vite over alternatives:**
- **Simplest possible setup** — one `vite.config.js`, one `index.html`, one `main.jsx`. Ships in 5 files total.
- **Fast builds** — 10-20s typical for an app this size
- **Native JSX support** — no Babel config needed
- **Zero config for most defaults** — pairs well with "we just want it to work"
- **Cloudflare Pages has first-class Vite support** — auto-detected build command, zero setup on Cloudflare side

Rejected: Next.js (overkill, SSR we don't need), Create React App (deprecated), Remix/Astro (scope creep).

---

## 4. Files we'll create tomorrow

All in a NEW repo called `catchem-app` on GitHub under `Tbaker-maker/`.

### Repo structure
```
catchem-app/
├── .github/
│   └── workflows/
│       └── deploy.yml            (optional — Cloudflare auto-deploys on push)
├── public/
│   └── favicon.ico               (can copy from landing site)
├── src/
│   ├── main.jsx                  (Vite entry point — renders CatchEm into #root)
│   ├── CatchEm.jsx               (the 4,012-line app, renamed from catchem.jsx)
│   └── storage-shim.js           (localStorage wrapper for window.storage)
├── index.html                    (Vite root HTML with <div id="root">)
├── package.json                  (Vite + React deps)
├── vite.config.js                (minimal config)
├── .gitignore                    (node_modules, dist)
└── README.md                     (deployment notes)
```

### File 1: `package.json`
```json
{
  "name": "catchem-app",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.10"
  }
}
```

### File 2: `vite.config.js`
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
  },
});
```

### File 3: `index.html` (at repo root)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0b0d12" />
    <title>Catch'em — Pokémon TCG Market Intelligence</title>
    <meta name="description" content="Track your collection. Read the market. Catch the signals." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### File 4: `src/main.jsx`
```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./storage-shim.js";
import CatchEm from "./CatchEm.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CatchEm />
  </React.StrictMode>
);
```

### File 5: `src/storage-shim.js`
```js
// Browser localStorage shim for window.storage API.
// In Claude artifacts, window.storage is provided. Outside, shim it to localStorage.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get: async (key) => {
      const val = localStorage.getItem(key);
      return val ? { value: val } : null;
    },
    set: async (key, value) => { localStorage.setItem(key, value); return true; },
    delete: async (key) => { localStorage.removeItem(key); return true; },
    list: async (prefix) => {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
      return { keys };
    },
  };
}
```

### File 6: `src/CatchEm.jsx`
- Copy `catchem.jsx` exactly
- Rename `.jsx` if needed
- **Fix Blocker 1:** change `CATCHEM_DATA_GH_USER` to `"Tbaker-maker"`
- Everything else stays identical

### File 7: `.gitignore`
```
node_modules
dist
.DS_Store
.env
.env.local
```

---

## 5. Deployment steps (tomorrow)

**Estimated time: 45-60 min if smooth, 90 min if we hit one snag**

### Phase 1: Local setup (15 min)
1. On your PC, create new folder `catchem-app`
2. Create the 7 files above with the content shown
3. Run `npm install` (downloads React + Vite)
4. Run `npm run dev` — opens localhost:5173 — **this is the critical checkpoint**
5. Verify the app works locally before going any further

### Phase 2: GitHub repo (10 min)
1. Create new repo on GitHub: `Tbaker-maker/catchem-app` (public)
2. Initialize git locally, commit everything
3. Push to GitHub main branch
4. Verify all 7 files (and whichever dirs) show up in GitHub

### Phase 3: Cloudflare Pages deployment (15 min)
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. Authorize GitHub if needed
3. Select `catchem-app` repo
4. Build config:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output: `dist`
   - Node version: **20** (set via env var `NODE_VERSION=20`)
5. Deploy — first build takes ~2-3 minutes
6. Verify preview URL works (something like `catchem-app.pages.dev`)

### Phase 4: Custom domain (10 min)
1. In Cloudflare Pages → `catchem-app` → Custom domains → Set up a custom domain
2. Enter: `app.catchemtcg.com`
3. Cloudflare auto-creates the CNAME record in the `catchemtcg.com` zone
4. Wait for SSL cert (~2-5 min)
5. Verify `https://app.catchemtcg.com` loads the app

### Phase 5: Link marketing site to app (5 min)
1. Back in `catchem-site` repo, edit the landing page
2. Update the "Start free" / "Launch app" CTAs to link to `https://app.catchemtcg.com`
3. Commit, Cloudflare rebuilds landing page
4. Test the full flow: catchemtcg.com → click "Launch app" → lands on app

---

## 6. Rollback plan (if something breaks)

- **App fails to build:** check Cloudflare build log for the specific error. Most likely a syntax issue from the JSX → Vite conversion. Fix in source, push again.
- **App deploys but looks broken:** open browser console. Most likely a missing dependency or a different path resolution issue. Vite dev mode locally will catch these.
- **Domain doesn't resolve:** check DNS records in Cloudflare zone. Should be an auto-created CNAME pointing to `catchem-app.pages.dev`.
- **Data doesn't load:** check `CATCHEM_DATA_GH_USER` is actually `"Tbaker-maker"`, and that `Catchem-data` repo is public. Visit the jsDelivr URL manually in a browser to verify data is reachable.

The marketing site at `catchemtcg.com` is completely independent — any issue with the app deployment does NOT affect the live marketing site.

---

## 7. Post-deploy wins to celebrate

When this works:
- ✅ catchemtcg.com → real product users can actually USE
- ✅ End-to-end flow: land on marketing → pick mode → launch app → use in demo mode
- ✅ First-mover data collection already running (catchem-data bot)
- ✅ Waitlist form collecting real emails (Formspree)
- ✅ Path is clear for auth/signup as the next phase when you're ready

That's a real launch. Not a prototype. Not a demo. A real Pokémon TCG market intelligence product, live on the internet, for collectors to use.

Celebrate it.
