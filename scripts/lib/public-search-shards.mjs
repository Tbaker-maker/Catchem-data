// Shards of the public search-lite rows. One row sits in one shard:
// kind plus the first two letters of the name. Prices are the ones already on the row.

import { normalize } from "./search-rank.mjs";

const KINDS = ["single", "sealed", "slab"];

export function namePrefix(name) {
  const flat = normalize(name).replace(/ /g, "");
  if (flat.length < 2) return "__";
  return flat.slice(0, 2);
}

export function liteShardId(row) {
  const kind = KINDS.includes(row?.[5]) ? row[5] : "single";
  return `${kind}-${namePrefix(row?.[1])}`;
}

export function queryShardIds(query) {
  const q = normalize(query);
  if (q.replace(/ /g, "").length < 2 && q.length < 2) return [];
  const prefs = new Set();
  const whole = namePrefix(q);
  if (whole !== "__") prefs.add(whole);
  for (const token of q.split(" ")) {
    const pref = namePrefix(token);
    if (pref !== "__") prefs.add(pref);
  }
  const ids = [];
  for (const kind of KINDS) for (const pref of prefs) ids.push(`${kind}-${pref}`);
  return ids.sort();
}

export function buildLiteShards(rows) {
  const shards = new Map();
  for (const row of rows || []) {
    if (!Array.isArray(row) || !row[0]) continue;
    const id = liteShardId(row);
    if (!shards.has(id)) shards.set(id, []);
    shards.get(id).push(row);
  }
  return shards;
}
