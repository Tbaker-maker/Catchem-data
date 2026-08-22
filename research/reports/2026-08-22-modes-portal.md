# Session report — 2026-08-22 · Modes (§20) + Mode Honesty Guard + Creator Portal (§21)
*Per research/PROMPT-CONVENTION.md. Commits carry the what; this carries the judgment.*

## Assumptions audit (none false — one nuance)
1. **No persona system** — TRUE. localStorage held only currency/deal-zone/cache keys; zero Collector/Flipper/Grader traces in the app.
2. **Scattered surfaces, no unifying home** — TRUE IN SPIRIT, one nuance: `/studio` already existed as Story Kits v0 with two links. §21 itself calls the pieces "currently scattered," so I treated the spec as current and rebuilt `/studio` as the door rather than stopping. Existing routes untouched.
3. **§20/§21/§22 current** — TRUE (all dated today; nothing later in the file).

## §22 check (required)
No new top-level surface. Modes are a lens on existing screens (no route added). The portal reuses `/studio`. Show Mode remains the only context. Post-session surface census: four modes · one portal · one context — exactly the doctrine's shape.

## Roads not taken, and why
- **Per-mode section reordering of the WHOLE Home** (moving Daily Three/Movers around per mode): rejected — bigger diffs for marginal emphasis gain, and every extra moving part is a place the Honesty Law can drift. Three lead rows present in all modes + position swaps deliver §20's acceptance visibly.
- **Grader lead showing premium figures**: rejected while the graded lane is license-gated — the lead reuses the same lock treatment as the Daily Three graded card. PPT numbers stay off the app.
- **DOM-diff via React test-renderer instead of a real browser**: rejected — jsdom wouldn't exercise the real feed, real CSS, or real localStorage boot path. Puppeteer against the live app is slower but tests the thing people see.
- **A webhook REGISTRY form that stores anything**: rejected — §14b law says webhook URLs never touch the repo, and no backend exists to hold secrets. The portal tests the webhook client-side only (one embed, at the creator's own click) and routes the registration ask to Tyler.
- **A fifth "Vendor" chip**: explicitly not built (§20: vendors are Flippers; Show Mode's selling toggle is the vendor face).

## Surprises (including my own bugs)
- **My negative test initially passed when it should have failed** — wait, that was session 15's lesson; today's twist: the mode-diff comparator had to be a MULTISET, not a set. The negative test (grader dropping one lead) produced 48-vs-47 with EMPTY set-difference on both sides — the dropped token's value existed elsewhere on the page. Set-equality would have shipped a false pass; sorted-array equality caught it. The registry row records this.
- **Sequential tab clicks in one JS eval read stale DOM** (React batches) — my first portal verification reported all-false; per-call clicking fixed it. Verification tooling can lie the same way guards can.
- **`wrangler` is not a bin in the app repo** — `npm run deploy` (added last session) was broken on arrival; smoke-chained deploys had silently never been runnable as scripts. npx-ified.
- **Stale console buffers in the dev pane** resurrected the long-dead `cur` crash for a minute — timestamps in the error traces are worth reading before re-fixing a fixed bug.

## Needs Tyler (decisions, not tasks)
1. **Mode picker placement** — it sits at the Home foot ("offered after the app has been useful"). If you want it more discoverable (e.g., a dot in the header), say so; I kept it maximally non-gating.
2. **Syndicate hand-off wording** — the test-embed flow ends with "screenshot + DM @Tyler". If you'd rather collect webhooks another way (form → email?), the guardrail (secrets never in repo) constrains the options.
3. **Creator roster + "what's live" view** (§21 wants them) — both need a data home for creator identities; deferred, no registry exists yet beyond data/creator-registry.json ids.
4. Standing from earlier sessions: Formspree→Buttondown import (LAUNCH BLOCKER for Monday), CF Access, GemRate email.

## Uncommitted verification (ran, not in any commit)
- Mode-diff positive: 48-figure multiset identical across all four modes — local dev AND deployed app.
- Mode-diff negative: grader − one lead row → exit 1 (48 vs 47); restored; green re-verified.
- Portal per-tab DOM checks: Today (6 angles, kits), Make (picker → Price card + Deal Zone card both minted PNGs), Stream (copy rows), Syndicate (webhook input + 2 iframe snippets + attribution line), Learn (chips guide).
- Deploys ran with the chained smoke test: 13/13 green both times.
- NOT run this session: Lighthouse (bundle grew 213.7→217.5 kB pre-gzip, 67.3 kB gzip; prior scores had ~4-point headroom — re-measure next perf pass), offline-cache retest (unchanged code path), word-law audit (Home gained ~30 on-glance words from lead rows + picker strip — worth a v7 pass if Tyler feels drift).

## Fences held
No purchases · newsletter canonical untouched · PPT numbers kept off the app (grader lead is numberless while gated) · workflow edit went through the validation ritual (18 steps, one name:, parses) · nothing posted to the real Discord (the only Discord POST path fires client-side at a creator's click on THEIR webhook).
