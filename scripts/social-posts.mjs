// USD LAW (Tyler, Aug 21): public-facing numbers are USD, always.
// social-posts.mjs — the daily streak-post generator.
// Writes research/pulse/social-queue.json: ready-to-post text for up to
// three slots, each paired with a minted share card. Human posts them
// (10 seconds from a phone) until/unless the X API is worth paying for.
// DESIGN LAW: consistent skeleton, different content — variation comes
// from the DATA and rotating phrasings, never from randomness alone.
// Voice laws apply: labeled %, no calls, receipts, no hype adjectives.
import { flag } from "./flags.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const SITE = flag("site"); // public host — the app domain is unlisted (split 2026-08-22)
const METHODOLOGY_URL = `${SITE}/methodology.html`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const today = new Date().toISOString().slice(0, 10);

// ── DAY COUNTER: streak since series start (the commitment signal) ──────
const SERIES_START = "2026-08-24"; // launch weekend; edit once, never again
const dayNum = Math.max(1, Math.round((new Date(today) - new Date(SERIES_START)) / 86400000) + 1);

const six = der.sealedIndex, t3 = der.dailyThree ?? {}, pm = der.packMath ?? {};
const pw = (der.printWatch ?? [])[0], ss = (der.supplyShifts ?? [])[0];
const wo = der.watchOutcomes, roh = der.ripOrHold;
const prod = id => (sp.products || []).find(p => p.id === id) || {};
const money = n => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const MSRP_PACK = 4.49;
const msrpX = pp => pp ? Math.round(pp / MSRP_PACK * 10) / 10 : null;
const invite = arr => pick(arr, 3);

// Rotating openers keep the skeleton fixed and the surface fresh.
const pick = (arr, salt = 0) => arr[(dayNum + salt) % arr.length];

// ── SLOT 1 · MORNING — the index habit (the flagship series) ───────────
let morning = null;
if (six) {
  const dir = six.ddPct > 0 ? "▲" : six.ddPct < 0 ? "▼" : "flat";
  const b = six.breadth || {};
  const read = b.up > b.down * 1.5 ? `Broad green: ${b.up} products up, ${b.down} down.`
    : b.down > b.up * 1.5 ? `Broad red: ${b.down} down, ${b.up} up.`
    : `Split tape: ${b.up} up, ${b.down} down — no clear side today.`;
  const opener = pick([
    `Day ${dayNum} of tracking every sealed Pokémon product so you don't have to.`,
    `Day ${dayNum} of posting the sealed market's temperature, every morning.`,
    `Day ${dayNum}. One number for the whole sealed market:`,
  ]);
  morning = { slot: "morning", suggestedTime: "07:00 local", card: "research/pulse/cards/latest-index.png",
    text: [
      opener, "",
      `Catch'em Sealed Index: ${six.level} ${dir === "flat" ? "(flat)" : `${dir} ${Math.abs(six.ddPct)}%`}`,
      `${six.constituents} sealed products, each measured against its own baseline.`,
      `${six.constituents ? "All figures USD." : ""}`, "",
      read, "",
      `Method's public — no black box: ${METHODOLOGY_URL}`, "",
      invite(["What sealed product are you watching right now? \ud83d\udc47", "Anyone else checking listings before coffee, or just me? \u2615", "Bookmark it \u2014 tomorrow we see if today\u2019s read held. \ud83d\udccc"]),
    ].join("\n") };
}

// ── SLOT 2 · MIDDAY — one product, one honest number (the shotgun shape) ─
let midday = null;
{
  // rotate the lens daily: spread → pack math → print watch → supply shift
  const lens = dayNum % 4;
  if (lens === 0 && t3.sealed) {
    const p = prod((sp.products.find(x => x.name === t3.sealed.name) || {}).id);
    midday = { lens: "spread", card: "research/pulse/cards/latest-social.png", text: [
      `Day ${dayNum} of showing one sealed product's real numbers.`, "",
      `${t3.sealed.name} — ${money(t3.sealed.ebay)}`, "",
      `eBay asks ${Math.abs(t3.sealed.spreadPct)}% ${t3.sealed.spreadPct > 0 ? "more" : "less"} than TCGplayer right now, across ${t3.sealed.listings} listings.`,
      p.priceFloorClean ? `Clean floor sits at ${money(p.priceFloorClean)}.` : "", "",
      `Not a call. Just the shelf, counted this morning.`, "",
      invite(["Fair price, or would you wait? \ud83e\udd14", "Buying, holding, or scrolling past? \ud83d\udc47", "If you own one \u2014 would you sell at this number?"]),
    ].filter(Boolean).join("\n") };
  } else if (lens === 1 && (pm.priciest || []).length) {
    const hi = pm.priciest[0], lo = (pm.cheapest || [])[0];
    midday = { lens: "packmath", card: "research/pulse/cards/latest-index.png", text: [
      `Day ${dayNum} of pack math nobody shows you.`, "",
      `Most expensive rip today: ${prod(hi.id).name || hi.id} — ${money(hi.perPack)} per pack.`,
      lo ? `Cheapest: ${prod(lo.id).name || lo.id} — ${money(lo.perPack)} per pack.` : "", "",
      lo && hi ? `Same hobby, ${Math.round(hi.perPack / lo.perPack)}× apart.` : "", "",
      `Every box we track, per-pack: catchemtcg.com`,
    ].filter(Boolean).join("\n") };
  } else if (lens === 2 && pw) {
    midday = { lens: "printwatch", card: "research/pulse/cards/latest-index.png", text: [
      `Day ${dayNum} of watching the print window close.`, "",
      `${pw.name || pw.setId} — roughly ${pw.daysLeft ?? "?"} days of print left (estimated from a 30-month model, not an announcement).`, "",
      `When the presses stop, the shelf stops refilling. That's the whole mechanic.`, "",
      `Countdowns for every set: catchemtcg.com`, "",
      invite(["Grabbing one before the window shuts, or letting it ride? \u23f3", "Which set do you wish you\u2019d bought more of before it dried up? \ud83d\udc47"]),
    ].join("\n") };
  } else if (ss) {
    midday = { lens: "supply", card: "research/pulse/cards/latest-index.png", text: [
      `Day ${dayNum} of counting shelves.`, "",
      `${ss.name}: ${ss.prev} → ${ss.listings} listings (${ss.dPct > 0 ? "+" : ""}${ss.dPct}%)${ss.priceDPct != null ? `, price ${ss.priceDPct > 0 ? "+" : ""}${ss.priceDPct}%` : ""}.`, "",
      `${ss.read.charAt(0).toUpperCase() + ss.read.slice(1)}.`, "",
      `Estimate, not a verdict — the method's public.`,
    ].join("\n") };
  }
  if (midday) { midday.slot = "midday"; midday.suggestedTime = "12:30 local"; }
}

// ── SLOT 3 · EVENING — community (the loop back to Discord) ─────────────
let evening = null;
if (roh) {
  evening = { slot: "evening", suggestedTime: "18:00 local", card: null, text: [
    `Day ${dayNum}. Rip or hold?`, "",
    roh.question, "",
    wo?.sealed?.dPct != null ? `Yesterday's watch (${wo.sealed.name}) moved ${wo.sealed.dPct > 0 ? "▲" : "▼"} ${Math.abs(wo.sealed.dPct)}% since we flagged it — we keep our own score.` : "",
    "", `Vote's live in the Discord. Free to join, free to play.`,
  ].filter(Boolean).join("\n") };
}

// publish-guard: drop any slot whose copy mentions a blocked product —
// upstream picks may predate qa-gate's flags (2026-08-22 leak class).
const { loadBlocked } = await import("./lib/publish-guard.mjs");
const __blk = await loadBlocked();
const slots = [morning, midday, evening].filter(Boolean).filter(s => {
  const hit = __blk.mentions(JSON.stringify(s));
  if (hit) console.log(`  · social queue: dropped ${s.slot} slot — mentions blocked product (${hit})`);
  return !hit;
});
const queue = { generatedAt: new Date().toISOString(), date: today, dayNumber: dayNum,
  note: "Ready-to-post copy. Post from phone (10s each) or wire the X API later. One slot a day is the floor; three is the ceiling.",
  posts: slots };
await writeFile(join(ROOT, "research/pulse/social-queue.json"), JSON.stringify(queue, null, 1));
console.log(`✓ social queue: day ${dayNum}, ${queue.posts.length} posts ready`);
for (const p of queue.posts) console.log(`\n── ${p.slot} (${p.suggestedTime})${p.lens ? ` · lens: ${p.lens}` : ""}\n${p.text}\n`);
