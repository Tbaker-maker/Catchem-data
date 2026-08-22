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
