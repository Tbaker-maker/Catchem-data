# The queue answered, the editor deployed — and it was dead when I found it (2026-08-23)

`audit.mjs` **20/20** · `negative-tests.mjs` **58/58** · `verify-work.mjs` 4 (none new) · `slop-guard.mjs` clean · `designer.mjs` runs

**Live now:** [catchemtcg.com/build](https://catchemtcg.com/build) ·
[/creators](https://catchemtcg.com/creators) · [/faq](https://catchemtcg.com/faq)

## Assumption 1 is off

**21 questions, 16 addressed to me — not 15 and 12.** Assumptions 2 and 3 hold,
with the same correction as last session: "same directory" is true of the
relative fetch and false of the fix it implies. Workers serves extensionless, so
`/build` has no trailing slash, the relative base is `/`, and both files sit at
the served **root**. That is how they are deployed and it works.

## BLOCK 1 — 19 of 19 answered, and the queue found a live defect

Every question addressed to cc is answered in place, including three added
mid-session. Five remain for Tyler.

**Twelve were the same finding.** Near-neighbour font sizes across nine pages:
each size attaches to a *different element*, so they were typed with different
intent — but the gaps are 3–8%, and a type step is not legible below roughly
15%. **Distinct roles, not distinct steps.** Answered per page with the actual
selectors behind each value.

**Two are findings about the question, not the page:**

- **designer-22** — the check is **absolute where it should be proportional**.
  2px is a large step at 12px and invisible at 30px. `faq.html` is now 14/16,
  which is a 14.3% step and reads correctly, and it will keep tripping a 2px
  rule anyway. Suggest flagging gaps under ~12% of the smaller size.
- **grading-plan-19/20** — **unanswerable by me.** They need a foil card under a
  phone flash and a card show in bad light. I have none of those, and any answer
  would be optics reasoning dressed as measurement. Re-addressed to Tyler. The
  second half of 20 *is* answerable in code and matters more: whether the tool
  **says** when it cannot measure.

**One was tested rather than reasoned.** listing-images-23 asked whether a
want-list reads at Discord thumbnail size. Rendered nine cards, downscaled to
400px, looked: **the artwork survives** — every card identifiable. **The text
does not.** Want-list prices are 26px on a 2535px canvas — **4.1px** at
thumbnail. So it reads as "nine cards", not as "which ones I need and what they
cost", which is the working half of a working document. Recommend want/trade/sell
caps at 4–6 cards, or scales price text with card count.

### designer-12 found a live, systemic defect

It asked whether the artwork breathes or is crowded. **Neither — there was no
artwork.** `latest-social.png` had an empty rounded rectangle where the product
photo belongs, on a card carrying a VERIFIED chip and today's date.

Card SVGs carry a **remote href**, a rasteriser cannot fetch over the network,
and **`rasterize-cards.mjs` — which fetches and base64-embeds every image first —
was in no workflow at all.** Cards were minted as SVG daily and never
re-rasterised. Verified: **0 of 35** card SVGs held an embedded image; all held
remote hrefs. Running it took the PNG from 42KB to **542KB** and the product
renders. Now pipeline step 16.

## BLOCK 2 — deployed, and the editor was dead on arrival

Deployed to Cloudflare (230 files). But attacking it first found the editor was
**not running at all**: on a clean load `INDEX`, `add()` and `search()` were all
undefined. The inline script failed to parse, so the page rendered and did
nothing.

Every check we own passed. The file existed, was the right size, the HTML was
well-formed. **Nothing asked whether the JavaScript inside could run.**

**Root cause, twice, same shape** — the generator writes the inline script from a
template literal, where a backslash escape collapses:

1. An escaped `class` attribute arrived as a plain quoted attribute **inside a
   double-quoted JS string**, terminating it and leaving a stray identifier.
2. **My own fix hit it again**: a regex written with one backslash arrived as
   `/s+/` and split the label on the **letter s**. Every s vanished —
   "absolutely" rendered as "ab olutely". Caught by looking at the render.

New guard: **generated pages must emit JavaScript that parses.** This shipped
silently and would have shipped again.

Verified live: 16,468 cards indexed, adding a card works, cross-link present.

## BLOCK 3 — already done, verified holding
Six composites, **12.6 MB, 17s**. Unchanged from last session. Still **not** in
the daily workflow: 12.6 MB/run is ~4.5 GB of permanent git history a year
against a 93 MB repo. The fix is rendering at deploy time into `site-public/img/`,
which Wrangler uploads and git never sees. **Still Tyler's call** — `verify-work`
correctly flags `card-composite.mjs` as out-of-pipeline while it is open.

## BLOCK 4 — three attacks, one broke it

| attack | result |
|---|---|
| **label of 182 chars** | **BROKE IT** — drawn as one line, ran off **both** edges, starting and ending mid-word. `fillText` neither wraps nor clips. Now wraps to 3 lines with reserved height following the wrap. Verified by eye. |
| card with no image | **HOLDS** — tries a proxy route, then refuses: *"could not compose: could not load &lt;card&gt;"*. Names the card rather than drawing a hole. |
| nine cards at 390px | **HOLDS** — no horizontal scroll, nothing past the right edge, binder 342px inside 390. |

Carried from last session: five cards refuses correctly (*"5 cards has no frame.
Remove 1 or add 1."*); the watermark is genuinely three-point (confirmed by
crop **and** by intercepting `fillText`, which suppressed exactly 3); the credit
is populated, and reads *"illustrator not recorded"* rather than blank when the
dataset has none. **The console defeat stands** — eight lines removes all three
marks, unavoidable in a client-side renderer, and a further argument for serving
composites ourselves.

## BLOCK 5 — one generator, one deletion

- **`faq.html` — given a generator, and deployed.** Deleting it would have been
  wrong: the content is real and reader-facing (the Sealed Index, berries,
  provably-fair draws, where methodology lives). **It was not junk, it was
  unplugged** — written by nothing, linked from nowhere, deployed nowhere.
  Content moved to `data/faq.json` (editorial, hand-edited), rendered by
  `scripts/build-faq.mjs`, wired to the pipeline, live at `/faq`. The words stay
  Tyler's; the styling becomes fixable in one place.
- **`image-contact-sheet.html` — deleted.** A frozen snapshot of "179 live
  products" whose only value is being current. A committed copy is stale by
  definition, nothing linked it, and the capability belongs in a script run on
  demand rather than an artifact in the repo.

## BLOCK 6 — already done, verified holding
**1,227 cards without an illustrator → 216 (7.5% → 1.3%)** via TCGdex, verified
on exact name *and* exact card count per set. Surging Sparks 250/252, Mega
Evolution 188/188, Prismatic 180/180, Stellar Crown 175/175. We now hold **1,011
credits the upstream dataset lacks**, keyed by set and number — contributing back
is a pull request, not a project. Recommend it.

## Needs Tyler
1. **Five questions** remain in the queue, plus grading-plan-19/20 re-addressed.
2. **The 4.5 GB question** — deploy-time composite rendering, or accept the growth.
3. **The near-neighbour check** should be proportional, not a flat 2px.
4. **Want-list images** need a card cap or scaled price text before they ship.

## Uncommitted / unverified
- `npm install` on this Windows desk **prunes tracked Linux bindings** from `node_modules`. I installed js-yaml into the scratchpad instead this session to avoid it; anyone running it in-repo must check `git status node_modules` after.
- `verify-work`'s remaining 4 findings are pre-existing: card-composite out-of-pipeline (deliberate), a single-pack price, the unviewed-image counter, and error 21 (another session's ledger class).
- The deployed composites are today's formulas; nothing schedules them.
