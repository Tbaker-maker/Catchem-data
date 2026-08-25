// layouts.mjs — the frame for each card count.
//
// THE RULE: choose the column count that MAXIMISES card size subject to
// H/W <= 1.15, and never leave a ragged final row.
//
// WHY 1.15 AND NOT 1.25: X crops in the timeline at about 1.25, and I
// originally targeted that number exactly. **Designing to a limit means failing
// at the limit** — any rounding, any device pixel ratio, any difference in where
// X actually cuts, and the top clips, which is precisely what Tyler saw. 1.15
// leaves an 8% margin and costs three points of card size, 36% down to 33%.
// Every user we have is on X, so this is not an edge case, it is the only case.
export const PAD = 90;
export const GAP = 60;
export const CAPTION = 110;
export const SAFE_RATIO = 1.15;
export const CARD_RATIO = 745 / 1040;

export const LAYOUTS = {
  1: { name: "the single", cols: 1, rows: 1, cardW: 745, cardCaption: 70,
    W: 1217, H: 1400, ratio: 1.15, cardShare: 61, widened: true,
    why: "one card, one claim" },
  2: { name: "the pairing", cols: 2, rows: 1, cardW: 745, cardCaption: 70,
    W: 1730, H: 1400, ratio: 0.81, cardShare: 43, widened: false,
    why: "the shape that did 127,200 views" },
  3: { name: "the trio", cols: 3, rows: 1, cardW: 745, cardCaption: 70,
    W: 2535, H: 1400, ratio: 0.55, cardShare: 29, widened: false,
    why: "3 across — 2+1 leaves a ragged row and reads as a mistake" },
  4: { name: "the square", cols: 2, rows: 2, cardW: 745, cardCaption: 70,
    W: 2235, H: 2570, ratio: 1.15, cardShare: 33, widened: true,
    why: "2x2, widened to sit clear of the crop rather than exactly on it" },
  6: { name: "the half page", cols: 3, rows: 2, cardW: 745, cardCaption: 0,
    W: 2535, H: 2430, ratio: 0.96, cardShare: 29, widened: false,
    why: "3 across, 2 rows" },
  8: { name: "the spread", cols: 4, rows: 2, cardW: 745, cardCaption: 0,
    W: 3340, H: 2430, ratio: 0.73, cardShare: 22, widened: false,
    why: "4 across — 8 does not divide by 3 without a ragged row" },
  9: { name: "the binder page", cols: 3, rows: 3, cardW: 745, cardCaption: 0,
    W: 3070, H: 3530, ratio: 1.15, cardShare: 24, widened: true,
    why: "3x3, the page everybody already knows" },
};

export function frameFor(n) {
  const l = LAYOUTS[n];
  if (l) return l;
  const supported = Object.keys(LAYOUTS).map(Number);
  const below = supported.filter(x => x < n).pop(), above = supported.find(x => x > n);
  throw new Error(`no frame for ${n} cards. Nearest: ${[below, above].filter(Boolean).join(" or ")}.`);
}
