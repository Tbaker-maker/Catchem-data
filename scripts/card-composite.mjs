// card-composite.mjs — the cards ARE the post.
//
// Tyler, 2026-08-23, after I sent an "art post" that was a price table:
// "You should be pulling the actual cards and putting them side by side, same
// size, awesome quality. Those type of visuals. I'll type the text."
//
// Right, and it took me two bad cards to understand it. Art content is not a
// statistic about art. The artwork is the content, the layout is the whole job,
// and the words are Tyler's. A number on an art post is a distraction from the
// thing the post is about.
//
// SO THIS DOES ONE THING WELL: pull the real card images, normalise them to
// identical size, and lay them out cleanly with the minimum of chrome. No
// prices. No stats. No premium math. A caption line naming what they are, and
// nothing else.
//
// usage:
//   node scripts/card-composite.mjs <cardId> <cardId> ... [--label "text"]
//   node scripts/card-composite.mjs --artist "Mitsuhiro Arita" --first --latest
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

// pokemontcg.io serves hi-res art at a predictable path. _hires is roughly
// 745x1040 — enough that a three-card row still looks sharp on a phone, which
// is where these are actually seen.
// NEVER CONSTRUCT AN IMAGE URL (2026-08-23). I built the path from the card ID
// and assumed every set lives on images.pokemontcg.io. Newer sets do not — me4
// serves from images.scrydex.com — so the constructed URL 404'd and the host
// returned a CARD BACK placeholder. That rendered as a perfectly valid image
// and looked fine to every check; Tyler saw a card back in a post about an
// illustrator's work.
//
// The source publishes the real URL per card. Use it. A constructed URL is a
// guess wearing the shape of a fact, and this one failed by returning a valid
// image of the wrong thing, which is the hardest kind of wrong to notice.
const setCache = {};
async function realImageUrl(id) {
  const set = id.slice(0, id.lastIndexOf("-"));
  if (!setCache[set]) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/${set}.json`, { signal: AbortSignal.timeout(12000) });
      setCache[set] = r.ok ? await r.json() : [];
    } catch { setCache[set] = []; }
  }
  const card = setCache[set].find(c => c.id === id);
  const url = card?.images?.large ?? card?.images?.small ?? null;
  if (!url) console.warn(`   ⚠ ${id}: no image URL in the source data — omitted rather than guessed`);
  return url;
}

const args = process.argv.slice(2);
const labelIdx = args.indexOf("--label");
const label = labelIdx >= 0 ? args[labelIdx + 1] : null;
const artistIdx = args.indexOf("--artist");
const cat = await J("data/card-catalogue.json") ?? { cards: {} };

let ids = args.filter(a => !a.startsWith("--") && a !== label && /-/.test(a) && cat.cards[a]);

// --artist mode: the strongest art post shape we have found. First card beside
// latest card is a career in one image, and needs no explanation at all.
if (artistIdx >= 0) {
  const artist = args[artistIdx + 1];
  const theirs = Object.entries(cat.cards).filter(([, c]) => c.artist === artist)
    .map(([id, c]) => ({ id, ...c })).filter(c => c.releaseDate)
    .sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1);
  if (!theirs.length) { console.error(`no cards found for "${artist}"`); process.exitCode = 1; }
  else if (args.includes("--first") && args.includes("--latest")) ids = [theirs[0].id, theirs[theirs.length - 1].id];
  else if (args.includes("--all") && theirs.length <= 5) ids = theirs.map(c => c.id);
  else ids = theirs.slice(0, 3).map(c => c.id);
}

if (!ids.length) {
  console.log(`usage:
  node scripts/card-composite.mjs sv8pt5-161 swsh7-215 base1-4
  node scripts/card-composite.mjs --artist "Mitsuhiro Arita" --first --latest
  node scripts/card-composite.mjs --artist "USGMEN" --all --label "Their entire body of work"`);
  process.exitCode = 0;
} else {
  // ── LAYOUT ──────────────────────────────────────────────────────────────
  // Every card the SAME size, evenly spaced, on the brand surface. Identical
  // sizing is the whole point: a row of cards at different scales reads as a
  // collage, and a collage looks like something a fan made rather than
  // something a company published.
  const CARD_W = 420, CARD_H = 586, GAP = 40, PAD = 64, CAPTION = label ? 92 : 56;
  const W = PAD * 2 + CARD_W * ids.length + GAP * (ids.length - 1);
  const H = PAD * 2 + CARD_H + CAPTION;

  const cards = [];
  for (const id of ids) {
    const url = await realImageUrl(id);
    if (url) cards.push({ id, ...cat.cards[id], imageUrl: url });
  }
  if (!cards.length) { console.error("no usable images — nothing produced rather than a card back"); process.exitCode = 1; }
  const sameArtist = new Set(cards.map(c => c.artist)).size === 1 ? cards[0].artist : null;
  const years = cards.map(c => (c.releaseDate ?? "").slice(0, 4)).filter(Boolean);
  const caption = label ?? (sameArtist
    ? `${sameArtist}${years.length > 1 && years[0] !== years[years.length - 1] ? ` · ${years[0]}–${years[years.length - 1]}` : ""}`
    : cards.map(c => c.name).join(" · "));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#070910"/>
${cards.map((c, i) => {
  const x = PAD + i * (CARD_W + GAP);
  return `<image x="${x}" y="${PAD}" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid meet" xlink:href="${c.imageUrl}"/>
<text x="${x + CARD_W / 2}" y="${PAD + CARD_H + 34}" text-anchor="middle" fill="#8a93a8" font-family="Sora" font-size="20">${(c.name ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}${c.releaseDate ? ` · ${c.releaseDate.slice(0, 4)}` : ""}</text>`;
}).join("\n")}
${label ? `<text x="${W / 2}" y="${H - 44}" text-anchor="middle" fill="#f4f5f8" font-family="Syne" font-weight="800" font-size="30">${label.replace(/&/g, "&amp;")}</text>` : ""}
<text x="${PAD}" y="${H - 18}" fill="#36d399" font-family="Syne" font-weight="800" font-size="22">Catch'em</text>
<text x="${W - PAD}" y="${H - 18}" text-anchor="end" fill="#5c637a" font-family="JetBrains Mono" font-size="15">${caption.replace(/&/g, "&amp;")}</text>
</svg>`;

  // Chat gets 403 from the image host; a browser does not. So alongside the SVG
  // we emit HTML referencing the images by URL - whoever opens it does the
  // fetching, and the composite is real on their screen with no round trip.
  const html = `<!doctype html><meta charset="utf-8">
<title>${caption}</title>
<style>
  body{margin:0;background:#070910;display:flex;align-items:center;justify-content:center;min-height:100vh;
       font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:40px 20px}
  .wrap{max-width:${W}px;width:100%}
  .row{display:flex;gap:${GAP}px;justify-content:center;align-items:flex-start}
  .card{flex:1 1 0;max-width:${CARD_W}px;text-align:center}
  .card img{width:100%;aspect-ratio:745/1040;object-fit:contain;display:block;border-radius:12px}
  .cap{color:#8a93a8;font-size:16px;margin-top:14px}
  .label{color:#f4f5f8;font-weight:800;font-size:30px;text-align:center;margin:34px 0 0}
  .foot{display:flex;justify-content:space-between;margin-top:28px;align-items:baseline}
  .mark{color:#36d399;font-weight:800;font-size:22px}
  .src{color:#5c637a;font-size:14px;font-family:ui-monospace,monospace}
  @media(max-width:700px){.row{gap:14px}.cap{font-size:13px}.label{font-size:22px}}
</style>
<div class="wrap">
  <div class="row">
${cards.map(c => `    <div class="card"><img src="${c.imageUrl}" alt="${(c.name ?? "").replace(/"/g, "")}" loading="eager">
      <div class="cap">${(c.name ?? "")}${c.releaseDate ? ` · ${c.releaseDate.slice(0, 4)}` : ""}</div></div>`).join("\n")}
  </div>
  ${label ? `<div class="label">${label}</div>` : ""}
  <div class="foot"><span class="mark">Catch'em</span><span class="src">${caption}</span></div>
</div>`;
  await writeFile(join(ROOT, "research/pulse/cards/composite.html"), html);

  await mkdir(join(ROOT, "research/pulse/cards"), { recursive: true }).catch(() => {});
  const out = join(ROOT, "research/pulse/cards/composite.svg");
  await writeFile(out, svg);
  await writeFile(join(ROOT, "research/pulse/cards/composite-manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    cards: cards.map((c, i) => ({ slot: i, id: c.id, name: c.name, artist: c.artist, set: c.setName, year: (c.releaseDate ?? "").slice(0, 4), url: c.imageUrl })),
    caption, dimensions: `${W}x${H}`,
    note: "Art post: no prices, no stats. The artwork is the content and the words are Tyler's.",
    todo: "Fetch each url, base64 it, and replace the __IMG_n__ placeholders before rasterising. Chat cannot reach images.pokemontcg.io (403), so this step needs CC or a machine with access.",
  }, null, 1));

  console.log(`✓ composite: ${ids.length} card(s) at ${CARD_W}x${CARD_H}, ${W}x${H} total`);
  for (const c of cards) console.log(`   ${c.name} (${(c.releaseDate ?? "").slice(0, 4)}) — ${c.imageUrl}`);
  console.log(`\n   caption: ${caption}`);
  console.log(`   composite.html written — open it and the images load straight from the host.`);
}
