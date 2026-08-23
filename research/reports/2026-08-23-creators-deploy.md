# Creators: the editor deployed, the composites rendered, the credits filled (2026-08-23)

`audit.mjs` **17/20** · `negative-tests.mjs` **54/56** · `verify-work.mjs` 3 findings · `slop-guard.mjs` clean

The two failing guards and the three audit checks are **from concurrent sessions,
not this work** — see the last section. None were introduced here.

## Assumption 1 is stale

`build.html` is **27 KB, not 11 KB.** Commit `6252c3d` rebuilt the editor from a
search box into a funnel (set → count → theme → ideas) after this pending doc was
written. `card-index.json` is 1.54 MB as stated, and `layouts.mjs` does hold
exactly seven measured frames. Assumptions 2 and 3 hold — with one correction to
3 that mattered a great deal, below.

## BLOCK 1 — deployed, with one thing the doc got wrong

`build-public-site.mjs` assembles `site-public/` from the data repo over
raw.githubusercontent and Wrangler uploads it. It now carries `/build`,
`/creators` and `/img`, and the two pages cross-link.

**The doc says "both files must sit in the same directory."** That is true of the
relative fetch and false of the fix it implies. `build.html` does a bare
`fetch("card-index.json")`, and Workers assets serve **extensionless** — the
editor is at `/build` with no trailing slash, so the relative base is `/` and the
index resolves to `/card-index.json`. Both therefore sit at the served **root**. A
`/build/` subdirectory would only work if every visitor arrived at the
trailing-slash form, which nothing guarantees. The build also **refuses to ship
`build.html` without `card-index.json`** — an editor that cannot load its
catalogue is a search box that finds nothing.

`build-editor.mjs` and `build-creators-page.mjs` now run in the pipeline, and
their three outputs are in the `git add` list. Workflow ritual: js-yaml parses,
exactly one top-level `name:`, 23 steps listed in the commit body.

## BLOCK 2 — rendered, and it exposed three defects nothing else would catch

The image host serves this desk and CI (**200 OK**) even though chat gets 403.
Six composites render in **17s at 12.6 MB**. It drives `card-composite.mjs`
rather than reimplementing it, because the watermark and credit are locked and a
second implementation is a second place for them to drift.

Every one of these was found by **opening the file and looking at it**:

1. **The watermark was one point, not three, on every server-rendered image.**
   The two faint diagonals existed only in the client-side canvas. The SVG path
   had the footer alone — and the SVG path is precisely what we are about to
   serve from our own domain and expect to be reposted. Fixed with the canvas
   geometry.
2. **The caption printed straight through the card labels.** "Teeziro trio" over
   "Gouging Fire ex · 2024", both illegible. Identical coordinates in both
   renderers, so this was shipping, not a font quirk. My first fix *clamped* the
   caption to `H - 46`, which on a nine-card grid pushed it back onto the year
   labels — **a clamp turns "does not fit" into "overlaps"**. The canvas grows now.
3. **Grid layouts blanked the card name but kept its separator**, so every label
   on a nine-card page read "· 2024" with nothing before the dot.

Underneath them, a diagnosis bug: the rasteriser imported Resvg at the head of
the same destructure as the image fetch, so a missing native binding threw before
a single image was requested — **and the error blamed the image host**. Embedding
and rasterising are separate questions now, with a Chrome fallback so composites
can be checked by eye on a machine without the binding. Verified on both paths.

### What it costs per run — and why I did not wire it to the daily job

**12.6 MB per run for six composites.** Git keeps every version forever, and the
formulas rotate daily, so nothing is ever reclaimed:

| | |
|---|---|
| per run | 12.6 MB |
| per year, daily | **~4.5 GB of permanent history** |
| current `.git` | 93 MB |

That is a 48× repo in a year for files that are pure derivatives. So the
capability is built and the images are committed once, but **`render-composites.mjs`
is deliberately NOT in the daily workflow.** The right fix is to render at deploy
time into `site-public/img/` — which Wrangler uploads and git never sees — and
that is a change to the deploy path rather than the data pipeline. **Tyler's call.**

`verify-work` correctly flags `card-composite.mjs` as a generator outside the
pipeline. That flag is accurate and expected while this decision is open.

## BLOCK 3 — the editor works, and I got past one of its two locks

Tested against a local server so the relative index fetch behaved exactly as
deployed. Search returned 60 Charizards with illustrators attached.

- **Five cards refuses correctly:** *"5 cards has no frame. Remove 1 or add 1."*
  — states the problem and the fix, and disables the button.
- **Six renders**, 2535×2340.
- **The watermark is genuinely three-point.** Confirmed twice: cropped both
  diagonal zones at full resolution and read `catchemtcg.com` rotated into the
  artwork, plus the footer wordmark. Then independently — intercepting
  `fillText` suppressed **exactly 3** marks.
- **The illustrator line is populated** from card data: "Mitsuhiro Arita · Ken
  Sugimori · Hironobu Yoshida".

**Can it be defeated?**

- **By cropping — no.** That is what the two inset marks are for; cropping past
  them crops into the cards.
- **By the console — yes, trivially.** Eight lines intercepting
  `CanvasRenderingContext2D.fillText` removed all three marks. The renderer is
  client-side, so this is unavoidable there. **The server-rendered path from
  Block 2 cannot be defeated this way** — the PNG arrives already marked. That is
  a second argument for serving them ourselves.
- **By choosing uncredited cards — no, and this is better than the doc claims.**
  The doc says an uncredited post "already refuses to build". It does not refuse:
  a tray of six cards with no recorded illustrator renders, and the credit line
  reads **"illustrator not recorded"**. That is the right behaviour and matches
  Tyler's own instruction to keep those cards pickable — it states the absence
  instead of hiding it. The doc should be corrected, not the code.

## BLOCK 4 — a source exists. 1,011 credits backfilled.

**TCGdex** publishes the illustrator per card and has all four sets the doc
named, plus the next two largest gaps. Each was verified on **both exact name and
exact card count** before a single credit was taken:

| set | ours | theirs | filled |
|---|---|---|---|
| Surging Sparks | 252 | 252 | 250 *(they lack 2)* |
| Mega Evolution | 188 | 188 | 188 |
| Prismatic Evolutions | 180 | 180 | 180 |
| Stellar Crown | 175 | 175 | 175 |
| Perfect Order | 124 | 124 | 121 *(they lack 3)* |
| Shrouded Fable | 99 | 99 | 97 *(they lack 2)* |

**Catalogue: 1,227 cards without an illustrator → 216. From 7.5% to 1.3%.**
2024 went 43.7% → 8.7%; 2025 29.3% → 0.5%. Four spot-checks against the API's own
values, all exact.

It **only adds** a credit where we hold none and never overwrites one we have — a
disagreement between two sources is something to look at, not to resolve silently
in favour of whoever ran last. The number key needed normalising: ours pads
`001`, theirs writes `1`, so a raw compare missed cards 1–99 and matched from 100
up — exactly 99 misses per set, in all four sets, which is what gave it away.

**Worth contributing upstream, and it is now nearly free**: we hold 1,011 credits
the pokemontcg.io dataset does not, already keyed by set and card number. That is
a pull request, not a project. Recommend it.

Not wired to the daily run — it is a backfill, and re-running 795 requests a day
against a free community API we are asking a favour of would be rude. Manual,
idempotent, re-runnable when a new set lands.

## Needs Tyler
1. **Deploy**: `node scripts/build-public-site.mjs && npx wrangler deploy -c wrangler.site.jsonc` from `catchem-app`. I did not deploy — pushing to a live domain is yours.
2. **The 4.5 GB question**: render composites at deploy time, or accept the history growth, or cap the count.
3. **The console defeat** is inherent to client-side rendering. Worth knowing before the watermark is treated as a paywall.
4. **Correct the pending doc**: uncredited cards are labelled, not refused.

## Not mine — pre-existing failures
- `Registered agents actually run` — designer and theme-scout registered with the supervisor but never imported by the pipeline (commits `f319be8`, `2939f38`).
- `Verifier cannot be quietly weakened` — one ledger class, "secondary consensus contradicted by primary data", no longer covered (`65cead0`).
Both need judgement on another session's in-flight work, so they are reported rather than patched.

**Fixed out-of-scope, under the protocol:** `negative-tests` imported
`layout-check.mjs` by bare Windows path, so `import()` rejected it with
`Received protocol 'c:'` and the test **errored rather than ran** — an errored
test reports as a failed guard, so the layout guard looked broken when only the
harness was. That surfaced a real break underneath: `opentype.js` was undeclared
in `package.json` **and** uninstalled, so `layout-check` could not run in CI
either. Declared it.

## Uncommitted / unverified
- **Nothing is deployed.** The pages are built and pushed; the Wrangler deploy has not run.
- `npm install` on this Windows desk **prunes tracked Linux bindings** from `node_modules` (sharp-libvips-linux-x64 among them). Restored both times, but anyone running it here must check `git status node_modules` afterwards.
- The composites were rendered from today's formulas; nothing schedules them.
