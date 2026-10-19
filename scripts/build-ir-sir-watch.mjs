// Nightly IR and SIR watch.
//   Public:  research/assets/public/feed/ir-sir.json (facts and reads, no score, no cutoff)
//   Private: catchem-data-private data/private/ir-sir/{latest.json, scored/<day>.json, backtest.json, proven.json}
// Rules (cutoffs, gates, read cap) live in data/private/ir-sir/rules.json. Run stage and
// seller tag reuse the signal chip rules in data/private/signal-chips/thresholds.json.
// Only signals the backtest marked proven add to the private score.
//   node scripts/build-ir-sir-watch.mjs              nightly (backtest reruns when 7 days old)
//   node scripts/build-ir-sir-watch.mjs --backtest   force the backtest
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { rotationChip, KIND_LABEL } from "./lib/ir-cycle.mjs";
import { sellerTag } from "./lib/seller-stage.mjs";
import { irKind, fullSeries, cardFacts, peerStats, listingNights, listingDirection, rotationDays, signalFlags, score, readLines, clean, shift } from "./lib/ir-sir-watch.mjs";
import { evaluate, summarize, provenWeights, scoreCheck } from "./lib/ir-sir-backtest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export async function loadCards() {
  const cards = [];
  const longRows = {};
  for (const f of (await readdir(join(PUB, "hist-long"))).filter((f) => /^\d+\.json$/.test(f))) Object.assign(longRows, (await J(join(PUB, "hist-long", f), {})).rows || {});
  for (const f of (await readdir(join(PUB, "buckets"))).filter((f) => f.endsWith(".json"))) {
    for (const r of (await J(join(PUB, "buckets", f), [])) || []) {
      const kind = irKind(r);
      if (!kind || !r.release || !r.setSlug || /promo/i.test(r.set || "")) continue;
      cards.push({ id: r.id, name: r.name, num: r.num, set: r.set, setSlug: r.setSlug, release: r.release, kind, pid: r.pid, pts: fullSeries(r, longRows[r.id]) });
    }
  }
  return cards;
}

async function listingDays(asOf) {
  const dir = join(ROOT, "data/derived/listing-counts/history");
  const files = (await readdir(dir).catch(() => [])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f) && f.slice(0, 10) <= asOf && f.slice(0, 10) > shift(asOf, -15)).sort();
  const out = [];
  for (const f of files) { try { out.push(JSON.parse(gunzipSync(await readFile(join(dir, f))).toString("utf8"))); } catch { /* skip a bad night */ } }
  return out;
}

export function buildToday(cards, { asOf, rules, rot, marks, nightsById, sellerSpec }) {
  const live = [];
  for (const c of cards) {
    const facts = cardFacts(c.pts, asOf, rules?.stage || null);
    if (!facts || facts.date < shift(asOf, -3)) continue;
    const nights = nightsById.get(c.id) || [];
    live.push({ ...c, facts, age: Math.round((Date.parse(asOf) - Date.parse(c.release)) / 86400000), rotDays: rotationDays(rot, c.setSlug, asOf, marks[c.id]?.mark), rotation: rotationChip(rot, c.setSlug, asOf, marks[c.id]?.mark), listings: listingDirection(nights, asOf), nights });
  }
  const todayShares = live.map((c) => c.nights.at(-1)).filter((n) => n && n.date === asOf && Number.isFinite(n.share)).map((n) => n.share);
  for (const c of live) c.seller = sellerSpec ? sellerTag(c.nights, todayShares, sellerSpec) : null;
  const peers = peerStats(live);
  for (const c of live) {
    c.peer = peers.get(`${c.setSlug}|${c.kind}`);
    c.flags = signalFlags(c, c.peer, rules || {});
    Object.assign(c, score(c.flags, rules || {}));
  }
  return live;
}

const TAG_WORDS = { laggard30: "Behind its set peers over 30 days", below90: "Under its 90 day average", cheapNonChase: "Among the lower priced cards of its kind in the set", pastOneYear: "Past one year since release", preRotation: "Rotation date announced", reversingUp: "Run stage Reversing ▲", buildingUp: "Run stage Building ▲", slowingUp: "Run stage Slowing ▲", reversingDown: "Run stage Reversing ▼", listingsDrain: "Listings counted falling", fewSellers: "Few sellers hold most" };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

export function publicDoc(live, { asOf, cap = 12 }) {
  const rows = live.map((c) => ({
    id: c.id, name: c.name, num: c.num, set: c.set, setSlug: c.setSlug, kind: c.kind, kindLabel: KIND_LABEL[c.kind], href: `/c/${c.id}`,
    image: c.pid ? `https://tcgplayer-cdn.tcgplayer.com/product/${c.pid}_in_400x400.jpg` : "",
    price: { price: c.facts.price, date: c.facts.date, source: "TCGplayer market" },
    change: { d7: r1(c.facts.ch7?.pct), d30: r1(c.facts.ch30?.pct), d90: r1(c.facts.ch90?.pct) },
    vsAverage: { d7: r1(c.facts.vs7), d30: r1(c.facts.vs30), d90: r1(c.facts.vs90) },
    setPeers: c.peer ? { n: c.peer.n, d30: r1(c.peer.ch30), d90: r1(c.peer.ch90), medianPrice: c.peer.price } : null,
    listingsCounted: c.listings ? { n: c.listings.n, date: c.listings.date, from: c.listings.from || null } : null,
    seller: c.seller ? { word: c.seller.word, share: c.seller.share, usual: c.seller.usual, date: c.seller.date } : null,
    stage: c.facts.stage, rotation: c.rotation ? { text: c.rotation.text, official: !!c.rotation.official } : null,
    release: c.release, daysSinceRelease: c.age,
    tags: Object.keys(c.flags).map((k) => TAG_WORDS[k]).filter(Boolean),
  })).sort((a, b) => (a.setSlug < b.setSlug ? -1 : a.setSlug > b.setSlug ? 1 : String(a.num).localeCompare(String(b.num), "en", { numeric: true })));
  const picks = live.filter((c) => c.score > 0 || c.facts.stage?.word === "Reversing").sort((a, b) => b.score - a.score || (b.facts.stage?.word === "Reversing") - (a.facts.stage?.word === "Reversing") || a.facts.price - b.facts.price);
  const reads = [];
  for (const c of picks) {
    const lines = readLines(c, c.peer);
    if (!lines.every(clean)) continue;
    reads.push({ id: `irsir-${c.id}-${asOf}`, sku: c.id, kind: "ir-sir", readKind: "ir-sir", cardKind: c.kind, name: c.name, set: c.set, setSlug: c.setSlug, price: c.facts.price, headline: lines[0], lines: lines.slice(1), text: lines.join(" "), tags: Object.keys(c.flags).map((k) => TAG_WORDS[k]).filter(Boolean), href: `/c/${c.id}`, image: c.pid ? `https://tcgplayer-cdn.tcgplayer.com/product/${c.pid}_in_400x400.jpg` : "", source: `TCGplayer market, ${c.facts.date}${c.listings ? `; eBay listings counted, ${c.listings.date}` : ""}`, asOf });
    if (reads.length >= cap) break;
  }
  const count = { IR: rows.filter((r) => r.kind === "IR").length, SIR: rows.filter((r) => r.kind === "SIR").length };
  return {
    asOf, pathway: "ir-sir",
    note: "Illustration Rares and Special Illustration Rares, tracked nightly. Facts with dates only, not advice. Prices are TCGplayer market. Listings counted are eBay US listings, same filters every night.",
    source: "TCGplayer market; eBay listings counted; rotation-status.json",
    count: { ...count, total: count.IR + count.SIR, withListings: rows.filter((r) => r.listingsCounted).length, withStage: rows.filter((r) => r.stage).length },
    reads, rows,
  };
}

async function main() {
  const asOf = (await J(join(PUB, "signal-chips.json"), {}))?.asOf || new Date().toISOString().slice(0, 10);
  const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
  const touched = [];
  try {
    const rules0 = await J(join(store.dir, "ir-sir/rules.json"), null);
    const chips = await J(join(store.dir, "signal-chips/thresholds.json"), {});
    if (!rules0) console.log("ir-sir: no rules file in the private store, so no signal fires");
    const rules = { ...(rules0 || {}), stage: rules0?.stage || chips?.stage || null };
    const rot = await J(join(PUB, "rotation-status.json"), {});
    const marks = (await J(join(PUB, "feed/card-marks.json"), {}))?.cards || {};
    const cards = await loadCards();
    let proven = (await J(join(store.dir, "ir-sir/proven.json"), null));
    const stale = !proven || proven.asOf < shift(asOf, -7);
    if (rules0 && (process.argv.includes("--backtest") || stale)) {
      const bt = rules0.backtest || {};
      const out = { asOf, method: "Anchors every step days. Facts use prices on or before the anchor only. Hit = card beat the median change of all tracked cards of its kind over the horizon.", horizons: {} };
      for (const h of bt.horizons || [30, 90]) {
        const rows = evaluate(cards, { rules, rot, marks, from: bt.from || "2024-06-02", to: shift(asOf, -h), step: bt.step || 14, horizon: h, split: bt.split || "2026-03-01" });
        const sum = summarize(rows, { minN: bt.minN ?? 100, minLift: bt.minLift ?? 0.03 });
        out.horizons[h] = { anchors: new Set(rows.map((r) => r.a)).size, rows: rows.length, ...sum };
        if (h === (bt.scoreHorizon || 30)) {
          const w = provenWeights(sum);
          out.horizons[h].scoreCheck = scoreCheck(rows, w);
          proven = { asOf, horizon: h, proven: w };
        }
      }
      await mkdir(join(store.dir, "ir-sir"), { recursive: true });
      await writeFile(join(store.dir, "ir-sir/backtest.json"), JSON.stringify(out, null, 1) + "\n");
      await writeFile(join(store.dir, "ir-sir/proven.json"), JSON.stringify(proven, null, 1) + "\n");
      touched.push("ir-sir/backtest.json", "ir-sir/proven.json");
      console.log(`ir-sir backtest: proven ${Object.keys(proven.proven).join(", ") || "none"}`);
    }
    rules.proven = proven?.proven || {};
    const days = await listingDays(asOf);
    const nightsById = new Map();
    const ids = new Set(cards.map((c) => c.id));
    for (const id of ids) { const n = listingNights(days, id); if (n.length) nightsById.set(id, n); }
    const live = buildToday(cards, { asOf, rules: rules0 ? rules : null, rot, marks, nightsById, sellerSpec: chips?.sellerTag || null });
    const doc = publicDoc(live, { asOf, cap: rules0?.readsCap ?? 12 });
    await writeFile(join(PUB, "feed/ir-sir.json"), JSON.stringify(doc) + "\n");
    const priv = { asOf, private: true, provenAsOf: proven?.asOf || null, rows: live.map((c) => ({ id: c.id, name: c.name, set: c.set, kind: c.kind, price: c.facts.price, date: c.facts.date, flags: Object.keys(c.flags), used: c.used, score: c.score, stage: c.facts.stage, listings: c.listings, seller: c.seller, rotDays: c.rotDays, age: c.age })).sort((a, b) => b.score - a.score) };
    await mkdir(join(store.dir, "ir-sir/scored"), { recursive: true });
    await writeFile(join(store.dir, "ir-sir/latest.json"), JSON.stringify(priv) + "\n");
    await writeFile(join(store.dir, `ir-sir/scored/${asOf}.json`), JSON.stringify(priv) + "\n");
    touched.push("ir-sir/latest.json", `ir-sir/scored/${asOf}.json`);
    console.log(`ir-sir: ${doc.count.IR} IR, ${doc.count.SIR} SIR tracked, ${doc.count.withListings} with listings counted, ${doc.count.withStage} with a run stage, ${doc.reads.length} reads`);
  } finally {
    if (store.remote) { const r = await store.close(touched, "IR and SIR watch"); console.log(`ir-sir private: ${r.pushed ? "stored" : r.reason}`); }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`ir-sir: kept the last file, ${e?.message || e}`); });
}
