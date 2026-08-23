// layouts.mjs — the frame for each card count.
//
// THE RULE: choose the column count that MAXIMISES card size subject to
// H/W <= 1.25, and never leave a ragged final row.
//
// 1.25 is where X crops in the timeline. Everything here shows whole.
//
// WHY 4 IS A SQUARE AND NOT A ROW (Tyler, 2026-08-23): a row of four shows
// whole and each card is 22% of the frame, which is small and bulky at once. A
// 2x2 at its natural width crops at 1.49 — so the frame is WIDENED to 2056,
// which lands at exactly 1.25 and puts each card at 36%. Half again as large,
// still whole. Widening was the move neither the row nor the square had on its
// own.
export const PAD = 90;
export const GAP = 60;
export const CAPTION = 110;
export const CARD_RATIO = 745 / 1040;

export const LAYOUTS = {
  1: { name: "the single", cols: 1, rows: 1, cardW: 745, cardCaption: 70,
    W: 1120, H: 1400, ratio: 1.25, cardShare: 67, widened: true,
    why: "one card, one claim" },
  2: { name: "the pairing", cols: 2, rows: 1, cardW: 745, cardCaption: 70,
    W: 1730, H: 1400, ratio: 0.81, cardShare: 43, widened: false,
    why: "the shape that did 18,800 views" },
  3: { name: "the trio", cols: 3, rows: 1, cardW: 745, cardCaption: 70,
    W: 2535, H: 1400, ratio: 0.55, cardShare: 29, widened: false,
    why: "3 across — 2+1 leaves a ragged row and reads as a mistake" },
  4: { name: "the square", cols: 2, rows: 2, cardW: 745, cardCaption: 70,
    W: 2056, H: 2570, ratio: 1.25, cardShare: 36, widened: true,
    why: "2x2, frame widened to clear the crop. 36% card vs 22% in a row" },
  6: { name: "the half page", cols: 3, rows: 2, cardW: 745, cardCaption: 0,
    W: 2535, H: 2430, ratio: 0.96, cardShare: 29, widened: false,
    why: "3 across, 2 rows" },
  8: { name: "the spread", cols: 4, rows: 2, cardW: 745, cardCaption: 0,
    W: 3340, H: 2430, ratio: 0.73, cardShare: 22, widened: false,
    why: "4 across — 8 does not divide by 3 without a ragged row" },
  9: { name: "the binder page", cols: 3, rows: 3, cardW: 745, cardCaption: 0,
    W: 2824, H: 3530, ratio: 1.25, cardShare: 26, widened: true,
    why: "3x3, the page everybody already knows" },
};

export function frameFor(n) {
  const l = LAYOUTS[n];
  if (l) return l;
  const supported = Object.keys(LAYOUTS).map(Number);
  const below = supported.filter(x => x < n).pop(), above = supported.find(x => x > n);
  // Fail loudly and name the nearest options. A ragged final row reads as a
  // mistake, so an unsupported count is refused rather than approximated.
  throw new Error(`no frame for ${n} cards. Nearest: ${[below, above].filter(Boolean).join(" or ")}.`);
}
