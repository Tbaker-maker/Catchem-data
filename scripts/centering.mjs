// centering.mjs — turn a card image into the four margins centering-math needs.
//
// centering-math.mjs is pure and already tested against PSA's worked examples.
// It takes {left,right,top,bottom} and returns ratios, a ceiling and a
// submission read. This is the part that has to touch pixels, and it is kept
// separate for exactly that reason: geometry that can be checked by hand should
// not live in the same file as arithmetic that can be checked by proof.
//
// WHAT IS BEING MEASURED. On a modern Pokemon card the centering everyone
// argues about is the width of the coloured BORDER around the card face —
// left border versus right border, top versus bottom. So the job is two edges
// per side: the outer edge of the card, and the inner edge where the border
// stops and the card content begins.
//
// EVERY MEASUREMENT RETURNS THE COORDINATES IT CAME FROM. verify-work's rule
// applies to a ratio exactly as it applies to a price: a number that cannot say
// where it came from is not defensible. The caller gets the detected edges so a
// reader can put a ruler on the image and disagree.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A border pixel is strongly yellow: red and green high and close together,
// blue clearly lower. Thresholds are deliberately loose — holo scatter and
// phone white-balance both shift these, and a tight threshold would look
// precise while failing on exactly the cards people photograph.
const isBorder = (r, g, b) =>
  r > 120 && g > 100 && b < Math.min(r, g) - 40 && Math.abs(r - g) < 70;

// Scan one line inward and report where the border stops. Requires a RUN of
// non-border pixels, not a single one: a single stray pixel is holo speckle or
// a JPEG artifact, and treating it as an edge is how a measurement drifts.
function borderRun(px, w, startIdx, step, count, run = 4) {
  let consecutiveNonBorder = 0, lastBorder = -1;
  for (let n = 0, i = startIdx; n < count; n++, i += step) {
    const o = i * 4;
    if (isBorder(px[o], px[o + 1], px[o + 2])) { consecutiveNonBorder = 0; lastBorder = n; }
    else if (++consecutiveNonBorder >= run) return lastBorder + 1;   // width in px
  }
  return null;
}

export async function measure(imagePath) {
  const sharp = (await import("sharp")).default;
  const img = sharp(imagePath).ensureAlpha();
  const { width: w, height: h } = await img.metadata();
  const { data: px } = await img.raw().toBuffer({ resolveWithObject: true });

  // Sample several lines per side and take the MEDIAN. One line through a
  // holo streak or a set symbol gives a confident wrong answer; the median of
  // nine is stable and the spread is itself the confidence signal.
  const at = (x, y) => y * w + x;
  const lines = 9;
  const rowYs = Array.from({ length: lines }, (_, i) => Math.round(h * (i + 1) / (lines + 1)));
  const colXs = Array.from({ length: lines }, (_, i) => Math.round(w * (i + 1) / (lines + 1)));
  const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  // ROBUST SPREAD, NOT MAX-MINUS-MIN. The first version used the full range and
  // called almost everything low confidence — Base Set Charizard scored a 26px
  // spread on samples of [45,19,22,19,19,19,21,20,19]. One line out of nine hit
  // the 1st-edition stamp and ran deep; the other eight agreed within 3px, and
  // the median was correct to the pixel (confirmed by overlaying the detected
  // box on the image). A single outlier must not outvote eight agreeing lines,
  // so this is the median absolute deviation, which ignores it.
  const spread = a => {
    const s = a.filter(v => v != null).sort((x, y) => x - y);
    if (!s.length) return null;
    const m = s[Math.floor(s.length / 2)];
    const dev = s.map(v => Math.abs(v - m)).sort((x, y) => x - y);
    return dev[Math.floor(dev.length / 2)];
  };

  const L = rowYs.map(y => borderRun(px, w, at(0, y), 1, Math.floor(w / 2)));
  const R = rowYs.map(y => borderRun(px, w, at(w - 1, y), -1, Math.floor(w / 2)));
  const T = colXs.map(x => borderRun(px, w, at(x, 0), w, Math.floor(h / 2)));
  const B = colXs.map(x => borderRun(px, w, at(x, h - 1), -w, Math.floor(h / 2)));

  const left = med(L), right = med(R), top = med(T), bottom = med(B);
  if ([left, right, top, bottom].some(v => v == null))
    return { ok: false, why: "could not find a border on every side — not a bordered card, or the crop cuts the border" };

  // The spread across sample lines IS the confidence. A wide spread means the
  // lines disagreed, which is what a holo streak or a bad crop looks like, and
  // the tool must say so rather than return a number that looks like the others.
  const worstSpread = Math.max(spread(L), spread(R), spread(T), spread(B));
  return {
    ok: true,
    margins: { left, right, top, bottom },
    // The evidence, so a reader can check us against the file itself.
    edges: { imageWidth: w, imageHeight: h,
      leftInnerX: left, rightInnerX: w - right, topInnerY: top, bottomInnerY: h - bottom },
    samples: { left: L, right: R, top: T, bottom: B },
    spreadPx: worstSpread,
    confidence: worstSpread <= 1 ? "high" : worstSpread <= 3 ? "medium" : "low",
    note: worstSpread > 3
      ? "The sample lines disagreed by more than 3px (median absolute deviation). Treat this as unmeasured rather than as a ratio."
      : null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { centering } = await import("./centering-math.mjs");
  for (const p of process.argv.slice(2)) {
    const m = await measure(p);
    if (!m.ok) { console.log(`  ✗ ${p}: ${m.why}`); continue; }
    const c = centering(m.margins);
    console.log(`  ${p.split(/[\\/]/).pop()}`);
    if (!c) { console.log(`     ✗ margins ${JSON.stringify(m.margins)} — a zero or negative margin, so no ratio exists`); continue; }
    console.log(`     margins L${m.margins.left} R${m.margins.right} T${m.margins.top} B${m.margins.bottom}`
      + `  ->  ${c.leftRight}/${(100 - c.leftRight).toFixed(1)} L-R · ${c.topBottom}/${(100 - c.topBottom).toFixed(1)} T-B`
      + `  · spread ${m.spreadPx}px (${m.confidence})`);
  }
}
