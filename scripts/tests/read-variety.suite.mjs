// Variety regression from the 2026-11-27 board (361 reads in reads.json).
// The live lines repeated boilerplate 4-word phrases on neighboring reads.
// Fixtures below use fake names and fake prices. The shape is the real one.
import { finishBoard } from "../lib/board-mix.mjs";

const GLUE = new Set(`a an the of in on to from for and or its it is still under over about
more less than with against by as at vs last this that those two date dates week weeks days
day year years went up down flat priced above below similar typical price prices cards card
market tcgplayer story way low high tonight median fell rose illustrated chase ahead behind
set listings counted peak range file back since out came era both only same start end running
higher lower one night sealed top between within held barely moved not no after before into
across while each their was were has have together add dated level near line percent jan feb
mar apr may jun jul aug sep oct nov dec our list standard legal left rotated points then
through reads moved pair print reaching using window shows source ends after`.split(/\s+/));

function words(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9$%+'-]+/g, " ").split(/\s+/).filter(Boolean);
}

function glueGrams(s) {
  const w = words(s);
  const out = new Set();
  for (let i = 0; i <= w.length - 4; i += 1) {
    const g = w.slice(i, i + 4);
    const boiler = g.every((t) => GLUE.has(t) || /^\$?\d+(?:\.\d+)?%?$/.test(t));
    if (boiler) out.add(g.join(" "));
  }
  return out;
}

function voice(r) {
  const parts = [r?.headline, r?.path, r?.why, r?.blurb, r?.whyItMatters];
  for (const ln of r?.lines || []) if (typeof ln === "string") parts.push(ln);
  return parts.filter(Boolean).join(" ");
}

function sharedGlue(a, b) {
  const gb = glueGrams(voice(b));
  const hit = [];
  for (const g of glueGrams(voice(a))) if (gb.has(g)) hit.push(g);
  return hit;
}

function amounts(s) {
  return new Set(String(s || "").match(/\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%/g) || []);
}

function row(partial) {
  return {
    board: "v3",
    asOf: "2026-11-27",
    lines: [],
    ...partial,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const blurbA = row({
    id: "faux-gator",
    family: "year",
    readKind: "year",
    kind: "year",
    name: "Faux Gator",
    headline: "Down 59% in the last 90 days: Faux Gator (Fake Heroes) 274/217 went from $111.11 on Aug 29 to $44.44 on Nov 27.",
    blurb: "TCGplayer market is down 59% over 90 days, as of Nov 27.",
    why: "Down $66.67 on those two dates.",
  });
  const blurbB = row({
    id: "bolt-drake",
    family: "deep",
    readKind: "deep",
    kind: "deep",
    name: "Bolt Drake",
    headline: "Priced above similar Faux Rares: Bolt Drake (Fake Bolt) 166/086, $222.22 (Nov 27) on TCGplayer market.",
    blurb: "TCGplayer market is flat over 7 days, as of Nov 27.",
    why: "From TCGplayer market, Nov 27.",
  });
  const bandA = row({
    id: "faux-artist",
    family: "artist-band",
    readKind: "artist-band",
    kind: "artist-band",
    name: "Faux Artist",
    headline: "Cards illustrated by Faux Artist: 5 of 6 fell, median -11.4%, Oct 30 to Nov 27.",
    why: "Official card artist from the catalogue. Prices are that artist's own cards on the two dates.",
    lines: ["0 up and 5 down, of 6 cards illustrated by Faux Artist."],
  });
  const bandB = row({
    id: "fake-rivals",
    family: "rarity-band",
    readKind: "rarity-band",
    kind: "rarity-band",
    name: "Fake Rivals",
    headline: "Faux Rare cards in Fake Rivals: 10 of 11 fell, median -13.6%, Oct 30 to Nov 27.",
    why: "Each card uses its own two market prices. The dates in the line are those points.",
    lines: ["0 up and 10 down, of 11 Faux Rare cards."],
  });
  const whyA = row({
    id: "why-a",
    family: "fact",
    readKind: "pokemon",
    kind: "pokemon",
    name: "Faux Spotlight",
    headline: "Faux Spotlight: of 12 cards with a year of prices, 9 kept or grew their price.",
    why: "From TCGplayer market, Nov 27, 2025 and Nov 27.",
    whyItMatters: "From TCGplayer market, Nov 27, 2025 and Nov 27.",
  });
  const whyB = row({
    id: "why-b",
    family: "games",
    readKind: "listings",
    kind: "listings",
    name: "Faux Box",
    headline: "Faux Box: 40 listings counted on Nov 27. A listing is not a sale.",
    why: "From TCGplayer market, Nov 20 and Nov 27.",
    whyItMatters: "From TCGplayer market, Nov 20 and Nov 27.",
  });
  const yearLine = "Up 40% on the year: Faux Drake went from $11.11 on Nov 27, 2025 to $15.55 on Nov 27.";
  const years = ["alpha", "beta", "gamma"].map((id) => row({
    id: `year-${id}`,
    family: `fam-${id}`,
    readKind: "year",
    kind: "year",
    name: "Faux Drake",
    headline: yearLine,
    path: yearLine,
    blurb: "TCGplayer market is up 40% over 365 days, as of Nov 27.",
    why: "Up $4.44 on those two dates.",
  }));
  const storyA = row({
    id: "story-a",
    family: "card-a",
    readKind: "deep",
    kind: "deep",
    name: "Faux Mime",
    headline: "The story of Faux Mime (Fake Set) 1/99: $77.77 tonight, 40% of the way from its 1-year low to its 1-year high.",
    path: "The story of Faux Mime (Fake Set) 1/99: $77.77 tonight, 40% of the way from its 1-year low to its 1-year high.",
  });
  const storyB = row({
    id: "story-b",
    family: "card-b",
    readKind: "deep",
    kind: "deep",
    name: "Faux Newt",
    headline: "The story of Faux Newt (Fake Set) 2/99: $88.88 tonight, 55% of the way from its 1-year low to its 1-year high.",
    path: "The story of Faux Newt (Fake Set) 2/99: $88.88 tonight, 55% of the way from its 1-year low to its 1-year high.",
  });
  const nameA = row({
    id: "name-a",
    family: "pack",
    readKind: "sealed",
    kind: "sealed",
    name: "Faux Heroes pack",
    headline: "Faux Heroes pack is $11.11 on Jan 2.",
  });
  const nameB = row({
    id: "name-b",
    family: "box",
    readKind: "sealed",
    kind: "sealed",
    name: "Faux Heroes box",
    headline: "Faux Heroes box is $22.22 on Mar 4.",
  });

  const board = finishBoard([
    blurbA, blurbB, bandA, bandB, whyA, whyB, ...years, storyA, storyB, nameA, nameB,
  ]);
  const byId = new Map(board.map((r) => [r.id, r]));

  t("every fixture stays on the board", board.length === 13);
  const pairs = [];
  for (let i = 0; i < board.length - 1; i += 1) {
    const hit = sharedGlue(board[i], board[i + 1]);
    if (hit.length) pairs.push(`${board[i].id}|${board[i + 1].id}:${hit.slice(0, 3).join(",")}`);
  }
  t("no neighboring reads share a boilerplate 4-word phrase", pairs.length === 0);

  const gator = byId.get("faux-gator");
  const drake = byId.get("bolt-drake");
  const gatorAt = board.findIndex((r) => r.id === "faux-gator");
  const drakeAt = board.findIndex((r) => r.id === "bolt-drake");
  t("gator keeps its own percent and prices", gator && voice(gator).includes("59%") && voice(gator).includes("$111.11") && voice(gator).includes("$44.44") && voice(gator).includes("$66.67"));
  t("drake keeps flat 7 day fact without copying as of nov 27 next to gator", drake && voice(drake).includes("7") && (Math.abs(gatorAt - drakeAt) !== 1 || (!sharedGlue(gator, drake).includes("as of nov 27") && !sharedGlue(gator, drake).includes("days as of nov"))));

  const artist = byId.get("faux-artist");
  const rivals = byId.get("fake-rivals");
  const artistAt = board.findIndex((r) => r.id === "faux-artist");
  const rivalsAt = board.findIndex((r) => r.id === "fake-rivals");
  t("band lines keep their medians and counts", artist && voice(artist).includes("-11.4%") && voice(artist).includes("5 of 6") && rivals && voice(rivals).includes("-13.6%") && voice(rivals).includes("10 of 11"));
  t("band neighbors do not both say oct 30 to nov", artist && rivals && (Math.abs(artistAt - rivalsAt) !== 1 || !sharedGlue(artist, rivals).some((g) => g.includes("oct 30 to nov") || g === "30 to nov 27")));

  const y0 = byId.get("year-alpha");
  const y1 = byId.get("year-beta");
  const y2 = byId.get("year-gamma");
  const yearAt = ["year-alpha", "year-beta", "year-gamma"].map((id) => board.findIndex((r) => r.id === id));
  const yearNeighbors = (yearAt[0] + 1 === yearAt[1]) || (yearAt[1] + 1 === yearAt[2]) || (yearAt[0] + 1 === yearAt[2]);
  t("identical year leads do not sit as the same sentence", y0 && y1 && y2 && (!yearNeighbors || (y0.headline !== y1.headline && y1.headline !== y2.headline && y0.headline !== y2.headline)));
  t("each year lead still has 40% and both fake prices", [y0, y1, y2].every((r) => r && voice(r).includes("40%") && voice(r).includes("$11.11") && voice(r).includes("$15.55") && voice(r).includes("$4.44")));

  const mime = byId.get("story-a");
  const newt = byId.get("story-b");
  const mimeAt = board.findIndex((r) => r.id === "story-a");
  const newtAt = board.findIndex((r) => r.id === "story-b");
  const storyHit = mime && newt ? sharedGlue(mime, newt) : ["missing"];
  t("near duplicate story headlines do not share of the way from", mime && newt && voice(mime).includes("$77.77") && voice(mime).includes("40%") && voice(newt).includes("$88.88") && voice(newt).includes("55%") && voice(mime).includes("Faux Mime") && voice(newt).includes("Faux Newt") && (Math.abs(mimeAt - newtAt) !== 1 || !storyHit.some((g) => g === "of the way from" || g === "the way from its")));

  const pack = byId.get("name-a");
  const box = byId.get("name-b");
  t("a repeated set name stays when the sentence is not boilerplate", pack && box && pack.headline === nameA.headline && box.headline === nameB.headline && pack.headline.includes("Faux Heroes") && box.headline.includes("Faux Heroes"));

  const blob = board.map(voice).join(" ");
  t("no em dash or en dash in the varied lines", !/[\u2014\u2013]/.test(blob));
  t("no sold claim and no advice phrase", !/\b(sold|sales|buy now|load up|guaranteed)\b/i.test(blob));
  let invented = false;
  const inputs = new Map([blurbA, blurbB, bandA, bandB, whyA, whyB, ...years, storyA, storyB, nameA, nameB].map((r) => [r.id, r]));
  for (const r of board) {
    const src = inputs.get(r.id);
    const extra = [...amounts(voice(r))].filter((n) => !amounts(voice(src)).has(n));
    if (extra.length) invented = extra.join(",");
  }
  t("no new dollar or percent is invented", invented === false);

  const onlyYears = finishBoard(years.map((r) => ({ ...r, lines: [] })));
  const yearSame = onlyYears.some((r, i) => i > 0 && r.headline === onlyYears[i - 1].headline);
  t("a list that is entirely the same sentence still changes the next template", onlyYears.length === 3 && !yearSame && onlyYears.every((r, i) => i === 0 || sharedGlue(onlyYears[i - 1], r).length === 0));
  const alone = finishBoard([blurbA])[0];
  t("a read with no neighbor keeps the generator sentence", alone && alone.headline === blurbA.headline && alone.blurb === blurbA.blurb && alone.why === blurbA.why);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-variety.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
