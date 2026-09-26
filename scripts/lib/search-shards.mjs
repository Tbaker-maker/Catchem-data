// Split the search index by kind and the first two letters of a name or alias.
// The app loads the manifest, then only the shards a query needs.

import { normalize } from "./search-rank.mjs";

const KINDS = ["single", "sealed", "slab"];

export function prefixOf(text) {
  const flat = normalize(text).replace(/ /g, "");
  if (flat.length < 2) return null;
  return flat.slice(0, 2);
}

export function shardIdsForItem(item) {
  const kind = KINDS.includes(item?.kind) ? item.kind : "single";
  const prefs = new Set();
  const name = prefixOf(item?.name);
  if (name) prefs.add(`${kind}-${name}`);
  for (const alias of item?.aliases || []) {
    const pref = prefixOf(alias);
    if (pref) prefs.add(`${kind}-${pref}`);
  }
  return [...prefs].sort();
}

export function shardIdsForQuery(query, kind = "all") {
  const q = normalize(query);
  if (q.length < 2) return [];
  const prefs = new Set();
  const whole = prefixOf(q);
  if (whole) prefs.add(whole);
  for (const token of q.split(" ")) {
    const pref = prefixOf(token);
    if (pref) prefs.add(pref);
  }
  const kinds = kind === "all" ? KINDS : [kind];
  const ids = [];
  for (const one of kinds) for (const pref of prefs) ids.push(`${one}-${pref}`);
  return ids.sort();
}

export function trimItem(item) {
  const out = { id: item.id, name: item.name, kind: item.kind };
  for (const key of ["set", "number", "rarity", "subtype", "source", "asOf"]) {
    if (item[key]) out[key] = item[key];
  }
  if (Array.isArray(item.aliases) && item.aliases.length) out.aliases = item.aliases;
  if (typeof item.price === "number") out.price = item.price;
  return out;
}

export function buildShardMap(items) {
  const shards = new Map();
  for (const item of items || []) {
    const slim = trimItem(item);
    for (const id of shardIdsForItem(item)) {
      if (!shards.has(id)) shards.set(id, []);
      shards.get(id).push(slim);
    }
  }
  return shards;
}
