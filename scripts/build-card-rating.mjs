// Writes research/assets/public/feed/card-rating.json. Runs after the IR cycle file.
// A failed build keeps the last file and does not fail the step.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { listingsBySet, series } from "./lib/ir-cycle.mjs";
import { groupIndex, peerPools, shardOf, buildRatings, ratingReads, RATING_WEIGHTS, FACTOR_LABEL, GROUPS, FIRST_ED, BELOW, ABOVE, MIN_PEERS } from "./lib/card-rating.mjs";
import { monName } from "./lib/popular-pokemon.mjs";

// Index names use each group's real rarity or variant name.
const INDEX_NAME = { "tagteam-alt": "Tag Team (Alternate Art) Index", tagteam: "Tag Team Index", "swsh-alt": "Alternate Art Index", tg: "Trainer Gallery Index", gg: "Galarian Gallery Index", sir: "Special Illustration Rare Index", ir: "Illustration Rare Index", "gold-star": "Gold Star Index", shining: "Shining Index", prism: "Prism Star Index", radiant: "Radiant Index", gold: "Gold Index", "ex-era-ex": "EX-era ex Index", "wotc-holo": "WOTC Holo Index" };

try {
  const PUB = join(dirname(fileURLToPath(import.meta.url)), "..", "research/assets/public");
  const J = async (p, d = null) => { try { return JSON.parse(await readFile(join(PUB, p), "utf-8")); } catch { return d; } };
  const rows = [];
  for (const f of (await readdir(join(PUB, "buckets"))).filter((f) => f.endsWith(".json"))) rows.push(...(await J("buckets/" + f)));
  const longRows = {};
  for (const f of (await readdir(join(PUB, "hist-long"))).filter((f) => /^\d+\.json$/.test(f))) Object.assign(longRows, (await J("hist-long/" + f)).rows || {});
  const variants = (await J("feed/card-variants.json", {}))?.cards || {};
  const searchMons = new Map();
  for (const s of (await J("search-lite.json", [])) || []) if (s[5] === "single") { const m = monName(s[1]); if (m) searchMons.set(m, (searchMons.get(m) || 0) + 1); }
  const readHits = new Map();
  for (const r of (await J("reads.json", {}))?.reads || []) if (["streak", "climb"].includes(r.readKind)) for (const id of [r.sku, ...(r.receipt?.up || []).map((u) => u.id)]) if (id) readHits.set(id, (readHits.get(id) || 0) + 1);
  const rot = await J("rotation-status.json");
  const RAW = join(PUB, "../../../data/raw/ebay-sealed");
  const gz = (await readdir(RAW).catch(() => [])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort();
  const readGz = async (f) => (f ? JSON.parse(gunzipSync(await readFile(join(RAW, f))).toString("utf-8")) : null);
  const bySet = listingsBySet(await readGz(gz[gz.length - 1]), await readGz(gz[gz.length - 2]));
  const today = rows.map((r) => r.asOf).filter(Boolean).sort().pop()?.slice(0, 10);
  const list = buildRatings({ rows, longRows, variants, searchMons, readHits, bySet, rot, today });
  const reads = ratingReads(list, { asOf: today });
  const groups = {};
  for (const r of list) groups[r.group] = (groups[r.group] || 0) + 1;
  const doc = {
    asOf: today,
    note: "Card Rating: a factual comparison of each card's TCGplayer market price and facts on file against similar cards. Not advice. Factor values are 0 to 1. Missing factors are left out and the rest rescaled.",
    weights: RATING_WEIGHTS, labels: FACTOR_LABEL, bands: { below: BELOW, above: ABOVE, minPeers: MIN_PEERS },
    groups: Object.fromEntries([...GROUPS, FIRST_ED].map((g) => [g.key, { label: g.label, count: groups[g.key] || 0 }])),
    method: "Doc: Catch'em Card Rating Method. Peer value = price against the median of the same group and popularity band (5+ peers), else the whole group.",
    count: list.length, shards: "feed/rating/NN.json, NN = shardOf(id)", reads,
  };
  const shards = new Map();
  for (const r of list) { const k = shardOf(r.id); if (!shards.has(k)) shards.set(k, []); shards.get(k).push(r); }
  await mkdir(join(PUB, "feed/rating"), { recursive: true });
  for (let i = 0; i < 64; i++) { const k = String(i).padStart(2, "0"); await writeFile(join(PUB, `feed/rating/${k}.json`), JSON.stringify({ asOf: today, rows: shards.get(k) || [] }) + "\n"); }
  // Internal review list for prices held back (not published to the site).
  const held = list.filter((r) => r.check).map((r) => ({ id: r.id, name: r.name, set: r.set, num: r.num, group: r.group, printing: r.printing, price: r.price, peerMedian: r.peers?.median ?? null, peerN: r.peers?.n ?? null, ratio: r.peers?.ratio ?? null, reason: r.peers && (r.peers.ratio < 0.1 || r.peers.ratio > 10) ? "more than 10x from peer median" : "1st Edition price below its own unlimited price" }));
  await writeFile(join(PUB, "../../../data/derived/card-rating-held.json"), JSON.stringify({ asOf: today, note: "Internal. Card Rating prices held for a check: no verdict, no read. Review against TCGplayer by id.", count: held.length, rows: held }, null, 1) + "\n");
  // Comparison lists for the "Compared with" panel. Old pool files are replaced.
  const { rm } = await import("node:fs/promises");
  await rm(join(PUB, "feed/rating/peers"), { recursive: true, force: true });
  await mkdir(join(PUB, "feed/rating/peers"), { recursive: true });
  for (const [k, rows] of Object.entries(peerPools(list))) await writeFile(join(PUB, `feed/rating/peers/${k}.json`), JSON.stringify({ asOf: today, cols: ["id", "name", "set", "num", "price", "date", "firstEd"], rows }) + "\n");
  // Public group indexes (feed/rating/index/<group>.json and index-list.json).
  const ptsById = new Map();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of list) if (r.hasHist && !r.firstEd && byId.has(r.id)) ptsById.set(r.id, series(byId.get(r.id), longRows[r.id]));
  await mkdir(join(PUB, "feed/rating/index"), { recursive: true });
  const idxList = [];
  for (const g of GROUPS) {
    const members = list.filter((r) => r.group === g.key && !r.firstEd && !r.check);
    if (members.length < 5) continue;
    const pts = groupIndex(members, ptsById, today);
    if (pts.length < 2) continue;
    const name = INDEX_NAME[g.key] || `${g.one} Index`;
    const first = pts[0], last = pts.at(-1);
    const doc = { key: g.key, name, asOf: today, source: "TCGplayer market, nightly buckets and hist-long", method: "Every 7 days: total and typical (middle) price of member cards with a real price that day (last point at most 8 days old). n = cards priced that day. Fewer than 5 priced cards: no point. Nothing filled.", cols: ["date", "total", "typical", "n"], points: pts,
      members: members.sort((a, b) => b.price.price - a.price.price).map((r) => [r.id, r.name, r.set, r.num || "", r.price.price, r.price.date]) };
    await writeFile(join(PUB, `feed/rating/index/${g.key}.json`), JSON.stringify(doc) + "\n");
    idxList.push({ key: g.key, name, members: members.length, first, last });
  }
  await writeFile(join(PUB, "feed/rating/index-list.json"), JSON.stringify({ asOf: today, indexes: idxList }) + "\n");
  await writeFile(join(PUB, "feed/card-rating.json"), JSON.stringify(doc) + "\n");
  console.log(`card-rating: ${list.length} rows, ${reads.length} reads as of ${today}`, groups);
} catch (err) {
  console.error(`card-rating: kept the last file, ${err?.message || err}`);
}
