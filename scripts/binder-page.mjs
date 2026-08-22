// binder-page.mjs — THE BINDER PAGE GENERATOR.
// Composes themed card grids — the format collectors already post and
// engage with heavily. Pure visual: no numbers required, though our
// themes can be data-driven (top chases, biggest movers) in a way no
// art account can match.
//
// SOURCES: card art from images.pokemontcg.io using ids we already track
// and verify. NEVER invent a card id — a page with a wrong card is worse
// than no page. Cards come from data/singles-prices.json (verified) or a
// curated theme file with ids checked against the same source.
// PROVEN 2026-08-22: images.pokemontcg.io serves cleanly to the
// rasterizer's fetch→data-URI inlining — no hotlink protection, no CORS
// issue. The DO-NOT-POST warning stays as the net for transient failures.
//
// IP NOTE: posting card images is universal community practice, and the
// pokemontcg.io API is the standard source. Attribution to the copyright
// holder rides on every page. This format is on the attorney list with
// the rest of the commercial-depiction questions.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const cardImg = id => { const m = /^(.+)-([^-]+)$/.exec(id); return m ? `https://images.pokemontcg.io/${m[1]}/${m[2]}.png` : ""; };

// One card slot. PAINT ORDER IS LOAD-BEARING: frame → fallback text →
// image. SVG paints in document order, so the art (when it inlines)
// fully covers the fallback; when it fails, name+id show. The first cut
// drew text after image and ghosted labels across every loaded card.
function slot(c, x, y, CW, CH, caption) {
  const img = c.image || cardImg(c.cardId);
  return `<g>
    <rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="14" fill="#141824" stroke="rgba(255,255,255,0.06)"/>
    <text x="${x + CW / 2}" y="${y + CH / 2 - 6}" text-anchor="middle" fill="#5c637a" font-size="20" font-weight="700">${esc((c.name || "").slice(0, 22))}</text>
    <text x="${x + CW / 2}" y="${y + CH / 2 + 20}" text-anchor="middle" fill="#3f4658" font-size="16" font-family="JetBrains Mono,monospace">${esc(c.cardId || "")}</text>
    ${img ? `<image href="${esc(img)}" x="${x + 5}" y="${y + 5}" width="${CW - 10}" height="${CH - 10}" preserveAspectRatio="xMidYMid meet"/>` : ""}
    ${caption ? `<text x="${x + CW / 2}" y="${y + CH + 24}" text-anchor="middle" fill="#98a1b5" font-size="17">${esc(caption.slice(0, 34))}</text>` : ""}
  </g>`;
}

const wordmark = (x, y) =>
  `<text x="${x}" y="${y}" fill="#36d399" font-size="26" font-weight="800">⚡</text>` +
  `<text x="${x + 36}" y="${y}" fill="#36d399" font-size="26" font-weight="800" font-family="Syne,Sora,sans-serif">Catch'em</text>`;

// 3×3 binder page — the classic tall format. Tighter gutters + slimmer
// header than v1 (PAD 46→34, GAP 22→14) so more pixel goes to art.
export function binderPage({ title, subtitle, cards, footer = "⚡ catchemtcg.com", captions = false }) {
  const CW = 300, CH = 420, GAP = 14, PAD = 34, HEAD = 88;
  const CAP = captions ? 32 : 0;
  const W = PAD * 2 + CW * 3 + GAP * 2;
  const H = PAD + HEAD + (CH + CAP) * 3 + GAP * 2 + 66;
  const slots = cards.slice(0, 9).map((c, i) => {
    const x = PAD + (i % 3) * (CW + GAP);
    const y = PAD + HEAD + Math.floor(i / 3) * (CH + CAP + GAP);
    return slot(c, x, y, CW, CH, captions ? c.caption : null);
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Sora,system-ui,sans-serif">
<rect width="${W}" height="${H}" fill="#070910"/>
<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="30" fill="#0b0d14" stroke="rgba(255,255,255,0.06)"/>
<text x="${W / 2}" y="${PAD + 38}" text-anchor="middle" fill="#f4f5f8" font-size="38" font-weight="800" letter-spacing="5" font-family="Syne,Sora,sans-serif">${esc(title.toUpperCase())}</text>
${subtitle ? `<text x="${W / 2}" y="${PAD + 68}" text-anchor="middle" fill="#98a1b5" font-size="20">${esc(subtitle)}</text>` : ""}
${slots}
${wordmark(PAD, H - 36)}
<text x="${W - PAD}" y="${H - 36}" text-anchor="end" fill="#5c637a" font-size="20" font-family="JetBrains Mono,monospace">${esc(footer)}</text>
</svg>`;
}

// 2×2 quad — the X-native variant: landscape ~5:4 canvas (timelines crop
// tall 2:3 images; this shows whole), title + numbered captions in a
// left rail, four cards on the right. Captions carry prices ONLY when
// the caller passed them (citation gate lives at theme assembly).
export function binderPageQuad({ title, subtitle, cards, footer = "⚡ catchemtcg.com" }) {
  const CW = 340, CH = 476, GAP = 16, PAD = 40, RAIL = 400;
  const W = PAD * 2 + RAIL + 28 + CW * 2 + GAP;
  const H = PAD * 2 + CH * 2 + GAP + 44;
  const four = cards.slice(0, 4);
  const slots = four.map((c, i) => {
    const x = PAD + RAIL + 28 + (i % 2) * (CW + GAP);
    const y = PAD + Math.floor(i / 2) * (CH + GAP);
    return slot(c, x, y, CW, CH, null);
  }).join("");
  const capList = four.map((c, i) =>
    `<text x="${PAD}" y="${PAD + 210 + i * 64}" fill="#c9cfdd" font-size="22"><tspan fill="#36d399" font-weight="800" font-family="JetBrains Mono,monospace">${i + 1}</tspan>  ${esc((c.name || "").slice(0, 24))}</text>` +
    (c.caption ? `<text x="${PAD + 32}" y="${PAD + 238 + i * 64}" fill="#8a93a8" font-size="18">${esc(c.caption.slice(0, 32))}</text>` : "")
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Sora,system-ui,sans-serif">
<rect width="${W}" height="${H}" fill="#070910"/>
<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="30" fill="#0b0d14" stroke="rgba(255,255,255,0.06)"/>
<text x="${PAD}" y="${PAD + 54}" fill="#f4f5f8" font-size="33" font-weight="800" letter-spacing="1" font-family="Syne,Sora,sans-serif" textLength="${RAIL - 20}" lengthAdjust="spacingAndGlyphs">${esc(title.toUpperCase())}</text>
${subtitle ? `<text x="${PAD}" y="${PAD + 96}" fill="#98a1b5" font-size="21">${esc(subtitle)}</text>` : ""}
${capList}
${slots}
${wordmark(PAD, H - 40)}
<text x="${W - PAD}" y="${H - 40}" text-anchor="end" fill="#5c637a" font-size="20" font-family="JetBrains Mono,monospace">${esc(footer)}</text>
</svg>`;
}

// ── Mint today's data-driven pages (called by generate-pulse AND the CLI;
// the old `import.meta.url === file://argv[1]` guard was false under the
// pipeline import and false on Windows paths — binder pages never minted
// outside a direct Linux CLI run) ─────────────────────────────────────────
export async function mintBinderPages() {
  const sg = await J("data/singles-prices.json") ?? { cards: [] };
  // needsReview flags a price discrepancy, not the artwork. A binder page
  // shows cards, so any verified card id qualifies; prices only order them.
  const live = (sg.cards || []).filter(c => c.cardId && c.priceMarket && c.dataStatus !== "error");
  await mkdir(join(ROOT, "research/pulse/cards"), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const made = [];
  const write = async (name, svg, isLatest) => {
    await writeFile(join(ROOT, `research/pulse/cards/${today}-binder-${name}.svg`), svg);
    if (isLatest) await writeFile(join(ROOT, "research/pulse/cards/latest-binder.svg"), svg);
  };

  // THEME 1 — The Chase Wall: our nine most valuable tracked singles.
  // Deduped by card name: Black Bolt / White Flare print the same art
  // twice under two set ids, and a wall with twin Victinis reads broken.
  const seen = new Set();
  const chase = [...live].sort((a, b) => b.priceMarket - a.priceMarket)
    .filter(c => !seen.has(c.name) && seen.add(c.name)).slice(0, 9);
  if (chase.length === 9) {
    await write("chasewall", binderPage({ title: "The Chase Wall", subtitle: "the nine most valuable singles we track today", cards: chase }), true);
    made.push("chasewall");
  }

  // THEME 2 — One Set, Nine Ways: the deepest set we track, by value.
  const bySet = {};
  for (const c of live) (bySet[c.cardId.split("-")[0]] ||= []).push(c);
  const [setId, setCards] = Object.entries(bySet).sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (setCards && setCards.length >= 9) {
    const nine = [...setCards].sort((a, b) => b.priceMarket - a.priceMarket).slice(0, 9);
    await write("oneset", binderPage({ title: "One Set, Nine Ways", subtitle: `every chase we track from ${setId.toUpperCase()}`, cards: nine }));
    made.push("oneset");
  }

  // THEME 3 — Four to Watch: the 2×2 X-native quad. Price captions obey
  // the citation gate (live + needsReview:false only); everything else
  // gets a set-name caption instead of a number.
  const citable = new Set(chase.filter(c => !c.needsReview && c.dataStatus === "live").map(c => c.cardId));
  const four = chase.slice(0, 4).map(c => ({
    ...c,
    caption: citable.has(c.cardId)
      ? `$${Math.round(c.priceMarket).toLocaleString("en-US")} · TCGplayer market`
      : (c.setName || "").slice(0, 30),
  }));
  if (four.length === 4) {
    await write("fourup", binderPageQuad({ title: "Four to Watch", subtitle: "today's top of the chase board", cards: four }));
    made.push("fourup");
  }

  console.log(`✓ binder pages minted: ${made.join(", ") || "none (need 9 verified cards)"}`);
  return made;
}

// Windows-safe CLI guard (argv[1] is a filesystem path; compare as URL).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mintBinderPages();
}
