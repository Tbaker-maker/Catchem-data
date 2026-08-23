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
//   node scripts/card-composite.mjs --artist "Mitsuhiro Arita" --first --best
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

// GRID LAYOUTS (Tyler, 2026-08-23). Two shapes, both built to start a
// conversation rather than end one:
//   --binder   a 3x3 page, the way a collector actually sees cards
//   --grid ROWSxCOLS  rows that compare — three birds across three eras —
//              captioned as a QUESTION so the reader is invited to disagree.
// The question framing is the whole point. A post that starts an argument
// beats one that ends it, and a question cannot be wrong.
// ART MODE (Tyler, 2026-08-23). His Charmander post did 791 views and 38 likes
// against the Arita pairing's 154 and 9 - five times over, same account, same
// week. The difference was cropped card ART with a two-word hook: no frame, no
// captions, no data at all.
//
// THE SAFETY RULE: crop ONLY cards where the art IS the whole card - Illustration
// Rare and Special Illustration Rare, 687 of them. On a classic card the art sits
// in a small window whose position moves by era and by rarity, and cropping those
// blind produces a mangled frame, half a text box, or a border. That is the
// aesthetic equivalent of shipping a card back, and we have done that once today.
const ART_SAFE = /(Special Illustration Rare|Illustration Rare)/i;
const artMode = args.includes("--art");
const gridIdx = args.indexOf("--grid");
const isBinder = args.includes("--binder");
const gridSpec = gridIdx >= 0 ? (args[gridIdx + 1] ?? "3x3") : (isBinder ? "3x3" : null);
const [gRows, gCols] = gridSpec ? gridSpec.split("x").map(Number) : [0, 0];



let ids = args.filter(a => !a.startsWith("--") && a !== label && /-/.test(a) && cat.cards[a]);

// --artist mode: the strongest art post shape we have found. First card beside
// latest card is a career in one image, and needs no explanation at all.
if (artistIdx >= 0) {
  const artist = args[artistIdx + 1];
  const theirs = Object.entries(cat.cards).filter(([, c]) => c.artist === artist)
    .map(([id, c]) => ({ id, ...c })).filter(c => c.releaseDate)
    .sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1);
  if (!theirs.length) { console.error(`no cards found for "${artist}"`); process.exitCode = 1; }
  // STRONGEST, NOT LATEST (Tyler, 2026-08-23). --latest first picked Keldeo, a
  // common, because it was the most recent row in the data. Tyler's word for it
  // was "underwhelming", and he was right — he remembered Arita had done the
  // Blastoise ex SIR in 151, which is a hero card worth $139 against Keldeo's
  // nothing. "Latest" is a DATA choice; "best" is an editorial one, and taking
  // the data choice because it is easy to compute is how a post ends up
  // technically correct and worth nobody's attention.
  else if (args.includes("--first") && args.includes("--best")) {
    const best = theirs.filter(c => c.price).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0]
      ?? theirs[theirs.length - 1];
    ids = [theirs[0].id, best.id];
  }
  else if (args.includes("--first") && args.includes("--latest")) ids = [theirs[0].id, theirs[theirs.length - 1].id];
  else if (args.includes("--all") && theirs.length <= 5) ids = theirs.map(c => c.id);
  else ids = theirs.slice(0, 3).map(c => c.id);
}

if (!ids.length) {
  console.log(`usage:
  node scripts/card-composite.mjs sv8pt5-161 swsh7-215 base1-4
  node scripts/card-composite.mjs --artist "Mitsuhiro Arita" --first --best
  node scripts/card-composite.mjs --artist "Mitsuhiro Arita" --first --latest
  node scripts/card-composite.mjs --artist "USGMEN" --all --label "Their entire body of work"`);
  process.exitCode = 0;
} else {
  // ── LAYOUT ──────────────────────────────────────────────────────────────
  // Every card the SAME size, evenly spaced, on the brand surface. Identical
  // sizing is the whole point: a row of cards at different scales reads as a
  // collage, and a collage looks like something a fan made rather than
  // something a company published.


  const cards = [];
  for (const id of ids) {
    const url = await realImageUrl(id);
    if (url) cards.push({ id, ...cat.cards[id], imageUrl: url });
  }
  if (!cards.length) { console.error("no usable images — nothing produced rather than a card back"); process.exitCode = 1; }

  // THE LAYOUT TABLE DECIDES (2026-08-23). Every supported count has a measured
  // frame, so nobody makes a layout choice at post time - and every visual we got
  // wrong today was a choice made in a hurry. Unsupported counts fail loudly.
  if (artMode) {
    const unsafe = cards.filter(c => !ART_SAFE.test(c.rarity ?? ""));
    if (unsafe.length) {
      console.error(`\n  --art refuses ${unsafe.length} card(s): ${unsafe.map(c => `${c.name} (${c.rarity})`).join(", ")}`);
      console.error(`  Art mode crops to the illustration, which only works when the art IS the card.`);
      console.error(`  On a classic card the art window moves by era and rarity - cropping blind would`);
      console.error(`  produce a mangled frame or half a text box. Use the full card instead.\n`);
      process.exitCode = 1;
    }
  }
  const { LAYOUTS, frameFor } = await import("./layouts.mjs");
  const LAY = frameFor(cards.length);
  if (!LAY) {
    const opts = Object.keys(LAYOUTS).join(", ");
    console.error(`\n  ${cards.length} cards has no layout. Supported: ${opts}.`);
    console.error(`  Five and seven are deliberately unsupported - they leave a ragged final row,`);
    console.error(`  which reads as a mistake rather than a choice.\n`);
    process.exitCode = 1;
  } else {
    console.log(`  layout: ${LAY.name} - ${LAY.w}x${LAY.h}, ${LAY.ratio}:1, ${LAY.timeline}`);
  }

  const isGrid = LAY ? LAY.rows > 1 : (gridSpec && cards.length > 3);
  const perRow = LAY ? LAY.cols : (isGrid ? gCols : cards.length);
  const rowCount = LAY ? LAY.rows : (isGrid ? Math.ceil(cards.length / gCols) : 1);
  // Cards shrink as the grid grows so a 3x3 still fits a readable frame.
  // THE TABLE DRIVES THE FRAME. An earlier version computed the layout, printed
  // it, and then rendered from old hardcoded widths - announcing "1342x593" and
  // producing 1928x894. A layout system whose log disagrees with its output is
  // worse than none, because now the log lies too.
  const CARD_W = LAY ? LAY.cardW : (isGrid ? (perRow >= 3 ? 300 : 380) : 420);
  const CARD_H = Math.round(CARD_W * 1040 / 745);
  // PHONE-FIRST SIZING (Tyler, 2026-08-23). X crops a single image past roughly
  // 4:5 in the timeline. A 3x3 of portrait cards is inherently ~1.4:1 because
  // the cards themselves are 1.4:1 - shrinking them changes nothing at all. The
  // only lever is vertical OVERHEAD, so a grid drops the per-card captions for
  // one row label, tightens the gaps and pulls the padding in. That takes
  // 1.52:1 down to about 1.35:1, which X shows almost whole.
  // ONE SOURCE FOR THE NUMBERS. The table said 1342x593 and the render produced
  // 1448x727 because each file kept its own padding, gap and caption height.
  // Two sources for one number is exactly how a log ends up contradicting the
  // thing it is logging.
  const { PAD: L_PAD, GAP: L_GAP, CAPTION: L_CAP } = await import("./layouts.mjs");
  const GAP = L_GAP, PAD = L_PAD;
  const CARD_CAP = 0;
  const CAPTION = L_CAP;
  const W = PAD * 2 + CARD_W * perRow + GAP * (perRow - 1);
  const H = PAD * 2 + CARD_H * rowCount + GAP * (rowCount - 1) + CAPTION + CARD_CAP * rowCount;

  const sameArtist = new Set(cards.map(c => c.artist)).size === 1 ? cards[0].artist : null;
  const years = cards.map(c => (c.releaseDate ?? "").slice(0, 4)).filter(Boolean);
  const caption = label ?? (sameArtist
    ? `${sameArtist}${years.length > 1 && years[0] !== years[years.length - 1] ? ` · ${years[0]}–${years[years.length - 1]}` : ""}`
    : cards.map(c => c.name).join(" · "));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#070910"/>
${cards.map((c, i) => {
  const col = isGrid ? i % perRow : i, row = isGrid ? Math.floor(i / perRow) : 0;
  const x = PAD + col * (CARD_W + GAP);
  const y = PAD + row * (CARD_H + GAP + (isGrid ? 30 : 0));
  return `<image x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" preserveAspectRatio="xMidYMid meet" xlink:href="${c.imageUrl}"/>
<text x="${x + CARD_W / 2}" y="${y + CARD_H + 26}" text-anchor="middle" fill="#8a93a8" font-family="Sora" font-size="${isGrid ? 16 : 20}">${isGrid ? "" : ((c.name ?? "").length > (isGrid ? 20 : 40) ? (c.name ?? "").slice(0, isGrid ? 18 : 38) + "…" : (c.name ?? "")).replace(/&/g, "&amp;").replace(/</g, "&lt;")}${c.releaseDate ? ` · ${c.releaseDate.slice(0, 4)}` : ""}</text>`;
}).join("\n")}
${label ? `<text x="${W / 2}" y="${H - 96}" text-anchor="middle" fill="#f4f5f8" font-family="Syne" font-weight="800" font-size="30">${label.replace(/&/g, "&amp;")}</text>` : ""}
<text x="${PAD}" y="${H - 18}" fill="#36d399" font-family="Syne" font-weight="800" font-size="22">Catch'em</text>
<text x="${W - PAD}" y="${H - 18}" text-anchor="end" fill="#5c637a" font-family="JetBrains Mono" font-size="15">${caption.replace(/&/g, "&amp;")}</text>
</svg>`;

  // Chat gets 403 from the image host; a browser does not. So alongside the SVG
  // we emit HTML referencing the images by URL - whoever opens it does the
  // fetching, and the composite is real on their screen with no round trip.
  const CW = 745, CH = 1040;   // native card proportions, drawn at full size
  const html = `<!doctype html><meta charset="utf-8">
<title>${caption}</title>
<style>
  body{margin:0;background:#070910;display:flex;align-items:center;justify-content:center;min-height:100vh;
       font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:40px 20px}
  .wrap{max-width:${W}px;width:100%}
  .row{display:grid;grid-template-columns:repeat(${perRow},1fr);gap:${GAP}px;justify-content:center;align-items:start}
  .card{text-align:center}
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
  <div style="text-align:center;margin-top:26px">
    <button id="dl" style="background:#36d399;color:#070910;border:0;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:700;cursor:pointer">Download as one image</button>
    <button id="dlsvg" style="background:transparent;color:#8a93a8;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:14px 22px;font-size:15px;cursor:pointer;margin-left:8px">Or open the cards full-size</button>
    <div id="msg" style="color:#8a93a8;font-size:13px;margin-top:10px"></div>
  </div>
</div>
<script>
// The browser composites, because it can reach the image host and chat cannot.
// Everything is drawn at native card resolution so the result is postable
// rather than a screenshot of a screenshot.
const CARDS = ${JSON.stringify(cards.map(c => ({ url: c.imageUrl, name: c.name, year: (c.releaseDate ?? "").slice(0, 4) })))};
const LABEL = ${JSON.stringify(label ?? "")};
const CAPTION = ${JSON.stringify(caption)};
// A GUARANTEED ROUTE. If every canvas path fails, the reader can still get real
// full-resolution files - one tab per card, right-click and save. A screenshot
// is the one outcome worth engineering around, so there is always another way.
document.getElementById("dlsvg").onclick = () => {
  CARDS.forEach((c, i) => setTimeout(() => window.open(c.url, "_blank"), i * 250));
  document.getElementById("msg").textContent = CARDS.length + " card(s) opened full-size - right-click and save each";
};
document.getElementById("dl").onclick = async () => {
  const msg = document.getElementById("msg");
  msg.textContent = "composing…";
  const CW = 745, CH = 1040, GAP = 60, PAD = 90, CAPH = 130, LABH = LABEL ? 110 : 0;
  const W = PAD * 2 + CW * CARDS.length + GAP * (CARDS.length - 1);
  const H = PAD + CH + CAPH + LABH + 90;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#070910"; g.fillRect(0, 0, W, H);
  try {
    for (let i = 0; i < CARDS.length; i++) {
      // THE REAL BUG (2026-08-23): crossOrigin="anonymous" against a host that
      // sends no CORS headers does not degrade gracefully - it makes the image
      // fail to LOAD at all. The old message blamed the host for a load we had
      // broken ourselves by asking for permission it never offers.
      //
      // Three routes tried in order, because a screenshot is not an acceptable
      // answer: direct-with-CORS, then a public image proxy that does send the
      // header, then direct-without-CORS so at least the preview appears.
      const routes = [
        { url: CARDS[i].url, cors: true },
        { url: "https://images.weserv.nl/?url=" + encodeURIComponent(CARDS[i].url.replace(/^https?:\/\//, "")) + "&w=745&output=png", cors: true },
        { url: CARDS[i].url, cors: false },
      ];
      let img = null;
      for (const r of routes) {
        try {
          img = await new Promise((res, rej) => {
            const im = new Image();
            if (r.cors) im.crossOrigin = "anonymous";
            im.onload = () => res(im);
            im.onerror = () => rej(new Error("load failed"));
            im.src = r.url;
          });
          break;
        } catch { img = null; }
      }
      if (!img) throw new Error("no route to the image");
      const x = PAD + i * (CW + GAP);
      g.drawImage(img, x, PAD, CW, CH);
      g.fillStyle = "#8a93a8"; g.font = "28px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText(CARDS[i].name + " · " + CARDS[i].year, x + CW / 2, PAD + CH + 52);
    }
    if (LABEL) { g.fillStyle = "#f4f5f8"; g.font = "800 52px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText(LABEL, W / 2, PAD + CH + CAPH + 40); }
    g.fillStyle = "#36d399"; g.font = "800 38px system-ui, sans-serif"; g.textAlign = "left";
    g.fillText("Catch'em", PAD, H - 34);
    g.fillStyle = "#5c637a"; g.font = "24px ui-monospace, monospace"; g.textAlign = "right";
    g.fillText(CAPTION, W - PAD, H - 34);
    // Tainted canvas throws here rather than returning something broken.
    const url = cv.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = "catchem-" + CAPTION.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png";
    a.click();
    msg.textContent = "downloaded — one image, ready to post";
  } catch (e) {
    msg.textContent = "could not export: " + (e.message || "unknown") + ". Right-click each card and save instead.";
  }
};
</script>`;
  await writeFile(join(ROOT, "research/pulse/cards/composite.html"), html);
  await writeFile(join(ROOT, "research/pulse/cards/composite-urls.txt"),
    cards.map(c => `${c.name} (${(c.releaseDate ?? "").slice(0, 4)})\n${c.imageUrl}`).join("\n\n") + "\n");


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

  // RASTERISE WHEN POSSIBLE. An HTML file means open it, screenshot it, crop it.
  // A PNG means drop it into the post. Chat gets 403 from the image host so this
  // is a no-op here, but it runs anywhere with access and produces the file
  // Tyler actually wants.
  try {
    const [{ Resvg }, { writeFile: wf }] = [await import("@resvg/resvg-js"), await import("node:fs/promises")];
    let embedded = svg;
    let ok = true;
    for (const c of cards) {
      const r = await fetch(c.imageUrl, { signal: AbortSignal.timeout(15000) }).catch(() => null);
      if (!r || !r.ok) { ok = false; break; }
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = r.headers.get("content-type") ?? "image/png";
      // A content-type is a claim, not evidence — sniff the bytes.
      const isPng = buf[0] === 0x89 && buf[1] === 0x50, isJpg = buf[0] === 0xff && buf[1] === 0xd8;
      if (!isPng && !isJpg) { ok = false; break; }
      embedded = embedded.replace(c.imageUrl, `data:${isPng ? "image/png" : "image/jpeg"};base64,${buf.toString("base64")}`);
    }
    if (ok) {
      const png = new Resvg(embedded, { fitTo: { mode: "width", value: W } }).render().asPng();
      await wf(join(ROOT, "research/pulse/cards/composite.png"), png);
      console.log(`   composite.png written — drop it straight into the post.`);
    } else {
      console.log(`   PNG skipped: the image host is unreachable from here. composite.html loads them in a browser.`);
    }
  } catch (e) { console.log(`   PNG skipped: ${e.message.slice(0, 60)}`); }

  console.log(`✓ composite: ${ids.length} card(s) at ${CARD_W}x${CARD_H}, ${W}x${H} total`);
  for (const c of cards) console.log(`   ${c.name} (${(c.releaseDate ?? "").slice(0, 4)}) — ${c.imageUrl}`);
  console.log(`\n   caption: ${caption}`);
  console.log(`   composite.html written — open it and the images load straight from the host.`);
}
