# Catch'em Creators — serve it from our own domain (CC applies)

Tyler, 2026-08-23: *"These images should be coming off our app so it forces
people onto our products and/or into Discord."*

Strategically right, and it solves the technical problem as a side effect:
**same-origin images need no CORS permission.** Every download failure today
came from asking a third-party host for a copy it never agreed to give. If we
serve the composed PNG ourselves, the canvas dance disappears entirely — the
file is just a file.

## WHAT TO BUILD

**1. Render composites server-side, in CI.**
`scripts/card-composite.mjs` already has the rasterise path and skips here
because chat gets 403 from the image host. CI does not. So on each daily run:
- take the top pairings from `research/pulse/pairings.json` and the top
  formulas from `research/pulse/formulas.json`
- render each to `research/assets/img/<slug>.png` via the existing Resvg step
- commit them (add them to the `git add` list in the workflow — an unlisted
  written file evaporates at job end, which is the class that froze the app
  feed)

**2. Deploy `creators.html` to the site.**
It exists at `research/assets/creators.html` and goes nowhere today. It should
live at `catchemtcg.com/creators`, with the card images pointing at our own
`/img/` paths rather than at the rights-holder's CDN. Then the download button
is a plain `<a download>` on a same-origin file and cannot fail.

**3. Make Discord the second door.**
The daily digest already generates. Add the day's best composite to the Morning
Pulse embed with a link back to `/creators`. A creator who sees one good image
in Discord and finds nine more behind one click is the whole funnel.

## WHAT TYLER SHOULD KNOW BEFORE THIS SHIPS

Recorded in `data/knowledge.json` as `hosting-vs-hotlinking`, confidence
REASONED rather than VERIFIED:

**Serving card artwork from our own domain is a materially different act from
linking to the rights-holder's host.** Hotlinking embeds an image the owner is
already serving. Hosting a copy means we are the one distributing it.

This is **not** an argument against doing it — the whole hobby hosts card
images, and it is the only way to make downloads work properly. It means the IP
consult **moves up the queue**. It was triggered by "the first dollar";
`data/compliance-register.json` now also triggers it on serving artwork
ourselves, which arrives sooner.

Three mitigations that cost nothing and are better practice anyway:
- **credit the illustrator on every image** — we have the artist field on all
  16,468 cards and it is the decent thing regardless
- **state plainly that we are unaffiliated** with Nintendo, TPCi or The Pokémon
  Company
- **remove anything on request, without argument**

## THE ONE THING NOT TO DO
Do not serve the images and skip the attribution because the layout is tight.
The attribution is the cheapest part of the defence and the only part that also
makes the content better.

## ALSO: the three transfer paths belong on the Creators page too
`card-composite.mjs` now offers Download PNG, Copy image, and Share, each
feature-detected. `build-creators-page.mjs` still only offers download — port
the same three across so a creator on a phone gets the share sheet rather than
a file that Safari opens instead of saving.

PNG throughout, deliberately: it is lossless and universal, and JPEG would band
the holo gradients, which is the one thing card art cannot afford.

## THE EDITOR IS BUILT — deploy it (2026-08-23)
`scripts/build-editor.mjs` produces two files:
- `research/assets/build.html` (11 KB) — the editor
- `research/assets/card-index.json` (1.55 MB) — slim index of all 16,468 cards

It searches by Pokémon, illustrator or set, filters by rarity and year, holds a
tray of up to nine, picks the frame from the count via the layout table, refuses
unsupported counts with the fix, and offers Download / Copy / Share.

**Both files must sit in the same directory** — the editor fetches
`card-index.json` relative to itself. Target: `catchemtcg.com/build`.

TWO THINGS THAT MUST STAY LOCKED, per Tyler's tier model:
- **the watermark** — three points, footer plus two faint diagonals at 16%.
  The watermark IS the free tier; removing it becomes the gated feature later,
  which also means every free post markets us.
- **the illustrator credit** — renders from card data, cannot be cleared.

Add `build-editor.mjs` to the pipeline and both output files to the workflow's
`git add` list. A file written in CI but not added evaporates at job end.
