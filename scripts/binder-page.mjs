// binder-page.mjs — THE BINDER PAGE GENERATOR.
// Composes a 3×3 themed card grid — the format collectors already post
// and engage with heavily. Pure visual: no numbers required, though our
// themes can be data-driven (top chases, biggest movers) in a way no
// art account can match.
//
// SOURCES: card art from images.pokemontcg.io using ids we already track
// and verify. NEVER invent a card id — a page with a wrong card is worse
// than no page. Cards come from data/singles-prices.json (verified) or a
// curated theme file with ids checked against the same source.
//
// IP NOTE: posting card images is universal community practice, and the
// pokemontcg.io API is the standard source. Attribution to the copyright
// holder rides on every page. This format is on the attorney list with
// the rest of the commercial-depiction questions.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const cardImg = id => { const m = /^(.+)-([^-]+)$/.exec(id); return m ? `https://images.pokemontcg.io/${m[1]}/${m[2]}.png` : ""; };

export function binderPage({ title, subtitle, cards, footer = "⚡ catchemtcg.com" }) {
  // 3×3 at card aspect ratio 2.5:3.5, generous gutters, dark frame.
  const CW = 300, CH = 420, GAP = 22, PAD = 46;
  const W = PAD * 2 + CW * 3 + GAP * 2;
  const H = PAD + 92 + CH * 3 + GAP * 2 + 78;
  const slots = cards.slice(0, 9).map((c, i) => {
    const x = PAD + (i % 3) * (CW + GAP);
    const y = PAD + 92 + Math.floor(i / 3) * (CH + GAP);
    const img = c.image || cardImg(c.cardId);
    return `<g>
      <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="16" fill="#141824" stroke="rgba(255,255,255,0.06)"/>
      ${img ? `<image href="${esc(img)}" x="${x + 6}" y="${y + 6}" width="${CW - 12}" height="${CH - 12}" preserveAspectRatio="xMidYMid meet"/>` : ""}
    </g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Sora,system-ui,sans-serif">
<rect width="${W}" height="${H}" fill="#070910"/>
<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="34" fill="#0b0d14" stroke="rgba(255,255,255,0.06)"/>
<text x="${W / 2}" y="${PAD + 44}" text-anchor="middle" fill="#f4f5f8" font-size="40" font-weight="800" letter-spacing="6">${esc(title.toUpperCase())}</text>
${subtitle ? `<text x="${W / 2}" y="${PAD + 76}" text-anchor="middle" fill="#98a1b5" font-size="21">${esc(subtitle)}</text>` : ""}
${slots}
<text x="${PAD}" y="${H - 44}" fill="#36d399" font-size="26" font-weight="800">⚡ Catch'em</text>
<text x="${W - PAD}" y="${H - 44}" text-anchor="end" fill="#5c637a" font-size="20" font-family="JetBrains Mono,monospace">${esc(footer)}</text>
</svg>`;
}

// ── CLI: mint today's data-driven pages ────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const sg = await J("data/singles-prices.json") ?? { cards: [] };
  // needsReview flags a price discrepancy, not the artwork. A binder page
  // shows cards, so any verified card id qualifies; prices only order them.
  const live = (sg.cards || []).filter(c => c.cardId && c.priceMarket && c.dataStatus !== "error");
  await mkdir(join(ROOT, "research/pulse/cards"), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const made = [];

  // THEME 1 — The Chase Wall: our nine most valuable tracked singles.
  // Data-driven, and impossible for an art account to assemble honestly.
  const chase = [...live].sort((a, b) => b.priceMarket - a.priceMarket).slice(0, 9);
  if (chase.length === 9) {
    await writeFile(join(ROOT, `research/pulse/cards/${today}-binder-chasewall.svg`),
      binderPage({ title: "The Chase Wall", subtitle: "the nine most valuable singles we track today", cards: chase }));
    await writeFile(join(ROOT, "research/pulse/cards/latest-binder.svg"),
      binderPage({ title: "The Chase Wall", subtitle: "the nine most valuable singles we track today", cards: chase }));
    made.push("chasewall");
  }

  // THEME 2 — One Set, Nine Ways: the deepest set we track, by value.
  const bySet = {};
  for (const c of live) (bySet[c.cardId.split("-")[0]] ||= []).push(c);
  const [setId, setCards] = Object.entries(bySet).sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (setCards && setCards.length >= 9) {
    const nine = [...setCards].sort((a, b) => b.priceMarket - a.priceMarket).slice(0, 9);
    await writeFile(join(ROOT, `research/pulse/cards/${today}-binder-oneset.svg`),
      binderPage({ title: "One Set, Nine Ways", subtitle: `every chase we track from ${setId.toUpperCase()}`, cards: nine }));
    made.push("oneset");
  }
  console.log(`✓ binder pages minted: ${made.join(", ") || "none (need 9 verified cards)"}`);
}
