# Ticker Polish Spec v1 — "hard to read and cheap" → shippable
Verdict (Tyler, Aug 18, first live viewing): functional, unpolished.
Goal: pass THE SCREENSHOT TEST — would a collector screenshot this
unprompted? Deadline-shaped, not deadlined: the arc's "Meet The Ticker"
beat (currently Day 5, Aug 23) points at the app; if polish isn't ready,
we reorder beats — arc is modular. No heroics.

## P0 — the five cheap-killers (in order of visual ROI)
1. TYPOGRAPHY ACTUALLY LOADED. index.html must carry the Google Fonts
   link (Syne 700/800 · Sora 400/600/700 · JetBrains Mono 400/700) +
   font-display:swap. Verify in devtools Network tab — if Sora isn't
   downloading, nothing else matters. Syne ONLY ≥28px (display moments:
   the wordmark, section heads). Sora everywhere else. JetBrains Mono
   for EVERY number, tabular-nums on.
2. SPACING SCALE. 8px base grid: 8/12/16/24/32/48. Card padding ≥16px,
   section gaps ≥32px, line-height 1.5 body / 1.2 display. The current
   build reads dense because everything sits at ~8px gaps. Air = expensive-looking.
3. HIERARCHY. Per card: ONE hero number (Mono 22-28px bold) · label above
   it (11px uppercase letterspaced 0.08em, --dim) · one-line reason
   (13px Sora, --dim) · chip top-right. Nothing else. If a card has two
   competing numbers, demote one to the drawer.
4. COLOR DISCIPLINE. Background #0b0d14, cards #141824, raised #1c2235.
   ONE accent per card, earned: green=confirmed/live, gold=signal ONLY,
   purple=graded contexts, red=negative gaps. Everything else neutral.
   Borders: white@7% — never solid gray lines.
5. SCAFFOLD SCRUB. <title>Catch'em — The Ticker</title>, real favicon
   (⚡ on #141824, 32px), meta theme-color #0b0d14, og:title/description,
   remove Vite boilerplate, loading state = brand-colored skeleton
   shimmer (no spinners), empty states written in voice ("calibrating —
   day 2 of 3") not "No data".

## P1 — feel
6. Tap targets ≥44px; card press-state (scale .98, 80ms); drawer slides
   with 200ms ease-out; sticky top bar with wordmark ⚡ Catch'em (Syne)
   + date; safe-area insets for phones.
7. Numbers animate on change (200ms count) — subtle, once.
8. Section rhythm: panel strip → Daily Three (hero cards, larger) →
   signals (list) → depth → catalysts. Daily Three gets 1.25× card scale;
   it's the front door.
9. Images: card art 3:4 with 8px radius; product photos on #0b0d14 pad;
   lazy-load below fold; explicit width/height (no layout shift).

## Acceptance
- Screenshot test on a phone: does it look like a product you'd pay for?
- Lighthouse mobile ≥90 perf/a11y.
- Zero fonts falling back; zero default-blue links; zero "Vite" strings.
- Tyler approves from HIS phone before the arc beat points at it.

## Process
CC executes as a dedicated session (not stacked on the six data blocks).
Screenshots from Tyler (desktop + phone) calibrate before starting —
spec written from known failure modes; verify against reality first.
