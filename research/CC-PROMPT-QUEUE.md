# CC PROMPT QUEUE — ✅ ALL SEVEN DONE (CC desk remote session, Aug 22 2026)
Every block below completed and pushed; see WORKQUEUE header + the session
report for outcomes, surprises, and the four items pending Tyler.
Kept for the record — add new blocks BELOW a fresh header when queueing.

# (was) CC PROMPT QUEUE — paste in this order (updated Aug 21 2026, evening)
One prompt at a time. Wait for CC's report and the `>` prompt before the
next. Everything here is blocked on either workflow-scope permissions or
a machine I can't reach — nothing is duplicated work.

Standing fences for every block: no purchases · English-only untouched ·
newsletter canonical files untouched (previews/SEND-READY only) · PPT
numbers stay off public surfaces · webhook URLs never in the repo ·
workflow edits require the validation ritual (yaml parses, exactly one
top-level `name:` key, step list printed in the commit message).

---

## 1 — CI GUARD STEP (do first, 2 minutes, unblocks everything else)
> Apply research/PENDING-CI-PATCH.md: add a step named "Guard audit (fails the run if any safeguard is disconnected)" running `node scripts/guard-audit.mjs` immediately before the "Unit tests (fail-fast)" step in .github/workflows/update-sealed-prices.yml. Validation ritual applies. Then trigger the workflow and confirm it goes green end to end, including the new guard-audit, jargon-lint, and publish-assert steps. Report the step list and the run URL.

WHY: my token can't touch workflow files. The audit already runs inside
the pipeline, so this only makes it fail faster — but a red CI step is
how we'd notice a disconnected guard within minutes instead of a day.

---

## 2 — BRAND FONTS FOR CARDS (visual quality, 10 min)
> Vendor the brand fonts so share cards stop falling back to system serif. Download Syne, Sora, and JetBrains Mono TTFs (all OFL-licensed, safe to commit) into research/brand/fonts/, confirm scripts/rasterize-cards.mjs picks them up through its fontFiles loader, and add @resvg/resvg-js to the CI install step so the daily run rasterizes. Verify by rendering latest-index.png and latest-social.png and checking the wordmark renders in Syne and numbers in JetBrains Mono. Report before/after.

WHY: every card we publish currently renders in the wrong typeface.

---

## 3 — PACK BASIS (RT-4b, unblocks honest sealed premiums)
> Map TCGplayer product ids for every booster-pack SKU in data/crosscheck-id-map.json (web-verify each — single-pack product pages, never art-set lots or multi-packs), mark reviewed:true. The next crosscheck run then feeds tcgMarket for packs; compute-derived already prefers TCG for the pack class per RT-4b and flags premiumBasis per set. Report which SKUs mapped clean, which have no TCG listing, and the before/after sealed-premium table — Evolving Skies is the case study Tyler flagged.

WHY: pack prices still use eBay asks, which carry a photo premium that
doesn't apply to a commodity. Premiums read conservative until this lands.

---

## 4 — TOKEN SYNC + PUBLIC/GATED SPLIT (the architecture one, biggest)
> Two blocks. **A. TOKEN SYNC:** fetch www.catchemtcg.com, extract its real design tokens from the served CSS (colors, font families/sizes/weights, spacing scale, border radii, border colors, max-widths, button and card treatments). Write tokens.css and tokens.json into Catchem-data/research/brand/, update research/brand-tokens.md to name the live site as the SOURCE OF TRUTH with a regeneration command, then make catchem-app import tokens.css and the generators read tokens.json instead of inline hex values. Acceptance: change a value in tokens.css and both the app and the generated HTML follow. Report every place the app's current look differs from the site — spacing rhythm and type scale especially.
>
> **B. PUBLIC/GATED SPLIT:** methodology.html, corrections.html, the-pulse.html, the-board.html and the 168 /p/ landers currently deploy inside app.catchemtcg.com, and every card, post, and newsletter link points there — so sharing anything exposes the untested app. Find where the marketing site is hosted and from which repo, move those static public surfaces onto it (catchemtcg.com/methodology, /corrections, /pulse, /board, /p/{id}), update the SITE constant in the Catchem-data generators to the correct public host, and put the interactive app behind Cloudflare Access (email allowlist, Tyler only) or an unlisted URL with noindex — your judgment on which is cleaner. Verify methodology and one lander load publicly and the app does not load without auth. Report the final URL map and every published link that needs correcting.

WHY: Tyler wants to show the community the site but not the app yet, and
the brand should sync from one file instead of screenshots.

---

## 5 — POST STUDIO SURFACE (§17, the creator tool)
> Build /studio/posts per app-specs §17. Add a post-bank passthrough to the feed if missing. UI: angle cards showing the angle, its chip, and the "why this works" line → tap → platform tabs (X · YouTube title · YouTube hook · Short script) → a copy button per format → card download. Voice selector (Analyst/Casual/Energetic) adjusts phrasing client-side and never touches numbers. v7 Digest Law applies — glanceable, one idea per card. Also surface Tyler's own daily three slots (§16 social-queue) at /studio/posts?mine=1. Report a screenshots-or-DOM verdict.

WHY: the engine mints six angles × four formats every morning and no
human can see them yet.

---

## 6 — GEMRATE + PSA RECON (research, no signups)
> Two docs, no accounts created without asking. **A.** Draft research/gemrate-partnership-email.md to GemRate's partner contact (find it at gemrate.com/partner): who we are (Catch'em, Pokémon sealed-market intelligence, public methodology, launching now), what we want (Pokémon population + gem rate + history, daily, with display rights), what we offer (visible attribution on every graded surface, a growing distribution channel), and ask directly whether a startup or small-partner tier exists and what it costs. Under 200 words, founder voice. Read docs.gemrate.com and note which endpoints we'd use and roughly how many calls/day our watchlist needs, so we negotiate from a real number. **B.** research/psa-api-recon.md: confirm what PSA's free public API actually returns (cert verification; population fields are reported null on the free tier), what registration requires, and what cert verification would enable for us — slab authenticity checks for raffles and the future marketplace. Recon only.

WHY: pop data is the last gated layer. Tyler's ceiling is "not another
$100/mo," so we learn the real numbers before spending anything.

---

## 7 — BINDER ART VERIFY + TUNE (visual, do right after #2 fonts)
> Verify and tune the binder-page generator (scripts/binder-page.mjs, spec §18). Run it, rasterize, and confirm card art from images.pokemontcg.io actually renders inside the 3×3 grid — my sandbox is network-blocked from that host, so this is UNPROVEN. If images fail, diagnose (hotlink protection, CORS, or the rasterizer's data-URI inlining) and fix. Watch for the rasterizer's "DO NOT POST" warning — it fires when any card image fails. Then tune the layout: tighter gutters, a squarer canvas that performs better on X, optional per-card captions, and a 2×2 four-card variant. Produce one sample PNG per theme for Tyler to judge, and confirm the fallback text is fully covered when art loads.

WHY: highest-engagement collector format on X; the frame is built and
the fallback is honest, but nobody has seen it with real card art yet.

---

## AFTER ALL SEVEN
Update research/WORKQUEUE.md, then report anything that surprised you.
If a block turns out to be already done, say so and skip it rather than
redoing it.
