// mint-social-card.mjs — the photo-forward share card.
// Different from the stat cards: the PRODUCT is the hero, numbers ride
// on top. Built for a thumb scrolling at speed. 1200×675 (X/IG safe).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// wrapText — rasterizer-safe line breaking. foreignObject is NOT supported
// by SVG rasterizers (resvg/librsvg silently drop it), which cost us a
// card's title and hook on the first PNG export. Pure <text>/<tspan> only.
function wrapText(str, { x, y, width, size, fill, weight = 400, lineHeight = 1.3, maxLines = 3 }) {
  const words = String(str || "").split(/\s+/).filter(Boolean);
  const charW = size * 0.54; // Sora average advance, empirically close enough
  const perLine = Math.max(8, Math.floor(width / charW));
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= perLine) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w; }
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (!lines.length) return "";
  const esc2 = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}">` +
    lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lineHeight}">${esc2(l)}</tspan>`).join("") + `</text>`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function socialCard({ img, title, hero, heroLabel, stats = [], hook, chip = "VERIFIED", date, accent = "#36d399" }) {
  const W = 1200, H = 675;
  const statCells = stats.slice(0, 3).map((s, i) => `
    <g transform="translate(${560 + i * 200}, 470)">
      <rect width="180" height="86" rx="14" fill="#1c2235" stroke="rgba(255,255,255,0.07)"/>
      <text x="16" y="32" fill="#98a1b5" font-size="17" font-weight="600">${esc(s.label)}</text>
      <text x="16" y="66" fill="#f4f5f8" font-size="27" font-weight="700" font-family="JetBrains Mono,monospace">${esc(s.value)}</text>
    </g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Sora,system-ui,sans-serif">
<defs><clipPath id="ph"><rect x="60" y="60" width="440" height="555" rx="22"/></clipPath></defs>
<rect width="${W}" height="${H}" fill="#070910"/>
<rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="30" fill="#0b0d14" stroke="rgba(255,255,255,0.06)"/>
<rect x="60" y="60" width="440" height="555" rx="22" fill="#141824"/>
${img ? `<image href="${esc(img)}" x="60" y="60" width="440" height="555" preserveAspectRatio="xMidYMid slice" clip-path="url(#ph)"/>` : ""}
<rect x="60" y="60" width="440" height="555" rx="22" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
<text x="560" y="120" fill="#98a1b5" font-size="20" letter-spacing="5" font-weight="700">${esc(heroLabel)}</text>
${wrapText(title, { x: 560, y: 180, width: 580, size: 38, fill: "#f4f5f8", weight: 700, maxLines: 2 })}
<text x="560" y="360" fill="${accent}" font-size="96" font-weight="800" font-family="JetBrains Mono,monospace">${esc(hero)}</text>
${hook ? wrapText(hook, { x: 560, y: 410, width: 580, size: 25, fill: "#98a1b5", weight: 400, maxLines: 2 }) : ""}
${statCells}
<text x="60" y="${H - 12}" fill="#36d399" font-size="26" font-weight="800">⚡</text><text x="96" y="${H - 12}" fill="#36d399" font-size="26" font-weight="800" font-family="Syne,Sora,sans-serif">Catch'em</text>
<text x="${W - 60}" y="${H - 12}" text-anchor="end" fill="#5c637a" font-size="20" font-family="JetBrains Mono,monospace">${esc(chip)} · ${esc(date)} · USD · catchemtcg.com</text>
</svg>`;
}

// Mint today's social card from the queue's midday/morning subject.
// Exported: the old `file://argv[1]` CLI guard was false under the
// pipeline import AND on Windows paths — no social card ever minted in CI.
export async function mintSocialCard() {
  const der = await J("data/derived-insights.json") ?? {};
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const cm = await J("data/crosscheck-id-map.json") ?? { entries: [] };
  const tcg = {}; for (const e of cm.entries || []) if (e.reviewed && !e.exclude && e.tcgPlayerId) tcg[e.id] = e.tcgPlayerId;
  const imgFor = p => tcg[p.id] ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcg[p.id]}_in_1000x1000.jpg` : (p.image || "");
  const today = new Date().toISOString().slice(0, 10);
  await mkdir(join(ROOT, "research/pulse/cards"), { recursive: true });
  const t3 = der.dailyThree?.sealed;
  let prod = (sp.products || []).find(p => p.name === t3?.name);
  // publish-guard: derived's pick may predate qa-gate's flags. A blocked
  // subject mints nothing (loudly) — never a card for a held number.
  const { loadBlocked } = await import("./lib/publish-guard.mjs");
  const __blk = await loadBlocked();
  if (prod && (prod.publishBlock || __blk.blocked(prod.id))) {
    console.log(`· social card NOT minted — subject ${prod.name} is blocked/quarantined`);
    prod = null;
  }
  if (prod) {
    const svg = socialCard({ img: imgFor(prod), title: prod.name, hero: "$" + Number(prod.priceMedian).toLocaleString("en-US"),
      heroLabel: "TODAY'S SEALED WATCH", hook: t3.spreadPct != null ? `eBay asks ${Math.abs(t3.spreadPct)}% ${t3.spreadPct > 0 ? "more" : "less"} than TCGplayer` : "",
      stats: [{ label: "listings", value: String(prod.listingCount ?? "—") },
              { label: "clean floor", value: "$" + Number(prod.priceFloorClean ?? prod.priceLow ?? 0).toLocaleString("en-US") },
              { label: "per pack", value: prod.perPack ? "$" + prod.perPack : "—" }], date: today });
    await writeFile(join(ROOT, `research/pulse/cards/${today}-social.svg`), svg);
    await writeFile(join(ROOT, "research/pulse/cards/latest-social.svg"), svg);
    console.log("✓ social card minted (photo-forward)");
  } else console.log("· no sealed subject for social card today");
}

// Windows-safe CLI guard (argv[1] is a filesystem path; compare as URL).
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mintSocialCard();
}
