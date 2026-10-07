// lib/publish-guard.mjs — ONE ANSWER to "is this product publishable?"
//
// WHY THIS EXISTS (2026-08-22 CI run 32546464574): qa-gate stamps
// publishBlock onto data/sealed-prices.json — but the nightly fetch
// REBUILDS that file, so every consumer that runs between the fetch and
// qa-gate (compute-divergence, compute-derived) read a world with zero
// flags. The manifest wires all matched textually while the flags they
// checked were empty at runtime. Pokemon GO ETB (manually quarantined
// 2026-08-21) walked through four editorial surfaces; publish-assert
// caught it at the last line.
//
// The durable truth is data/quarantine.json (survives rebuilds, by
// design). This helper unions it with whatever publishBlock flags exist
// right now, and exposes the check by id AND by display name (the form a
// reader actually sees — publish-assert greps names, so producers must
// filter names too).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

export async function loadBlocked() {
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const mq = await J("data/quarantine.json") ?? { entries: [] };
  const ids = new Set((mq.entries || []).map(e => e.id));
  for (const p of sp.products || []) if (p.publishBlock) ids.add(p.id);
  return makeBlocked(ids, sp.products || [], mq.entries || []);
}

// The check itself, from a set of held ids and the product list that names
// them. loadBlocked builds it from the files; tests build it directly.
export function makeBlocked(heldIds, products = [], entries = []) {
  const ids = new Set(heldIds);
  const names = new Set();
  for (const p of products) if (ids.has(p.id) && p.name) names.add(p.name);
  const blocked = (idOrName) => idOrName != null && (ids.has(idOrName) || names.has(idOrName));
  // For assembled editorial payloads (post ideas, story kits): does the
  // serialized content mention any blocked product by name or quoted id?
  const mentions = (text) => {
    const t = String(text ?? "");
    for (const n of names) if (t.includes(n)) return n;
    for (const i of ids) if (t.includes(`"${i}"`)) return i;
    return null;
  };
  // The public "held" label should say WHY in the product's own terms; the
  // durable file already carries a reason, so consumers need not invent one.
  const reasonFor = (id) => {
    const e = entries.find(x => x.id === id);
    return e ? `manually quarantined ${e.since} (${e.by}): ${e.reason}` : null;
  };
  return { ids, names, blocked, mentions, reasonFor };
}

// ── ONE FILTER AT THE DATA-LOAD POINT (2026-10-06) ─────────────────────────
// Every editorial list used to need its own editorial()/blocked() call at
// render time, and each new list that forgot it leaked a held product:
// "Keeps showing up" (#92), Supply shifts (#96), Deepest markets
// (depthReads), the pack-math story kit and the feed's packMath, the feed's
// ripSellTrade (read from the previous run's file), the Rip or Hold line in
// Discord, and the share cards' Daily Three. Derived files are computed
// BEFORE qa-gate stamps tonight's flags, so the fix is to scrub them once,
// when they are read: a held product is removed from every list and any
// single-product slot that names it becomes null. Consumers then cannot
// skip the filter, because the held rows are not in what they were handed.
// The Board's own product catalog (data/sealed-prices.json) is NOT read
// through this: held products stay on the Board, labeled held.
const ROW_KEYS = ["id", "productId", "sku", "name", "flagship", "subject", "title"];
export function heldRow(row, blk) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  for (const k of ROW_KEYS) if (typeof row[k] === "string" && blk.blocked(row[k])) return true;
  for (const v of Object.values(row)) if (typeof v === "string" && blk.mentions(v)) return true;
  return false;
}
// Lists drop held rows and bare held ids/names; objects drop entries keyed by
// a held id (per-product maps such as dealZone.byId) and null any slot that
// is itself a held row (a Daily Three pick, a watch outcome).
export function scrubHeld(value, blk) {
  if (Array.isArray(value)) {
    return value
      .filter((x) => !(typeof x === "string" && blk.blocked(x)) && !heldRow(x, blk))
      .map((x) => scrubHeld(x, blk));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (blk.ids.has(k)) continue;
      out[k] = heldRow(v, blk) ? null : scrubHeld(v, blk);
    }
    return out;
  }
  return value;
}
// Read a JSON file that feeds an editorial surface, already scrubbed.
// Returns null when the file is missing or unreadable, like the callers' J().
export async function loadEditorialJson(rel, blk = null) {
  const doc = await J(rel);
  if (doc == null) return null;
  return scrubHeld(doc, blk || await loadBlocked());
}
