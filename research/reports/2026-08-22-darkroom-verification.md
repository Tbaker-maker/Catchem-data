# Darkroom verification + how (not) to take it to the app — 2026-08-22

## It was damaging light packaging, and it was already shipping

Ran the darkroom over 12 real catalogue photos spanning ETBs, booster boxes,
bundles, loose packs, a modern white-bordered card and a vintage card.

**Nine clean. Three destroyed — all light packaging.**

| product | result |
|---|---|
| 151 ETB | box repainted navy; it reads as a black product |
| Prismatic Evolutions ETB | background gone AND the wordmark half eaten — "RISMATI", "VOLUTIONS" |
| 151 booster bundle | same failure |
| Black Bolt, Crown Zenith, Destined Rivals, Evolving Skies, Mega Evo, Surging Sparks pack, SWSH base pack | clean |
| Umbreon VMAX (white border) | clean — the white border survived; the 5% fill was the corners outside the card's rounded edge |
| Base Charizard (yellow border) | untouched, 0% |

The cause is not a bad threshold. Light boxes are photographed **on white as
white**, so box and backdrop are one connected region of the same tone and the
fill walks through the boundary. The rasterizer's only guard was
`coverage > 5 && < 85`; the 151 ETB filled 59% and sailed through, so **the
damaged version was already going into minted share cards.**

## Tuning cannot fix it — the sweep, so nobody retries it

| floor | 151 ETB filled | centre eaten | verdict |
|---|---|---|---|
| 210 (shipped) | 59% | 23% | product destroyed |
| 240 | 39% | 23% | destroyed |
| 246 | 36% | 22% | destroyed |
| 250 | 22% | 2% | marginal |
| 251 | 9% | 0% | product safe… |
| 255 | 7% | 0% | …but backdrop barely painted |

The backdrop is a soft studio white, not pure 255, so any floor strict enough
to spare the product leaves most of the background unpainted with a hard seam
around it — worse than leaving the photo alone. **No setting gets both.** Dark
products sit at 8–9% across the entire sweep, which is the real tell: the
technique is safe for dark packaging and unsafe for light. NEAR_WHITE and
MAX_SPREAD are therefore left where they were.

## What I changed instead: measure the breach

Catalogue shots centre their product, so background must never reach the middle
of the frame. If the fill lands there, the product has been breached and the
original is returned untouched. Over the 12, separation is total: **every
damaged frame filled 23–44% of the centre box, every clean one exactly 0%.**

Verified independently with difference masks: across all 12, **zero changed
pixels that are not connected to the frame border.** Only background was
repainted; nothing inside any product was touched. (The "TRA_ CARD GAME" gap I
thought I saw on Evolving Skies is original artwork — the mask proved it.)

Also fixed two documented-gotcha bugs that made the CLI smoke test a silent
no-op here: `file://${argv[1]}` never matches on Windows, and `/tmp` is
Linux-only. Removed the dead `isBg` helper.

## Taking it to the app — I would do neither of the two options

Survey across all **188** feed photos: **165 paintable, 22 skipped (12%), 1 failed.**
Hosts: tcgplayer-cdn 137 · images.pokemontcg.io 15 · i.ebayimg.com 36.

**The proxy is not viable on this stack, and not lightweight.** `catchem-app`
is an **assets-only Worker** — `wrangler.jsonc` has no `main` at all, just a
static directory with SPA fallback. Adding a proxy converts a static deployment
into a scripted one. Worse, `sharp` is a native libvips binding and **cannot
run in a Worker isolate**, so a live repaint means shipping a pure-JS/WASM JPEG
decode → flood fill → re-encode per image. And it would repaint unreviewed
images in front of users — which is precisely the path that produced a navy 151
box. Cloudflare's own image resizing does format and size, not background
replacement.

**Client-side canvas is impossible too, and this is decisive:**
`tcgplayer-cdn.tcgplayer.com` returns **no `Access-Control-Allow-Origin`
header**, so a canvas that draws those images is tainted and `getImageData()`
throws. (`images.pokemontcg.io` does send `*`, but those are the 15 that need
it least.) 137 of 188 photos can never be read client-side.

**Pre-processing works but has three problems the question didn't anticipate:**
1. **Never commit what the darkroom returns.** It emits PNG: 30.6 MB of source
   photos become **253.2 MB**. Re-encoded to WebP q82 it is 18.2 MB — still 7×
   the app's entire current bundle (2.5 MB, 282 files).
2. **36 of the photos are eBay seller shots that rotate.** 90 of them changed in
   a single fetch earlier today. Pre-processing those is a treadmill and they go
   stale immediately; only the 152 catalogue images are stable enough.
3. **It hosts modified copies of TCGplayer/TPCi product photography on our own
   domain.** Hotlinking and redistributing derivatives are different acts, and
   we already have an unresolved licensing gate with the same vendor family.

**And both pixel options leave 12% of the grid inconsistent.** Those 22 light
boxes can never be repainted, so the Board would show 165 products blending
into the page and 22 sitting on white rectangles. Inconsistency reads as
broken more than uniform white does.

### What I would do
Keep the darkroom where it already is — **share cards**, where the image set is
small, chosen, composed and reviewed before it ships. For the **app grid**, give
every photo one deliberate light tile (rounded, padded, a consistent neutral
surface) so the white reads as design rather than accident. That costs zero
bytes, adds no build step, carries no licensing exposure, covers 100% of
products including the 22 no pixel method can touch, and is one CSS change to
revert.

I did not ship that, because Tyler's original instruction was explicitly "don't
give it a white photo" — a tile is a different answer to his brief, and that is
his call, not mine to make silently.

**If he wants true dark blending in the app instead**, the scoped version is:
pre-process only the ~130 stable catalogue images the darkroom approves, emit
WebP not PNG, run it in the data repo's CI where sharp already lives, and leave
the rotating seller photos hotlinked. That needs a licensing ruling first.

## Needs Tyler
1. **Tile vs true-dark in the app** — the recommendation above, and it reverses
   part of his original brief, so it needs his word.
2. **May we host modified copies of TCGplayer product photography?** Gates the
   pre-processing option entirely. Same family as the unresolved PPT question.
3. The 22 light-packaging products will keep white backgrounds under any pixel
   approach. Worth him seeing the list before choosing.
