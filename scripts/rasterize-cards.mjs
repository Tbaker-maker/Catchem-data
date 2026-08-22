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

// NEVER process.exit() here. generate-pulse imports this module as one link
// in a chain that ends with voice-lint, jargon-lint and publish-assert, and
// an exit(0) from an imported module ends the WHOLE run with a success code —
// silently skipping the publication assert, the last line of defence, while
// CI reports green. Only the vendored resvg binary is linux-x64, so every
// local run took that path: found 2026-08-22 when the assert stopped printing
// and the pipeline still exited 0. A skipped step must skip its own work and
// hand control back, not take the process with it.
let Resvg = null;
try { ({ Resvg } = await import("@resvg/resvg-js")); }
catch { console.log("· rasterize: @resvg/resvg-js not available here — skipping PNGs, pipeline continues"); }

// Brand fonts, if vendored (research/brand/fonts/*.ttf). Without them the
// rasterizer falls back to a system face and the cards go off-brand.
let fontFiles = [];
try {
  const dir = join(ROOT, "research/brand/fonts");
  fontFiles = (await readdir(dir)).filter(f => /\.(ttf|otf)$/i.test(f)).map(f => join(dir, f));
} catch { /* not vendored yet */ }

const IMG_TIMEOUT_MS = Number(process.env.IMG_TIMEOUT_MS || 15000);
// Magic numbers only — a content-type header is a claim, not evidence.
function looksLikeImage(b) {
  if (!b || b.length < 12) return false;
  const h = b.subarray(0, 12);
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return true;                       // JPEG
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return true;      // PNG
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) return true;                       // GIF
  if (h.subarray(0, 4).toString("ascii") === "RIFF" && h.subarray(8, 12).toString("ascii") === "WEBP") return true;
  return false;
}

async function inlineImages(svg) {
  const urls = [...svg.matchAll(/href="(https:\/\/[^"]+)"/g)].map(m => m[1]);
  for (const u of [...new Set(urls)]) {
    try {
      // TIMEOUT: node's fetch has none, and an image host that accepts the
      // connection then never answers hangs the whole daily run. Proven
      // 2026-08-22 against a deliberately slow host — the bare fetch below sat
      // past 20s and only an artificial race stopped it. A hung pipeline is
      // worse than a failed one: nothing goes red, the job just burns out.
      const r = await fetch(u, { signal: AbortSignal.timeout(IMG_TIMEOUT_MS) });
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      // AND THE BYTES MUST ACTUALLY BE AN IMAGE. A 200 with content-type
      // image/jpeg whose body is text passes every check above — the fetch
      // succeeded, so the outer "no photo beats a broken photo" catch never
      // fires, and the garbage gets base64'd into the card as a data URI.
      // Proven the same day: 45 bytes of plain text sailed through and only
      // the darkroom noticed, whose failure is swallowed by design. Header
      // sniffing needs no dependency and cannot be fooled by a content-type.
      if (!looksLikeImage(buf)) throw new Error(`not an image (${buf.length}B, header ${buf.subarray(0, 4).toString("hex")})`);
      // Repaint white catalogue backgrounds to the brand surface so product
      // photos belong on a dark card instead of punching a white hole in it
      // (Tyler, 2026-08-23). Flood-filled from the edges, so whites INSIDE the
      // product survive. Skipped silently if it fails — a plain photo beats none.
      let painted = buf;
      // The darkroom refuses light packaging itself (it can't repaint a white
      // box without eating it), so respect `skipped` rather than judging by
      // coverage alone — the 151 ETB filled 59% and passed the old range check
      // while arriving with its own box painted navy.
      try { const { darkenBackground } = await import("./image-darkroom.mjs");
        const res = await darkenBackground(buf);
        if (!res.skipped && res.coverage > 5 && res.coverage < 85) painted = res.buffer;
        else if (res.skipped) console.log(`  · darkroom skipped a photo: ${res.reason}`);
      } catch {}
      const mime = "image/png";
      svg = svg.replaceAll(`href="${u}"`, `href="data:${mime};base64,${painted.toString("base64")}"`);
    } catch (e) {
      // No photo beats a broken photo: drop the image element entirely.
      svg = svg.replace(new RegExp(`<image[^>]*href="${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`, "g"), "");
      globalThis.__imgFails = (globalThis.__imgFails || 0) + 1;
      console.log(`  · image unavailable, rendering without it (${e.message})`);
    }
  }
  return svg;
}

let files = [];
// Same rule: an unreadable cards directory skips the PNGs, it does not end
// the run (this catch used to exit(0) and would have taken CI down with it).
if (Resvg) {
  try { files = (await readdir(CARDS)).filter(f => f.endsWith(".svg")); } catch { files = []; }
}
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
// BINDER_ART_CHECK: a binder page with no art is a broken post. If any
// card image failed to inline on a binder page, say so loudly.
if (files.some(f => f.includes("binder")) && globalThis.__imgFails > 0)
  console.warn(`  ⚠ ${globalThis.__imgFails} card image(s) failed on a binder page — DO NOT POST until re-run with network access`);
await (await import("./heartbeat.mjs")).beat("cards");
console.log(`✓ rasterized ${made}/${files.length} cards to PNG${fontFiles.length ? ` (brand fonts: ${fontFiles.length})` : " (system fonts — vendor brand fonts for on-brand type)"}`);
