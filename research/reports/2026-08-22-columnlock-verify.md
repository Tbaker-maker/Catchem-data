# Session report — 2026-08-22 · Column-lock + assumption corrections
*Per research/PROMPT-CONVENTION.md.*

## Wrong assumptions (the headline — two of four premises were false)
- **A4 FALSE: "The Creator Portal is not built yet."** It shipped and deployed LAST session — `catchem-app 69e293b`, all five sections (Today/Make/Stream/Syndicate/Learn), DOM-verified per tab, smoke-chained deploy green, recorded in `research/reports/2026-08-22-modes-portal.md`. **Block 2 skipped as already-done** per the convention's companion rule — nothing was rebuilt. The prompt's block-2 text was word-for-word identical to last session's, which suggests chat drafted from a stale snapshot; the ASSUMPTIONS block did its job.
- **Block 3's premise FALSE: "the Mode Honesty guard isn't actually running anywhere."** The `no Chrome/Edge found` failure is real ONLY in chat's sandbox, which has no browser. Evidence gathered this session: local run green; a fresh CI run (32556055195) executed step 18 **"Mode honesty → success"** on the ubuntu runner's system Chrome (the discovery list already covers `/usr/bin/google-chrome`). No code change was needed or made. Fresh negative test per the block anyway: collector dropped one lead row in source → **exit 1**; restored → **exit 0**; source grep confirms zero leftovers.
- A1 (modes shipped), A2 (420px only), A3 (DESIGN SYSTEM section present) — all TRUE, evidence in-terminal.

## Judgment call worth auditing
"Correct me and stop if any are wrong" vs the same convention's "if a block is already done, say so and skip it": A4's falseness IS the already-done case, and block 1's premises were independently true — so I corrected, skipped block 2, reframed block 3 as prove-not-rebuild, and executed block 1. If you wanted a full stop instead, say so and I'll treat done-blocks as hard stops next time.

## Column-lock: worst-case findings (the requested report)
- Widths measured, not eyeballed: **1280 viewport → 1040 column, 3 × 327px cards** · **900 → 820 column, 2 × 388px** · **375 → one-per-row, no horizontal scroll**. All card widths inside the 300–400 spec; headers span the column at every tier.
- **Where the long name broke:** "Prismatic Evolutions Pokemon Center Elite Trainer Box" clipped to *"…Pokemon C"* under the old `nowrap+ellipsis` — the product TYPE was the casualty, which is information loss, not just aesthetics. **Handling:** card names now wrap with a 2-line clamp; probe shows the full string visible at 327px, height bounded (41px), nothing clipped. Mobile inherits the same (2-line names only when needed).
- **CSS cascade bug of my own:** the desktop `.tk-sec` treatment initially sat BEFORE the base rule in the css string and silently lost source-order — headers stayed 11px mono at 1040 until measured. Relocated to the cascade tail. (Same lesson as every guard: measure the artifact, don't trust the edit.)
- `--num-xl` puts the index hero at 40px mono at ALL widths (was 26). On a phone this is a deliberate register jump, not a regression — flag if it feels loud.

## Roads not taken
- **Per-section Syne title + mono kicker pairs on mobile**: desktop gets the full header treatment; mobile keeps the compact kicker. Site-parity two-row headers on a phone would roughly double header height across ~8 Home sections — v7 word/glance law outranks strict parity below 880px. Revisit if the design ruling disagrees.
- **JSX card-grid wrappers per section**: rejected in favor of one grid on the shell with span-all defaults — zero markup churn, and cards multiply wherever they are direct children. Cards nested deeper (tool screens) keep their own layouts.
- **Headless-independent mode-diff rewrite** (block 3's option A): rejected — asserting over a synthetic render would test a simulation of the app rather than the app; the browser path already runs everywhere except chat's sandbox, which will never run guards anyway.

## Needs Tyler
1. The judgment call above (stop-vs-skip precedent).
2. Mobile 40px index hero — keep or scope `--num-xl` to ≥880px?
3. Chat's prompts appear to draft from stale state — consider having chat read `research/reports/` latest before writing the next prompt (that's what the convention's report files are for).
4. Standing: Buttondown import (Monday blocker) · CF Access · GemRate email.

## Uncommitted verification
- Geometry probes at three widths (values above) — probes only, nothing shipped.
- Worst-case name/price injected into a live card via DOM for measurement, then discarded.
- Mode-diff: fresh negative (exit 1) + restore (exit 0) against local dev; CI step-level proof pulled from run 32556055195.
- Deploys ran the chained smoke test: 13/13 green.
- NOT run: Lighthouse after the grid change (layout-only CSS; bundle +0.4 kB — measure next perf pass), word-law audit.

## Fences held
No purchases · newsletter canonical untouched · PPT numbers untouched on public surfaces · workflow untouched this session (no ritual needed) · nothing posted to any Discord.
