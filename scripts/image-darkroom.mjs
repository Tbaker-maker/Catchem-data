// image-darkroom.mjs — make product photos belong on a dark page.
//
// Tyler, 2026-08-23: "give the visuals a black/dark photo to match, don't give
// it a white photo. It needs to blend and be more polished."
//
// Catalogue shots are photographed on white. On our surfaces that reads as a
// bright rectangle stapled to a dark page. CSS cannot fix it — every filter
// that darkens white also damages the product's own colours — so this does it
// in pixels: flood-fill the background from the edges and repaint it with the
// brand surface colour, leaving the product untouched.
//
// FLOOD FILL, not a colour swap: a global "replace all near-white" would also
// eat white ON the product — the border of a card, a logo, packaging text.
// Filling from the edges only reaches background that is connected to the
// frame, so interior whites survive.
// WHERE THIS DOES NOT WORK, and why there is a guard below.
// The fill can only separate product from backdrop when the product's edge is
// a real contrast edge. Light packaging breaks that: the 151 ETB and the
// Prismatic Evolutions ETB are photographed ON white AS white, so the box and
// the backdrop are one connected region of the same tone. The fill walks
// straight through the boundary and eats the product — measured 2026-08-22,
// the 151 box came back navy and the Prismatic wordmark was half consumed
// ("RISMATI", "VOLUTIONS"). Threshold tuning does NOT fix this, and the sweep
// is worth recording so nobody retries it:
//     floor 210  151 ETB 59% filled / 23% of the CENTRE eaten
//     floor 246  151 ETB 22% filled /  2% centre
//     floor 251  151 ETB  9% filled /  0% centre   ← product safe…
//     floor 255  151 ETB  7% filled /  0% centre   ← …but the backdrop is a
// soft studio white, not pure 255, so a floor strict enough to spare the
// product leaves most of the background unpainted and a hard seam around it,
// which looks worse than leaving the photo alone. There is no setting that
// gets both. Dark products are insensitive to the threshold (Black Bolt sits
// at 8-9% across the whole sweep), which is the real tell: this technique is
// safe for dark packaging and unsafe for light, and the guard decides which
// case it is by measurement rather than by hoping.
import sharp from "sharp";

const SURFACE = { r: 0x14, g: 0x18, b: 0x24 };   // --surface #141824
const NEAR_WHITE = 236;                           // channel floor counted as background
const MAX_SPREAD = 26;                            // tolerance while walking outward
// Catalogue shots centre their product, so background must never reach the
// middle of the frame. If the fill lands there it has breached the product,
// and the only safe move is to hand back the original untouched. Measured
// over 12 real photos the separation is total: every damaged frame filled
// 23-44% of this box, every clean one filled exactly 0%.
const CENTRE_BOX = 0.30;                          // inset defining "the middle"
const CENTRE_TOLERANCE = 1;                       // % of the centre box, above which we bail

export async function darkenBackground(buffer, surface = SURFACE) {
  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const idx = (x, y) => (y * w + x) * ch;

  // Seed from every edge pixel that already looks like background.
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push([x, 0], [x, h - 1]); }
  for (let y = 0; y < h; y++) { stack.push([0, y], [w - 1, y]); }

  const cx0 = Math.floor(w * CENTRE_BOX), cx1 = Math.ceil(w * (1 - CENTRE_BOX));
  const cy0 = Math.floor(h * CENTRE_BOX), cy1 = Math.ceil(h * (1 - CENTRE_BOX));
  let filled = 0, centreHits = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (seen[p]) continue;
    const i = idx(x, y);
    // tolerate a soft edge: anything close to white keeps the fill walking
    if (!(data[i] >= NEAR_WHITE - MAX_SPREAD && data[i + 1] >= NEAR_WHITE - MAX_SPREAD && data[i + 2] >= NEAR_WHITE - MAX_SPREAD)) continue;
    seen[p] = 1;
    data[i] = surface.r; data[i + 1] = surface.g; data[i + 2] = surface.b;
    filled++;
    if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) centreHits++;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const coverage = Math.round(filled / (w * h) * 100);
  const centrePct = Math.round(centreHits / Math.max(1, (cx1 - cx0) * (cy1 - cy0)) * 100);
  if (centrePct > CENTRE_TOLERANCE) {
    // Coverage is reported as 0 so callers that only range-check it (the
    // rasterizer did) fall back to the original photo rather than shipping a
    // repainted product.
    return { buffer, filledPixels: 0, coverage: 0, centrePct, skipped: true,
      reason: `light packaging — the fill reached ${centrePct}% of the centre, so the product itself would have been repainted` };
  }

  const out = await sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  return { buffer: out, filledPixels: filled, coverage, centrePct, skipped: false };
}

// CLI smoke test: node scripts/image-darkroom.mjs <url>
// pathToFileURL, not `file://${argv[1]}` — the template form never matches on
// Windows (drive letters and backslashes), so the smoke test silently did
// nothing on this machine. os.tmpdir() for the same reason: /tmp is Linux-only.
if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href && process.argv[2]) {
  const { writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const r = await fetch(process.argv[2]);
  const buf = Buffer.from(await r.arrayBuffer());
  const { buffer, coverage, centrePct, skipped, reason } = await darkenBackground(buf);
  const dest = join(tmpdir(), "darkroom-test.png");
  await writeFile(dest, buffer);
  if (skipped) console.log(`· left alone (${reason}) → original written to ${dest}`);
  else {
    console.log(`✓ background repainted — ${coverage}% filled, ${centrePct}% of centre → ${dest}`);
    console.log(coverage < 5 ? "  ⚠ almost nothing filled: the source may already be dark, or the product touches every edge"
      : "  coverage looks plausible; a human still has to look");
  }
}
