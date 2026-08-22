# Brand Tokens — canonical
SOURCE OF TRUTH: **the live site (catchemtcg.com, `catchem-site` Worker)**.
Machine-readable copies: research/brand/tokens.css + tokens.json —
REGENERATE with `node scripts/sync-brand-tokens.mjs` whenever the site
changes. Consumers: catchem-app imports tokens.css (build-time fetch from
this repo, committed fallback in src/tokens.css); generators read
tokens.json via scripts/lib/brand.mjs (rootCss()). Acceptance proven
2026-08-22: change a token → app bundle AND generated HTML both follow.
A11Y EXCEPTION (do not "sync away"): app secondary text --text-sub-app
#98a1b5, brighter than the site's #8a93a8 — Lighthouse contrast fix.
Drift log 2026-08-22: generate-board :root had #d8dde8 text + #ff6b7a red,
app index.html had #d8dde8 — all replaced by token reads the same day.
COLORS: primary/green #36d399 (CTAs, bolt, Collector) · blue #64a0ff
(Flipper, links) · purple #c77dff (Grader, premium) · gold #ffb84d
(HIGHLIGHTS/WARNINGS ONLY — never primary) · red #ef5a5a · bg #070910/
#0b0d14 · surface #141824 · raised #1c2235 · strong #232a40 · text
#f4f5f8 / #8a93a8 / #5c637a · borders white@7%/14%.
FONTS: Syne (display ≥32px only) · Sora (body/UI) · JetBrains Mono
(ALL numbers). Google Fonts link in every generated HTML.
RULES: dark-first · color=information · one accent per asset · NO
gradients/shadows/glows · ⚡ once per graphic, always left of wordmark,
apostrophe mandatory · never alter #36d399 · ≤3 colors per graphic.
DISCORD SIZES: icon 512² (⚡ only on #141824) · banner 960×540 · role
icons 64² mode-colored. Aug 18 drift log: Board/Pulse born #F5C842+
Trebuchet+gradients → FIXED same night; mockup suite + heatmap = batch
cleanup later (review artifacts, not living outputs).

## DESIGN SYSTEM — Deliverable 1 outcome (Claude Design, Aug 22; ruled by chat)
Design produced a page-grammar system. The canvas does not reach the
repo, so the decisions are recorded here — this text is the deliverable.

### THE PRINCIPLE (keep this sentence)
"The site and the app share the column, the section header, and the card.
The only thing that changes between surfaces is what fills the column —
prose on the site, card grids in the app. Nothing is restyled, only
re-packed."

### THE DESKTOP FIX (solves 'the app looks like a stretched phone')
Column-lock the app. Cards stay 300–400px and MULTIPLY inside the shared
820/1040 column; section headers span the column exactly as they do on
the site. Cards never grow to fill width. Mobile is unaffected — it is
the same card at one-per-row.

### SECTION HEADER (one treatment everywhere)
hairline rule → mono kicker (small, letterspaced) → Syne 28+.
Right slot flexes (a stat, a link, or nothing).

### CARD ANATOMY (six parts, fixed order)
photo · captioned hero number · Δ badge · ≤4 micro-stats · one plain
line · provenance chip.
FIXED: part order, card surface, padding, radius, header rule, kicker
register. FLEX: header right slot, stat count (2–4), photo presence.

### SPACING
Inside components: 6 / 10 / 14 / 16. Between sections: 32 / 40 / 56.
(Existing tokens stop at 16 because they were component air; page air
was missing and is now explicit.)

### TOKEN ADDITIONS — APPROVED (chat ruling, Aug 22)
- `section-space` 32/40/56 — page air, distinct from component gaps. ✅
- `num-xl` 40px JetBrains Mono — the index and Show Mode need a numeric
  register above card heroes, and Syne is display-only by law so it
  cannot carry digits. ✅
- `accent-dim` — accent colors at ~40% alpha for BORDERS only. ✅ WITH A
  LEASH: informational color without fills is the intent; it must never
  become decoration. "Color carries information, never decoration"
  still governs, and no-fills/no-gradients/no-glows are unchanged.

### TYPE
Nine-step scale, all digits in JetBrains Mono, Syne reserved for display
at 28px and above.

### CARD DENSITY — ONE CARD, TWO DENSITIES (Tyler approved, Aug 22)
The v3-vs-v5 question was never two designs; it was one card at two
densities, each right in a different place. Resolved as a RULE, not a
preference, so it never gets re-argued:

**EXPANDED — when three or fewer items share a screen.** All six parts,
including the plain-English line. Used on the Daily Three, product
pages, Deal Check. The reader has stopped to consider one thing, so the
explanation earns its height.

**COMPACT — when four or more items share a screen.** Same six parts,
same order, same tokens — the photo shrinks to a ~64px thumb and the
explanation collapses behind an ⓘ. Used on the Board, movers, watchlist,
heat. The eye is scanning, not reading.

WHY A COUNT AND NOT TASTE: every future screen answers itself without a
debate. It also satisfies both standing laws at once — the Digest Law
(glance, not read) via the compact form, and the Sandbox Rule (depth one
tap away) via the ⓘ rather than deletion. Nothing is removed, only
folded.
IMPLEMENTATION: one component, a `density` prop, and a per-screen rule.
Reference: research/assets/app-mockup-v6.html (real data, both densities,
both at 390px).
