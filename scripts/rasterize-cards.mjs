// rasterize-cards.mjs — SVG → PNG for every minted card.
// WHY THIS EXISTS: X, Instagram, and most social platforms reject SVG.
// Every card we minted for two days was unpostable. Runs after minting;
// PNGs land beside their SVGs. Remote images are inlined as data URIs
// first because rasterizers cannot fetch over the network.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARDS = join(ROOT, "research/pulse/cards");

let Resvg;
try { ({ Resvg } = await import("@resvg/resvg-js")); }
catch { console.log("· rasterize: @resvg/resvg-js not installed — skipping (npm i @resvg/resvg-js)"); process.exit(0); }

// Brand fonts, if vendored (research/brand/fonts/*.ttf). Without them the
// rasterizer falls back to a system face and the cards go off-brand.
let fontFiles = [];
try {
  const dir = join(ROOT, "research/brand/fonts");
  fontFiles = (await readdir(dir)).filter(f => /\.(ttf|otf)$/i.test(f)).map(f => join(dir, f));
} catch { /* not vendored yet */ }

async function inlineImages(svg) {
  const urls = [...svg.matchAll(/href="(https:\/\/[^"]+)"/g)].map(m => m[1]);
  for (const u of [...new Set(urls)]) {
    try {
      const r = await fetch(u);
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = r.headers.get("content-type") || "image/jpeg";
      svg = svg.replaceAll(`href="${u}"`, `href="data:${mime};base64,${buf.toString("base64")}"`);
    } catch (e) {
      // No photo beats a broken photo: drop the image element entirely.
      svg = svg.replace(new RegExp(`<image[^>]*href="${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`, "g"), "");
      console.log(`  · image unavailable, rendering without it (${e.message})`);
    }
  }
  return svg;
}

let files = [];
try { files = (await readdir(CARDS)).filter(f => f.endsWith(".svg")); } catch { process.exit(0); }
let made = 0;
for (const f of files) {
  try {
    const svg = await inlineImages(await readFile(join(CARDS, f), "utf-8"));
    const opts = { fitTo: { mode: "width", value: 1200 } };
    if (fontFiles.length) opts.font = { fontFiles, loadSystemFonts: true };
    const png = new Resvg(svg, opts).render().asPng();
    await writeFile(join(CARDS, f.replace(/\.svg$/, ".png")), png);
    made++;
  } catch (e) { console.log(`  ✗ ${f}: ${e.message}`); }
}
console.log(`✓ rasterized ${made}/${files.length} cards to PNG${fontFiles.length ? ` (brand fonts: ${fontFiles.length})` : " (system fonts — vendor brand fonts for on-brand type)"}`);
