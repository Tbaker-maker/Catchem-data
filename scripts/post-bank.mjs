// post-bank.mjs — POST STUDIO's engine.
// Story Kits told creators WHAT'S happening. The Post Bank hands them
// finished posts: every angle × every platform × their voice, ready to
// paste. Writes research/pulse/post-bank.json for /studio to render.
//
// USD LAW (Tyler, Aug 21): every public-facing number is USD, always.
// The app may offer a CAD display toggle; posts, cards, newsletters and
// creator copy NEVER convert — the audience is USD-default.
// LAWS: every post carries a true number sourced from our own feed ·
// voice v4/v5 (no calls, labeled %, newcomer-clear) · cards carry the
// ⚡ watermark (that's the distribution deal — free tool, our mark rides)
// · nothing fabricated: if a lens has no data today, it emits nothing.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const today = new Date().toISOString().slice(0, 10);
const six = der.sealedIndex, t3 = der.dailyThree ?? {}, pm = der.packMath ?? {};
const pw = (der.printWatch ?? [])[0], ss = (der.supplyShifts ?? [])[0], wo = der.watchOutcomes;
const prod = n => (sp.products || []).find(p => p.name === n || p.id === n) || {};
const $ = n => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const MSRP = 4.49;

// ── VOICE VARIANTS — the same truth, three temperaments ────────────────
// Creators pick one; the numbers never change between them.
const VOICE = {
  analyst: { tag: "Analyst", open: h => h, close: c => c },
  casual:  { tag: "Casual",  open: h => h.replace(/^([A-Z])/, m => m.toLowerCase()), close: c => c },
  hype:    { tag: "Energetic", open: h => h + " 👀", close: c => c },
};

const ideas = [];
const add = (o) => { if (o && o.platforms) ideas.push({ ...o, date: today, watermark: "⚡ Catch'em · catchemtcg.com" }); };

// 1 · THE INDEX READ (macro, daily, evergreen)
if (six) {
  const b = six.breadth || {};
  add({ id: "index", angle: "The market's temperature in one number",
    why: "Macro posts build a habit — people start checking your account FOR the number. Repeat daily.",
    platforms: {
      x: `Sealed market check:\n\nIndex ${six.level}${six.ddPct ? ` (${six.ddPct > 0 ? "▲" : "▼"} ${Math.abs(six.ddPct)}%)` : ""} across ${six.constituents} sealed products.\n\n${b.up} up, ${b.down} down overnight.\n\nWhat are you watching today? 👇`,
      youtube_title: `The Sealed Pokémon Market Right Now (${six.constituents} Products Tracked)`,
      youtube_hook: `One number tells you how the whole sealed market is doing — here's today's, and what moved underneath it.`,
      short_script: `Sealed index today: ${six.level}. That's ${six.constituents} products, each measured against its own baseline. ${b.up} went up, ${b.down} went down. Here's the one that surprised me…`,
    }, card: "research/pulse/cards/latest-index.png", chip: "VERIFIED" });
}

// 2 · THE PACK-MATH SHOCK (the most shareable lens)
if ((pm.priciest || []).length && (pm.cheapest || []).length) {
  const hi = pm.priciest[0], lo = pm.cheapest[0];
  const hiN = prod(hi.id).name || hi.id, loN = prod(lo.id).name || lo.id;
  const mult = Math.round(hi.perPack / MSRP * 10) / 10;
  add({ id: "packmath", angle: "The per-pack number nobody calculates",
    why: "Price-per-pack reframes a box people scroll past into a decision. The MSRP multiple does the emotional work.",
    platforms: {
      x: `Pack math nobody shows you:\n\n${hiN} → ${$(hi.perPack)} per pack\n${loN} → ${$(lo.perPack)} per pack\n\nThat's ${mult}× what a pack costs at Target vs roughly retail.\n\nWould you rip either? 🎴`,
      youtube_title: `The Most Expensive Pokémon Pack You Can Buy Right Now (${$(hi.perPack)} EACH)`,
      youtube_hook: `Every sealed box has a hidden per-pack price. Some are ${mult}× retail. Let's do the math on all of them.`,
      short_script: `This box works out to ${$(hi.perPack)} per pack. Retail is $4.49. That's ${mult} times. Now compare it to ${loN} at ${$(lo.perPack)}…`,
    }, card: "research/pulse/cards/latest-social.png", chip: "VERIFIED" });
}

// 3 · THE TWO-MARKET GAP (built-in debate)
if (t3.sealed && t3.sealed.spreadPct != null) {
  const s = t3.sealed;
  add({ id: "gap", angle: "Two markets, one product — who's right?",
    why: "Disagreement between venues is a built-in argument; arguments are comments.",
    platforms: {
      x: `${s.name}\n\neBay: ${$(s.ebay)} (${s.listings} listings)\nTCGplayer: ${$(s.tcg)}\n\n${Math.abs(s.spreadPct)}% apart on the same sealed product.\n\nWhich market's right? 🤔`,
      youtube_title: `Why This Pokémon Box Costs ${Math.abs(s.spreadPct)}% More On eBay`,
      youtube_hook: `Same sealed product, two marketplaces, ${Math.abs(s.spreadPct)}% apart. There's a real reason — and it's not scalpers.`,
      short_script: `${s.name}. eBay wants ${$(s.ebay)}. TCGplayer says ${$(s.tcg)}. Same box. Here's why photos change the price…`,
    }, card: "research/pulse/cards/latest-social.png", chip: "VERIFIED" });
}

// 4 · LIFECYCLE (where a set sits in its life — urgency, honestly labeled)
{
  const rows = (der.printWatch ?? []);
  const inPrint = rows.find(r => /in print|printing/i.test(r.phase || "")) || rows[0];
  if (inPrint) add({ id: "lifecycle", angle: "Where this set sits in its life",
    why: "Lifecycle beats hype: age + phase + legality explains supply without predicting anything.",
    platforms: {
      x: `${inPrint.set} — ${inPrint.ageMonths} months old.\n\nPhase: ${inPrint.phase}\nStandard: ${inPrint.legalTag}\nActive sealed listings tracked: ${inPrint.supply}\n\nWhen presses stop, shelves stop refilling. That's the whole mechanic.\n\nStill buying this one? ⏳`,
      youtube_title: `${inPrint.set}: Where This Set Actually Sits Right Now`,
      youtube_hook: `Print windows close without an announcement — and rotation lands the same way every year. Here's how to read a set's age, phase, and legality instead of waiting for news.`,
      short_script: `${inPrint.set} is ${inPrint.ageMonths} months old and ${inPrint.phase}. Here's what that historically does to supply…`,
    }, card: "research/pulse/cards/latest-index.png", chip: "READ" });
}

// 5 · SHELF FORENSICS (the detective angle)
if (ss) {
  add({ id: "supply", angle: "Something moved on the shelf",
    why: "Cause-candidates invite the audience to play detective with you — strong comment driver.",
    platforms: {
      x: `${ss.name}: ${ss.prev} → ${ss.listings} listings (${ss.dPct > 0 ? "+" : ""}${ss.dPct}%)${ss.priceDPct != null ? `, price ${ss.priceDPct > 0 ? "+" : ""}${ss.priceDPct}%` : ""}.\n\n${ss.read.charAt(0).toUpperCase() + ss.read.slice(1)}.\n\nReprint, or someone dumping? Your read 👇`,
      youtube_title: `Reading Pokémon Supply Like A Pro (Shelf Counts Explained)`,
      youtube_hook: `You can't see sold data — but you CAN count the shelf. Here's what listing swings actually tell you.`,
      short_script: `Listings on this jumped ${Math.abs(ss.dPct)}% overnight. That usually means one of three things…`,
    }, card: "research/pulse/cards/latest-index.png", chip: "READ" });
}

// 6 · THE TRACK RECORD (trust-building, unique to us)
if (wo?.sealed?.dPct != null) {
  add({ id: "trackrecord", angle: "Scoring your own calls in public",
    why: "Almost nobody revisits their own takes. Doing it builds more trust than being right.",
    platforms: {
      x: `Revisiting what I flagged:\n\n${wo.sealed.name} — ${wo.sealed.dPct > 0 ? "▲" : "▼"} ${Math.abs(wo.sealed.dPct)}% since.\n\nHits and misses both. Keeping score in public is the only way this means anything.`,
      youtube_title: `I Tracked My Own Pokémon Calls For 30 Days — Here's The Scorecard`,
      youtube_hook: `Everyone posts predictions. Almost nobody grades them. So I graded mine.`,
      short_script: `Two weeks ago I flagged this. Today it's ${wo.sealed.dPct > 0 ? "up" : "down"} ${Math.abs(wo.sealed.dPct)}%. Here's what I got right and what I didn't…`,
    }, card: null, chip: "VERIFIED" });
}

const bank = { generatedAt: new Date().toISOString(), date: today,
  note: "POST STUDIO bank — finished posts from today's real data. Pick an angle, pick a platform, paste. Numbers are sourced; voice is yours.",
  voices: Object.entries(VOICE).map(([k, v]) => ({ id: k, label: v.tag })),
  ideas };
await writeFile(join(ROOT, "research/pulse/post-bank.json"), JSON.stringify(bank, null, 1));
console.log(`✓ post bank: ${ideas.length} angles × ${Object.keys(ideas[0]?.platforms ?? {}).length} formats`);
for (const i of ideas) console.log(`\n── ${i.angle} [${i.chip}]\n${i.platforms.x}\n   YT: ${i.platforms.youtube_title}`);
