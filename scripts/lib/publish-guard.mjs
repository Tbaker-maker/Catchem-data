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
  const names = new Set();
  for (const p of sp.products || []) if (ids.has(p.id) && p.name) names.add(p.name);
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
    const e = (mq.entries || []).find(x => x.id === id);
    return e ? `manually quarantined ${e.since} (${e.by}): ${e.reason}` : null;
  };
  return { ids, names, blocked, mentions, reasonFor };
}
