# Full-Circuit Debut Audit — 2026-08-19 (07:54 UTC dispatch run)
First production pass with the whole machine on: 168 products, pricing-v2
(BIN-only delivered + clean floor), loose-pack lane, rep-images, sealed
premiums, Spread on the 104-crosscheck universe, era indexes.

## 1 · Loose-pack lane — 15/15 live, zero bounds violations
All medians inside [2.50, 75]. The four Aug-18-validated SKUs are unchanged
or within cents — day-2 stability confirmed:

| SKU | Aug 18 (validated) | today | n |
|---|---|---|---|
| swsh7-pack | $55 | $54.95 | 64 |
| me2-pack | $15 | $15.00 | 24 |
| sv8pt5-pack | $16.50 | $16.50 | 22 |
| sv9-pack | $8.99 | $8.99 | 20 |

Full lane: swsh5 $11.99 · swsh6 $16 · swsh7 $54.95 · swsh8 $23.95 · sv1 $12.80
· sv3pt5 $31.99 · sv4 $11.99 · sv8 $9.99 · sv8pt5 $16.50 · sv9 $8.99 · sv10
$10.35 · me1 $9.39 · me2 $15 · me2pt5 $15.99 · me3 $8.29.
⚠ Only flag: **me1-pack n=7** — thinnest lane input, and it powers every ME1
premium. Not wrong, just watch it (a couple of junk listings could move it).

## 2 · Sealed premiums — 49 populated
Signed extremes (per-pack vs same-set loose lane, all math spot-verified):
- **Top:** sv10-pc-etb **+481%** ($541.28/9 = $60.14 vs $10.35 loose) ·
  sv3pt5-pc-etb +440% · sv8pt5-pc-etb +274%. PC-ETBs carrying the biggest
  collector premium is the expected shape.
- **Bottom:** me3-booster-box **-33%** ($199/36 = $5.53 vs $8.29) ·
  sv1-booster-box -28% · swsh5-booster-box -26% ($320/36 = $8.89 vs $11.99).
  Negative = sealed bulk discount. In-print ME going negative is textbook;
  **swsh5 (Battle Styles, 65mo old) at -26% is the odd one** — either the
  loose lane runs hot (slab-adjacent pack collectors) or the box is cheap
  for its age. Flag for Tyler's read, not forced either way.

## 3 · Rep-image coverage — 153/168 (91%), which is 100% of live
Every live product carries an eBay photo. The 15 without are exactly the
14 no-active-market + 1 unavailable — no photo because no listings. Nothing
to fix; the gap IS the honest signal.

## 4 · The Spread day-2 — 104 universe, 24 signals
Yesterday 25 signals → today 24; universe steady at 104 (105 crosscheck rows
minus 1 non-live). Top: sm1-etb +58.1%, sm35-etb +56.6%, sm4-booster-box
+52.4% — S&M-era eBay premium persists day-over-day (same read as yesterday's
S&M squeeze). Bottom: xy12-etb -11.2%, sm2-booster-box -9.6% — small negative
tail exists, instrument is signed and honest. No sign-flips vs day-1 spotted
in the top cohort. (PPT-side numbers remain publication-gated; this section
is internal audit.)

## 5 · Daily Three + depth reads — day-2 populated
Sealed: Prismatic Evolutions Surprise Box · Graded: Umbreon ex (gated:true,
renders locked) · Raw: Umbreon VMAX. Depth reads: 6 products. All slots full,
no empty-state regressions.

## 6 · Era index — day-1 entries appended correctly
5 eras × 1 date (2026-08-19 baseline), zero duplicates in both
data/era-index-history.json and the research/pulse mirror despite the pulse
step running 3× today (CI dispatch + two session runs) — merge-by-date held.
Day-2 entries land tomorrow 04:00 UTC; momentum lines start then.

## Verdict
Full circuit is live and internally consistent on debut. Watch items:
me1-pack thinness (n=7), swsh5 negative premium (Tyler read), day-2 era
append tomorrow.
