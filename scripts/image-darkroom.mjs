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
import sharp from "sharp";

const SURFACE = { r: 0x14, g: 0x18, b: 0x24 };   // --surface #141824
const NEAR_WHITE = 236;                           // channel floor counted as background
const MAX_SPREAD = 26;                            // tolerance while walking outward

export async function darkenBackground(buffer, surface = SURFACE) {
  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const idx = (x, y) => (y * w + x) * ch;
  const isBg = (i) => data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE;

  // Seed from every edge pixel that already looks like background.
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push([x, 0], [x, h - 1]); }
  for (let y = 0; y < h; y++) { stack.push([0, y], [w - 1, y]); }

  let filled = 0;
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
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const out = await sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  return { buffer: out, filledPixels: filled, coverage: Math.round(filled / (w * h) * 100) };
}

// CLI smoke test: node scripts/image-darkroom.mjs <url>
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) {
  const r = await fetch(process.argv[2]);
  const buf = Buffer.from(await r.arrayBuffer());
  const { buffer, coverage } = await darkenBackground(buf);
  const { writeFile } = await import("node:fs/promises");
  await writeFile("/tmp/darkroom-test.png", buffer);
  console.log(`✓ background repainted — ${coverage}% of the frame filled → /tmp/darkroom-test.png`);
  console.log(coverage < 5 ? "  ⚠ almost nothing filled: the source may already be dark, or the product touches every edge"
    : coverage > 85 ? "  ⚠ nearly everything filled: the product may have been eaten — a human must look" : "  coverage looks plausible; a human still has to look");
}
