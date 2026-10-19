// Writes research/assets/public/feed/card-rating.json. Runs after the IR cycle file.
// A failed build keeps the last file and does not fail the step.
import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { listingsBySet, series } from "./lib/ir-cycle.mjs";
import { groupIndex, pullTable, peerPools, shardOf, buildRatings, ratingReads, RATING_WEIGHTS, FACTOR_LABEL, GROUPS, FIRST_ED, MIN_PEERS, ratingSpecReady } from "./lib/card-rating.mjs";
import { monName } from "./lib/popular-pokemon.mjs";

// Index names use each card's real rarity: the TCGplayer rarity, with the variant tag where it says more.
function indexBase(g, rarity) {
  if (!g) return rarity;
  if (g.key === "tagteam-alt") return "Tag Team (Alternate Art)";
  if (g.key === "wotc-holo") return `WOTC ${rarity}`;
  if (g.key === "ex-era-ex") return `ex (${rarity})`;
  if (g.rarity || /^(Hyper Rare|Mega Hyper Rare|Radiant Rare|Prism Rare)$/.test(rarity)) return rarity;
  return `${g.one.replace(/ card$/, "")} (${rarity})`;
}
try {
  // No private spec: nothing new is written and the last file stays.
  if (!ratingSpecReady()) throw new Error("no private model spec, card rating not built");
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
  const pullDoc = JSON.parse(await readFile(join(PUB, "../../../data/pull-rates.json"), "utf-8").catch(() => "{}"));
  const pullRates = pullDoc.rows || [];
  const pulls = pullTable(pullDoc, rows);
  const list = buildRatings({ rows, longRows, variants, searchMons, readHits, bySet, rot, today, pullRates, pulls });
  const reads = ratingReads(list, { asOf: today });
  const groups = {};
  for (const r of list) groups[r.group] = (groups[r.group] || 0) + 1;
  const doc = {
    asOf: today,
    note: "Card Rating: a factual comparison of each card's TCGplayer market price and facts on file against similar cards. Not advice. Factor values are 0 to 1. Missing factors are left out and the rest rescaled.",
    // Weights and band cutoffs are not published (private methods rule). Labels are words only.
    labels: FACTOR_LABEL,
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
  await rm(join(PUB, "feed/rating/peers"), { recursive: true, force: true });
  await mkdir(join(PUB, "feed/rating/peers"), { recursive: true });
  for (const [k, rows] of Object.entries(peerPools(list))) await writeFile(join(PUB, `feed/rating/peers/${k}.json`), JSON.stringify({ asOf: today, cols: ["id", "name", "set", "num", "price", "date", "firstEd"], rows }) + "\n");
  // Public indexes (feed/rating/index/<key>.json, index-list.json). One TCGplayer rarity,
  // one generation per index. (a) all pull rates; (b) sets in one sourced pull-rate band.
  const ptsById = new Map();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of list) if (r.hasHist && !r.firstEd && byId.has(r.id)) ptsById.set(r.id, series(byId.get(r.id), longRows[r.id]));
  const IDX = join(PUB, "feed/rating/index");
  const prev = new Map();
  for (const f of (await readdir(IDX).catch(() => [])).filter((f) => f.endsWith(".json"))) { try { const d = JSON.parse(await readFile(join(IDX, f), "utf-8")); if (d.key) prev.set(d.key, d); } catch {} }
  await rm(IDX, { recursive: true, force: true });
  await mkdir(IDX, { recursive: true });
  const buckets = new Map();
  for (const r of list) {
    if (r.firstEd || r.check) continue;
    const ks = [r.index + "~all"];
    if (r.pullRate) ks.push(`${r.index}~pr${r.pullRate.band}`);
    for (const k of ks) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(r); }
  }
  const idxList = [], hidden = [];
  const pctTxt = (n) => `${Number(n).toFixed(2).replace(/0$/, "")}%`;
  for (const [key, members] of [...buckets].sort()) {
    const r0 = members[0];
    const g = [...GROUPS].find((x) => x.key === r0.group);
    const base = indexBase(g, r0.rarity);
    const similar = !key.endsWith("~all");
    const name = `${base} Index, ${r0.era}${similar ? `, similar pull rates (${r0.pullRate.lo === r0.pullRate.hi ? pctTxt(r0.pullRate.lo) : `${pctTxt(r0.pullRate.lo)} to ${pctTxt(r0.pullRate.hi)}`} per pack)` : ""}`;
    const fileKey = key.replace(/~/g, "--");
    if (members.length < 5) { hidden.push({ key: fileKey, name, members: members.length, reason: "fewer than 5 cards" }); continue; }
    const pts = groupIndex(members, ptsById, today);
    if (pts.length < 2) { hidden.push({ key: fileKey, name, members: members.length, reason: "fewer than 2 dated points with 5+ priced cards" }); continue; }
    const ids = members.map((r) => r.id).sort();
    const old = prev.get(fileKey);
    const changes = [...(old?.changes || [])];
    const startedToday = changes.length === 1 && changes[0].date === today && changes[0].started != null;
    if (!old || startedToday) changes.splice(0, changes.length, { date: today, started: ids.length });
    else {
      const was = new Set((old.members || []).map((m) => m[0])), now = new Set(ids);
      const added = ids.filter((id) => !was.has(id)), removed = [...was].filter((id) => !now.has(id));
      if (added.length || removed.length) {
        const t = changes.find((c) => c.date === today && c.added);
        if (t) { t.added = [...new Set([...t.added, ...added])].filter((id) => now.has(id)); t.removed = [...new Set([...t.removed, ...removed])].filter((id) => !now.has(id)); }
        else changes.push({ date: today, added, removed });
      }
    }
    const sets = new Map();
    for (const r of members) if (r.pullRate) sets.set(r.setSlug, { set: r.set, pct: r.pullRate.pct, ci95: r.pullRate.ci95, samplePacks: r.pullRate.samplePacks, url: r.pullRate.url, published: r.pullRate.published, article: r.pullRate.article });
    const doc = {
      key: fileKey, name, kind: similar ? "similar" : "all", group: r0.group, rarity: r0.rarity, era: r0.era, asOf: today,
      band: similar ? { lo: r0.pullRate.lo, hi: r0.pullRate.hi } : null, smallGroup: members.length < 10,
      source: "TCGplayer market, nightly buckets and hist-long", method: "Every 7 days: total value and typical (middle, equal-weight) price of member cards with a real price that day (last point at most 8 days old). n = cards priced that day. No point with fewer than 5 priced cards. Nothing filled. Members are matched by card id and TCGplayer rarity.",
      pullRates: [...sets.values()], cols: ["date", "total", "typical", "n"], points: pts, changes,
      members: members.sort((a, b) => b.price.price - a.price.price).map((r) => [r.id, r.name, r.set, r.num || "", r.price.price, r.price.date, r.rarity]),
    };
    await writeFile(join(IDX, `${fileKey}.json`), JSON.stringify(doc) + "\n");
    idxList.push({ key: fileKey, name, kind: doc.kind, rarity: r0.rarity, era: r0.era, members: members.length, smallGroup: doc.smallGroup, first: pts[0], last: pts.at(-1) });
  }
  await writeFile(join(PUB, "feed/rating/index-list.json"), JSON.stringify({ asOf: today, indexes: idxList, hidden }) + "\n");
  await writeFile(join(PUB, "feed/card-rating.json"), JSON.stringify(doc) + "\n");
  console.log(`card-rating: ${list.length} rows, ${reads.length} reads as of ${today}`, groups);
} catch (err) {
  console.error(`card-rating: kept the last file, ${err?.message || err}`);
}
