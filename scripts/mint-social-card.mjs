// mint-social-card.mjs — the photo-forward share card.
// Different from the stat cards: the PRODUCT is the hero, numbers ride
// on top. Built for a thumb scrolling at speed. 1200×675 (X/IG safe).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
<rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="30" fill="#0f121b" stroke="rgba(255,255,255,0.06)"/>
<rect x="60" y="60" width="440" height="555" rx="22" fill="#141824"/>
${img ? `<image href="${esc(img)}" x="60" y="60" width="440" height="555" preserveAspectRatio="xMidYMid slice" clip-path="url(#ph)"/>` : ""}
<rect x="60" y="60" width="440" height="555" rx="22" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
<text x="560" y="120" fill="#98a1b5" font-size="20" letter-spacing="5" font-weight="700">${esc(heroLabel)}</text>
<foreignObject x="560" y="140" width="580" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#f4f5f8;font:700 40px Sora,system-ui,sans-serif;line-height:1.15">${esc(title)}</div></foreignObject>
<text x="560" y="360" fill="${accent}" font-size="96" font-weight="800" font-family="JetBrains Mono,monospace">${esc(hero)}</text>
${hook ? `<foreignObject x="560" y="385" width="580" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#98a1b5;font:400 26px Sora,system-ui,sans-serif;line-height:1.35">${esc(hook)}</div></foreignObject>` : ""}
${statCells}
<text x="60" y="${H - 12}" fill="#36d399" font-size="26" font-weight="800">⚡ Catch'em</text>
<text x="${W - 60}" y="${H - 12}" text-anchor="end" fill="#5c637a" font-size="20" font-family="JetBrains Mono,monospace">${esc(chip)} · ${esc(date)} · catchemtcg.com</text>
</svg>`;
}

// CLI: mint today's social card from the queue's midday/morning subject
if (import.meta.url === `file://${process.argv[1]}`) {
  const der = await J("data/derived-insights.json") ?? {};
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const cm = await J("data/crosscheck-id-map.json") ?? { entries: [] };
  const tcg = {}; for (const e of cm.entries || []) if (e.reviewed && !e.exclude && e.tcgPlayerId) tcg[e.id] = e.tcgPlayerId;
  const imgFor = p => tcg[p.id] ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcg[p.id]}_in_400x400.jpg` : (p.image || "");
  const today = new Date().toISOString().slice(0, 10);
  await mkdir(join(ROOT, "research/pulse/cards"), { recursive: true });
  const t3 = der.dailyThree?.sealed;
  const prod = (sp.products || []).find(p => p.name === t3?.name);
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
