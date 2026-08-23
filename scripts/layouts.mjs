// layouts.mjs — one frame per card count, decided once.
//
// Tyler, 2026-08-23: "Make formats for 1, 2, 3, 4, 6, 8, 9 cards. All in one
// image frame, sized accordingly. Super clean and professional. Safeguard it so
// it's simple for users."
//
// Every count gets a fixed, measured layout so nobody — human or machine — has
// to make a layout decision at post time. A decision made at post time is a
// decision made in a hurry, and every visual we got wrong today was one of
// those.
//
// THE CONSTRAINT THAT DECIDED THE COLUMNS: X crops a single image past roughly
// 4:5 (1.25:1) in the timeline. A Pokémon card is 1.40:1 on its own, so column
// counts are chosen for FIT rather than for habit — four cards go in ONE ROW,
// not a 2x2, because a 2x2 of tall cards lands at 1.45 and gets cut. The one
// exception is nine, which is 1.44 by nature: a binder page is three by three
// and changing that to fit a timeline would be changing the thing itself.
//
// SUPPORTED COUNTS ONLY. Five and seven are deliberately absent — they leave a
// ragged final row, which reads as a mistake rather than as a choice.

export const LAYOUTS = {
  1: { cols: 1, cardW: 520, minW: 818, name: "the single",
       use: "one card carrying one fact. The knowledge post — Kadabra's twenty-one years needs exactly one image." },
  2: { cols: 2, cardW: 430, name: "the pairing",
       use: "two cards in conversation. Same artist across eras, same Pokémon by different hands." },
  3: { cols: 3, cardW: 330, name: "the trio",
       use: "a natural three — the legendary birds, the weather trio, a starter line." },
  4: { cols: 4, cardW: 300, name: "the row",
       use: "four across, NOT a 2x2. A 2x2 of portrait cards lands at 1.45:1 and gets cropped in the feed." },
  6: { cols: 3, cardW: 300, name: "the half page",
       use: "three by two. Half a binder page, and it sits almost square." },
  8: { cols: 4, cardW: 250, name: "the spread",
       use: "four by two. The widest count that still reads at phone size." },
  9: { cols: 3, cardW: 270, name: "the binder page",
       use: "three by three, the shape every collector already knows. Runs 1.44:1 — slightly tall for the timeline, and worth it because the shape IS the message." },
};

export const PAD = 44, GAP = 18, CAPTION = 86, CARD_RATIO = 1040 / 745;

export function frameFor(count) {
  const L = LAYOUTS[count];
  if (!L) return null;
  const rows = Math.ceil(count / L.cols);
  const cardH = Math.round(L.cardW * CARD_RATIO);
  const w = Math.max(L.minW ?? 0, PAD * 2 + L.cardW * L.cols + GAP * (L.cols - 1));
  const h = PAD * 2 + cardH * rows + GAP * (rows - 1) + CAPTION;
  return { ...L, count, rows, cardH, w, h, ratio: Math.round(h / w * 100) / 100,
    // Stated per layout rather than assumed, so anybody reading the output knows
    // whether the frame they are about to post will survive the timeline.
    timeline: h / w <= 1.30 ? "shows whole" : h / w <= 1.45 ? "slightly tall, shows nearly whole" : "WILL CROP" };
}

// The safeguard Tyler asked for: an unsupported count fails loudly with the
// nearest workable options, rather than silently producing a ragged frame.
export function assertSupported(count) {
  if (LAYOUTS[count]) return frameFor(count);
  const options = Object.keys(LAYOUTS).map(Number);
  const below = options.filter(n => n < count).pop();
  const above = options.find(n => n > count);
  throw new Error(
    `${count} cards has no layout. Supported: ${options.join(", ")}. ` +
    `${below ? `Drop to ${below}` : ""}${below && above ? " or " : ""}${above ? `add ${above - count} to reach ${above}` : ""}. ` +
    `Five and seven are deliberately unsupported — they leave a ragged final row, which reads as a mistake rather than a choice.`);
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  console.log("  count  layout            frame        ratio  timeline\n");
  for (const n of Object.keys(LAYOUTS).map(Number)) {
    const f = frameFor(n);
    console.log(`  ${String(n).padStart(5)}  ${f.name.padEnd(16)}  ${`${f.w}x${f.h}`.padEnd(11)}  ${String(f.ratio).padEnd(5)}  ${f.timeline}`);
  }
  console.log("\n  unsupported counts fail loudly:");
  for (const n of [5, 7]) { try { assertSupported(n); } catch (e) { console.log(`   ${n}: ${e.message.slice(0, 96)}…`); } }
}
