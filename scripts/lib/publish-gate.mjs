// Publish gate. Runs over every published read before publish (nightly) and in
// PR CI. Each rule names a bug class seen in a reads check. A single bad read
// is dropped with a logged reason; only systemic breakage fails the run.
import { flagLine } from "./copy-rules.mjs";
import { storyUnstable } from "./read-stability.mjs";
import { lowValueMove } from "./feed-rank.mjs";
import { BACK_TO_RECENT_DAYS } from "./history-reads.mjs";
import { addDays } from "./market-meter.mjs";

export const SHORT_MAX = 35; // same short window cap as the Price tile (#374)
export const VINTAGE_CUTOFF = "2003-06-01";
const DASH = /[\u2014\u2013]/g;
const CATEGORY_NAME = /^(?:Sealed )?Rating:|^(?:Illustration Rares?|Special Illustration Rares?|Ultra Rares?|Hyper Rares?|Booster Box(?:es)?|Elite Trainer Box(?:es)?)$/i;
export const RAW_CODE = /#[A-Z]{1,4}\/[A-Z]{2,}\b|\bare #[A-Za-z0-9/]+ at \$/;
const DUP_NUM = /(\d+\/\d+)\s*#\1\b/;
const CONDITION = /\b(?:NM|Near Mint|LP|Lightly Played|MP|Moderately Played|HP|Heavily Played|DMG|Damaged)\b/;
const COPY_FIELDS = ["name", "headline", "path", "blurb", "why", "whyItMatters", "whatWouldMakeThisWrong"];

export const RULES = [
  ["dash", "Em or en dash in copy (stripped, read kept)"],
  ["title", "Malformed title: category words as the name, a doubled card number, or a dash"],
  ["direction", "Headline direction disagrees with the Price tile or run stage over the same window"],
  ["window", "Price tile window longer than the short window cap"],
  ["fact-date", "Same high or low shown with two different dates"],
  ["stale", "Read dated before the latest nightly data for that product"],
  ["condition", "Condition label on a sealed product"],
  ["listings-zero", "Zero or missing listings counted shown"],
  ["image", "Image URL missing or malformed (field removed so the page falls back)"],
  ["era", "Vintage tag on a set or promo that is not WOTC before 2003-06-01"],
  ["repeat", "Same read as the previous day"],
  ["advice", "Advice wording from the shared copy rules"],
  ["tiles", "Priced card or sealed read with no flip tiles"],
  ["pattern-rate", "Pattern line leads with a bare rate under 50%"],
  ["ratio", "Sealed multiple does not match the dated dollar pair, one decimal"],
  ["own-date", "A listings count is not from the read date"],
  ["printing", "Finish tag does not match the priced printing"],
  ["stability", "Card story misses the private point floor or high/low bar"],
  ["back-to", "Back-to target is stale, or the return into the band is not recent"],
  ["name", "Page or card has no display name, or the name is a raw code"],
  ["sold", "Copy says sold or sales"],
  ["empty", "No headline and no path"],
  ["low-value", "Cheap card with a tiny dollar move"],
  ["mixed-stale", "Mixed read pairs a fresh price with stale listings counted"],
  ["change-conflict", "One read shows two different change figures for the same story"],
  ["species-number", "A species count line names a different card printing"],
];

const isSealed = (r) => r.kind === "sealed" || r.readKind === "sealed" || r.readKind === "listings" || r.kind === "listings" || /^\/p\//.test(r.href || "") || (r.sku && !/^tcgcsv-/.test(r.sku) && r.family === "listings");
const headDir = (s) => { const m = /\b(Up|Down|up|down|fell|rose)\b/.exec(String(s || "")); return m ? (/^(up|rose)$/i.test(m[1]) ? "up" : "down") : ""; };
const pricedProduct = (r) => {
  const price = Number(r?.price);
  if (!(price > 0)) return false;
  if (/price being checked/i.test(String(r?.headline || ""))) return false;
  const kind = String(r?.kind || r?.readKind || "");
  return kind === "single" || kind === "sealed" || kind === "listings" || kind === "move" || /^\/(?:c|p)\//.test(String(r?.href || ""));
};
const hasTiles = (chip) => {
  const t = chip?.tiles;
  return !!(t && typeof t === "object" && (t.data || t.price || t.listings));
};

function stripDashes(v) {
  if (typeof v === "string") return v.replace(/\s*[\u2014\u2013]\s*/g, (m) => (/\s/.test(m) ? ": " : "-"));
  if (Array.isArray(v)) return v.map(stripDashes);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = stripDashes(v[k]); return o; }
  return v;
}

const RAW_NAME = /^(?:tcgcsv-\d+|#[A-Za-z0-9/]+|[a-z]{1,8}\d[a-z0-9]*)$/i;
const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthDay(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `${MONS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}`;
}
function daySpan(a, b) {
  const left = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`);
  const right = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.round((right - left) / 86400000);
}
const SOLD_WORD = /\b(?:sold|sales)\b/i;
function copyBlob(r) {
  return ["headline", "path", "blurb", "why", "whyItMatters", "whatWouldMakeThisWrong"]
    .map((k) => r?.[k])
    .concat(r?.lines || [])
    .filter((s) => typeof s === "string")
    .join("\n");
}
function copyText(r) {
  return [r.headline, r.blurb, r.pattern?.line, ...(r.lines || []), ...(r.variants || [])].filter((s) => typeof s === "string").join("\n");
}
function dollarsIn(line) {
  return [...String(line).matchAll(/\$(\d[\d,]*(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
}
function honestTimes(n) { return Math.round(n * 10) / 10; }

// A sealed-vs-chase headline that names Nx tonight and Mx on a date must match the dollar lines.
function ratioOff(read) {
  const head = String(read?.headline || "");
  const m = head.match(/costs (\d+(?:\.\d+)?)x\b[\s\S]*?\bfrom (\d+(?:\.\d+)?)x on /);
  if (!m) return false;
  const pairs = (read.lines || []).map(dollarsIn).filter((row) => row.length >= 2);
  if (pairs.length < 2) return false;
  const [sealedStart, sealedEnd] = pairs[0];
  const [cardStart, cardEnd] = pairs[1];
  if (!(sealedStart > 0) || !(sealedEnd > 0) || !(cardStart > 0) || !(cardEnd > 0)) return false;
  const cardSide = /the sealed price/.test(head);
  const now = cardSide ? cardEnd / sealedEnd : sealedEnd / cardEnd;
  const then = cardSide ? cardStart / sealedStart : sealedStart / cardStart;
  return honestTimes(now) !== Number(m[1]) || honestTimes(then) !== Number(m[2]);
}

function storyStats(read) {
  const text = (read.lines || []).filter((s) => typeof s === "string").join("\n");
  const n = text.match(/(\d+) TCGplayer market points/);
  const peak = text.match(/Peak \$([\d,]+\.\d+)/);
  const low = text.match(/Low \$([\d,]+\.\d+)/);
  if (!n || !peak || !low) return null;
  return { points: Number(n[1]), peak: Number(peak[1].replace(/,/g, "")), low: Number(low[1].replace(/,/g, "")) };
}

function vintageOn(read, ctx) {
  if ((read.tags || []).includes("Vintage")) return true;
  const sig = ctx.chips?.[read.id]?.signals || read.signals || [];
  return sig.some((s) => s && s.kind === "era" && s.tag === "Vintage");
}

// A pattern headline whose first sentence is a bare percent under 50, and not an Nx lift.
// Price headlines such as "Down 17%" are not pattern copy, so they stay.
function bareLowPattern(read) {
  const bits = [read?.headline, read?.pattern?.line, ...(read?.lines || [])].filter((s) => typeof s === "string");
  for (const bit of bits) {
    const head = bit.trim();
    if (!head) continue;
    const first = head.split(/[!?]|\.(?:\s|$)/)[0].trim();
    if (/^\d+(?:\.\d+)?x\b/.test(first)) continue;
    const m = first.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!m || !(Number(m[1]) < 50)) continue;
    const kind = String(read.readKind || read.kind || "");
    if (/^pattern/i.test(kind) || /\b(were right|was right|past cases|normally|this pattern|pattern)\b/i.test(head) || bit === read?.pattern?.line) return true;
  }
  return false;
}


// Mixed sealed that still carries a listings date far behind asOf must not publish.
function mixedStale(read, ctx) {
  if (String(read?.readKind || read?.kind || "") !== "mixed") return false;
  if (read?.stale === true) return true;
  const asOf = String(ctx.asOf || read?.asOf || "").slice(0, 10);
  const listingTo = String(read?.receipt?.listingsTo || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf) && /^\d{4}-\d{2}-\d{2}$/.test(listingTo)) {
    const age = daySpan(listingTo, asOf);
    if (age != null && age > 2) return true;
  }
  // Headline that names an Oct listings half while asOf is much later.
  const blob = `${read?.headline || ""}\n${(read?.lines || []).join("\n")}`;
  const m = blob.match(/Listings counted[^\n]*\bon\s+(\d{4}-\d{2}-\d{2})\s*\./i)
    || blob.match(/Listings counted[^\n]*to\s+\d+\s+on\s+(\d{4}-\d{2}-\d{2})/i);
  if (m && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    const age = daySpan(m[1], asOf);
    if (age != null && age > 2) return true;
  }
  return false;
}

// Headline "Down 31% in 31 days" next to a trend line "Down 19.8% from Sep 26" on the same read.
function changeConflict(read) {
  const head = String(read?.headline || "");
  const hm = head.match(/\b(?:Up|Down)\s+(\d+(?:\.\d+)?)%\s+in\s+(\d+)\s+days/i);
  if (!hm) return false;
  const headPct = Number(hm[1]);
  const headDays = Number(hm[2]);
  if (!(headDays >= 14 && headDays <= 45)) return false;
  for (const line of read?.lines || []) {
    const tm = String(line).match(/\b(?:Up|Down)\s+(\d+(?:\.\d+)?)%\s+from\s+[A-Z][a-z]{2}\s+\d{1,2}\s+to\s+[A-Z][a-z]{2}\s+\d{1,2}/);
    if (!tm) continue;
    const linePct = Number(tm[1]);
    if (Math.abs(headPct - linePct) >= 5) return true;
  }
  return false;
}

// "Number 2 of 27 Umbreon 059/131 cards" on a 161/131 read.
function speciesNumberMismatch(read) {
  const own = String(read?.number || read?.receipt?.num || "").trim();
  if (!own) return false;
  for (const line of read?.lines || []) {
    const m = String(line).match(/Number\s+\d+\s+of\s+\d+\s+.+?\s+(\d+\/\d+)\s+cards we price/i);
    if (!m) continue;
    if (m[1] !== own) return true;
  }
  return false;
}

export function checkRead(read, ctx = {}) {
  const flags = [];
  let r = read;
  if (DASH.test(JSON.stringify(r))) { DASH.lastIndex = 0; r = stripDashes(r); flags.push({ rule: "dash", action: "fix" }); }
  DASH.lastIndex = 0;
  const name = String(r.name || "");
  if (CATEGORY_NAME.test(name) || DUP_NUM.test(name)) flags.push({ rule: "title", action: "drop", note: name });
  else if (COPY_FIELDS.concat(["line"]).some((k) => typeof r[k] === "string" && RAW_CODE.test(r[k])) || (r.lines || []).some((l) => RAW_CODE.test(String(l)))) flags.push({ rule: "title", action: "drop", note: "raw card code instead of a name" });
  const chip = ctx.chips?.[r.id];
  const tile = chip?.tiles?.price;
  const hd = headDir(r.headline);
  const rw = Number(r.windowDays) || 0;
  if (tile && !tile.dash) {
    if (Number(tile.days) > Math.max(SHORT_MAX, rw + 3)) flags.push({ rule: "window", action: "drop", note: `${tile.days}D` });
    else if (hd && rw && Number(tile.days) === rw && tile.dir && tile.dir !== "flat" && tile.dir !== hd) flags.push({ rule: "direction", action: "drop", note: `headline ${hd}, tile ${tile.dir}` });
    const st = tile.stage;
    if (st && hd && rw === 7 && st.dir && st.dir !== hd && st.word === "Building") flags.push({ rule: "direction", action: "drop", note: `headline ${hd}, stage ${st.word} ${st.dir}` });
  }
  const between = r.receipt?.between;
  if (between?.date && ctx.facts) {
    const f = ctx.facts(r.id);
    for (const k of ["high", "low"]) {
      const x = f?.range?.[k];
      if (x && Number(x.price) === Number(between.price) && x.date !== between.date) flags.push({ rule: "fact-date", action: "drop", note: `${between.date} vs ${x.date}` });
    }
  }
  if ((r.readKind === "listings" || r.kind === "listings") && ctx.listings) {
    const lc = ctx.listings[r.sku];
    if (lc?.date && r.asOf && r.asOf < lc.date) flags.push({ rule: "stale", action: "drop", note: `${r.asOf} < ${lc.date}` });
  }
  if ((r.readKind === "listings" || r.kind === "listings") && !(Number(r.receipt?.n) > 0)) flags.push({ rule: "listings-zero", action: "drop" });
  if (isSealed(r)) {
    const text = COPY_FIELDS.map((k) => r[k]).concat(r.lines || [], r.tags || []).filter((s) => typeof s === "string").join(" \n ");
    if (CONDITION.test(text)) flags.push({ rule: "condition", action: "drop" });
  }
  if (r.image != null && r.image !== "" && !(typeof r.image === "string" && /^(https:\/\/|\/)[^\s"'<>]+$/.test(r.image))) {
    r = { ...r }; delete r.image; flags.push({ rule: "image", action: "fix" });
  }
  if (vintageOn(r, ctx)) {
    const rel = ctx.sets ? String(ctx.sets[r.set] || "") : "";
    const cardRel = String(ctx.cardReleases?.[r.sku] || ctx.cardReleases?.[r.id] || "").slice(0, 10);
    const promo = (r.tags || []).includes("Promo") || /promo/i.test(String(r.set || ""));
    const cardOk = /^\d{4}-\d{2}-\d{2}$/.test(cardRel);
    if (promo) {
      if (cardOk && cardRel < VINTAGE_CUTOFF) { /* the card's own day is WOTC */ }
      else flags.push({ rule: "era", action: "drop", note: cardOk ? cardRel : (rel || "promo without a card date") });
    } else if (rel && rel >= VINTAGE_CUTOFF) flags.push({ rule: "era", action: "drop", note: `${r.set} ${rel}` });
  }
  const p = ctx.prev?.[r.id];
  const dated = r.endDate || r.readKind === "listings" || r.readKind === "sealed";
  if (dated && p && ctx.asOf && p.asOf && p.asOf < ctx.asOf && p.headline === r.headline && p.endDate === r.endDate) flags.push({ rule: "repeat", action: "drop" });
  for (const k of COPY_FIELDS) {
    const v = r[k];
    if (typeof v !== "string") continue;
    const hit = flagLine(v, { field: k, id: r.id });
    if (hit.length) { flags.push({ rule: "advice", action: "drop", note: hit[0].phrase }); break; }
  }
  for (const l of r.lines || []) { const hit = flagLine(l, { field: "lines", id: r.id }); if (hit.length) { flags.push({ rule: "advice", action: "drop", note: hit[0].phrase }); break; } }
  if (pricedProduct(r) && !hasTiles(chip)) flags.push({ rule: "tiles", action: "drop", note: "priced read with no tiles" });
  if (bareLowPattern(r)) flags.push({ rule: "pattern-rate", action: "drop", note: String(r.headline || r.pattern?.line || "").slice(0, 80) });
  if (ratioOff(r)) flags.push({ rule: "ratio", action: "drop", note: "multiple does not match the dated prices" });
  if ((r.readKind === "listings" || r.kind === "listings") && ctx.asOf && r.asOf && r.asOf !== ctx.asOf) flags.push({ rule: "own-date", action: "drop", note: `${r.asOf} on a ${ctx.asOf} read` });
  const factDate = r.receipt?.date;
  if (factDate && r.asOf && factDate !== r.asOf && !copyText(r).includes(monthDay(factDate))) flags.push({ rule: "own-date", action: "drop", note: `${factDate} not named` });
  if ((r.tags || []).includes("Reverse Holo")) {
    const named = String(r.why || "").match(/finish \(([^)]+)\)/i);
    const priced = String(r.printing || r.receipt?.printing || (named ? named[1] : ""));
    if (!/^Reverse Holofoil$/i.test(priced)) flags.push({ rule: "printing", action: "drop", note: priced || "no priced printing" });
  }
  const stats = storyStats(r);
  if (stats && storyUnstable(stats.points, stats.peak, stats.low, ctx.stability)) flags.push({ rule: "stability", action: "drop", note: `${stats.points} points` });
  if (r.readKind === "backto" || r.kind === "backto") {
    const window = Number.isFinite(Number(ctx.backToRecentDays)) ? Number(ctx.backToRecentDays) : BACK_TO_RECENT_DAYS;
    const returned = r.receipt?.returned;
    const age = returned && r.asOf ? daySpan(returned, r.asOf) : null;
    if (age == null || age > window) flags.push({ rule: "back-to", action: "drop", note: returned || "no recent return" });
  }
  if (!name.trim() || RAW_NAME.test(name.trim()) || CATEGORY_NAME.test(name)) flags.push({ rule: "name", action: "drop", note: name || "blank" });
  for (const row of r.lineCards || []) {
    for (const card of row?.cards || []) {
      if (card && !String(card.title || card.name || "").trim()) { flags.push({ rule: "name", action: "drop", note: "blank card title" }); break; }
    }
  }
  if (SOLD_WORD.test(copyBlob(r))) flags.push({ rule: "sold", action: "drop", note: "sold or sales" });
  if (!String(r.headline || "").trim() && !String(r.path || "").trim()) flags.push({ rule: "empty", action: "drop", note: "no sentence" });
  if (lowValueMove(r, ctx.floor)) flags.push({ rule: "low-value", action: "drop", note: "cheap tiny move" });
  if (mixedStale(r, ctx)) flags.push({ rule: "mixed-stale", action: "drop", note: "stale listings half" });
  if (changeConflict(r)) flags.push({ rule: "change-conflict", action: "drop", note: "two change figures" });
  if (speciesNumberMismatch(r)) flags.push({ rule: "species-number", action: "drop", note: "species line names another printing" });
  const drop = flags.some((f) => f.action === "drop");
  return { read: drop ? null : r, flags };
}

export function gateReads(reads, ctx = {}, { maxDropShare = 0.25 } = {}) {
  const kept = [], log = [];
  const counts = Object.fromEntries(RULES.map(([id]) => [id, 0]));
  for (const read of reads || []) {
    const { read: out, flags } = checkRead(read, ctx);
    for (const f of flags) { counts[f.rule] += 1; log.push({ id: read.id, ...f }); }
    if (out) kept.push(out);
  }
  const dropped = (reads?.length || 0) - kept.length;
  const systemic = reads?.length > 20 && dropped / reads.length > maxDropShare;
  return { kept, dropped, counts, log, systemic };
}

const METER_BANNED = /\b(buy|sell|load up|time to|don't miss|do not miss|to the moon)\b/i;

// A published meter needs both sides at or above the private minimum, and an
// asOf no more than 2 days behind the price file. A thin or stale file is
// unpublished. A missing spec is not this function's job: the build writes
// nothing new, and the gate leaves yesterday's file alone.
export function checkMeter(doc, { minComponents = 0, freshAsOf = "" } = {}) {
  if (!doc || typeof doc !== "object" || doc.published === false) return { ok: true, action: "skip", reasons: [] };
  const min = Number(minComponents) >= 1 ? Number(minComponents) : Number(doc.minComponents);
  const reasons = [];
  const market = doc.market || {};
  if (!(min >= 1)) reasons.push("minimum");
  if (market.mood == null || market.heat == null) reasons.push("missing");
  if (!(Number(market.moodUsed) >= min) || !(Number(market.heatUsed) >= min)) reasons.push("thin");
  const fresh = String(freshAsOf || "").slice(0, 10);
  const asOf = String(doc.asOf || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fresh) && /^\d{4}-\d{2}-\d{2}$/.test(asOf) && asOf < addDays(fresh, -2)) reasons.push("stale");
  const copy = JSON.stringify(market.reasons || []);
  if (METER_BANNED.test(copy) || /[\u2014\u2013]/.test(copy)) reasons.push("copy");
  return { ok: reasons.length === 0, action: reasons.length ? "drop" : "keep", reasons };
}

export function unpublishMeter(doc) {
  return {
    ...doc,
    published: false,
    market: null,
    singles: null,
    sealed: null,
    vintage: null,
    modern: null,
    eras: {},
    sets: {},
  };
}
