import { spaceFamilies } from "./reads-guard.mjs";
// Cards whose headline price is held, or flagged unverified, stay out of reads.
import { readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const ID_RE = /tcgcsv-\d+/g;

export function cardIdOf(value) {
  const text = String(value || "");
  if (/^tcgcsv-\d+$/.test(text)) return text;
  if (/^\d+$/.test(text)) return `tcgcsv-${text}`;
  const hit = text.match(/tcgcsv-\d+/);
  return hit ? hit[0] : "";
}

export async function loadHeldIds(root) {
  const held = new Set();
  const add = (value) => {
    const id = cardIdOf(value);
    if (id) held.add(id);
  };
  try {
    const doc = JSON.parse(await readFile(join(root, "research/assets/public/price-hold.json"), "utf8"));
    for (const id of Object.keys(doc?.ids || {})) add(id);
  } catch { /* no hold file in a fixture */ }
  try {
    const dir = join(root, "research/assets/public/feed/rating");
    for (const name of await readdir(dir)) {
      if (!name.endsWith(".json")) continue;
      const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
      for (const row of doc?.rows || []) if (row?.check) add(row.id);
    }
  } catch { /* rating flags are optional */ }
  return held;
}

export function mentionsHeld(value, held) {
  if (!held || !held.size || value == null) return false;
  const blob = typeof value === "string" ? value : JSON.stringify(value);
  for (const id of blob.match(ID_RE) || []) if (held.has(id)) return true;
  return false;
}

export function dropHeldReads(reads, held) {
  return (reads || []).filter((row) => row && !mentionsHeld(row, held));
}

// Dropping rows can leave two of the same family touching. The board rule is
// that neighbors differ. Keep the original order as far as that rule allows.
export function unstickFamilies(reads) {
  return spaceFamilies(reads);
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

function pretty(doc) {
  return JSON.stringify(doc, null, 1) + "\n";
}

export async function scrubHeldOutputs(root) {
  const held = await loadHeldIds(root);
  const dropped = [];
  const readsPath = join(root, "research/assets/public/reads.json");
  const readsDoc = await readJson(readsPath);
  if (readsDoc && Array.isArray(readsDoc.reads)) {
    const next = unstickFamilies(dropHeldReads(readsDoc.reads, held));
    for (const row of readsDoc.reads) if (row?.id && !next.includes(row)) dropped.push(row.id);
    // Always respaced: earlier steps can leave two of a family side by side too.
    if (next.length !== readsDoc.reads.length || next.some((row, i) => row !== readsDoc.reads[i])) {
      readsDoc.reads = next;
      readsDoc.count = next.length;
      if (Array.isArray(readsDoc.priceStaleIds)) readsDoc.priceStaleIds = readsDoc.priceStaleIds.filter((id) => !held.has(cardIdOf(id)));
      await writeFile(readsPath, pretty(readsDoc));
    }
  }

  const extraPath = join(root, "research/assets/public/feed/extra-reads.json");
  const extra = await readJson(extraPath);
  if (extra && Array.isArray(extra.reads)) {
    const next = dropHeldReads(extra.reads, held);
    if (next.length !== extra.reads.length) {
      extra.reads = next;
      await writeFile(extraPath, pretty(extra));
    }
  }

  const libPath = join(root, "research/assets/public/feed/read-library.json");
  const lib = await readJson(libPath);
  if (lib) {
    let changed = false;
    if (Array.isArray(lib.board)) {
      const next = dropHeldReads(lib.board, held);
      if (next.length !== lib.board.length) { lib.board = next; changed = true; }
    }
    if (Array.isArray(lib.signals)) {
      const next = dropHeldReads(lib.signals, held);
      if (next.length !== lib.signals.length) { lib.signals = next; changed = true; }
    }
    if (changed) await writeFile(libPath, JSON.stringify(lib));
  }

  const chipPath = join(root, "research/assets/public/signal-chips.json");
  const chips = await readJson(chipPath);
  if (chips && chips.byId && typeof chips.byId === "object") {
    let changed = false;
    for (const id of Object.keys(chips.byId)) {
      if (mentionsHeld(id, held) || mentionsHeld(chips.byId[id], held)) {
        delete chips.byId[id];
        changed = true;
      }
    }
    if (changed) {
      chips.count = Object.keys(chips.byId).length;
      chips.samples = (chips.samples || []).filter((row) => row && chips.byId[row.id]);
      if (!chips.preview || !chips.byId[chips.preview.id]) chips.preview = chips.samples[0] || null;
      await writeFile(chipPath, pretty(chips));
    }
  }

  const itemDir = join(root, "research/assets/public/feed/item-reads");
  try {
    for (const name of await readdir(itemDir)) {
      if (!name.endsWith(".json")) continue;
      const path = join(itemDir, name);
      const doc = await readJson(path);
      if (!doc || !doc.items) continue;
      let changed = false;
      for (const id of Object.keys(doc.items)) {
        const rows = Array.isArray(doc.items[id]) ? doc.items[id] : [];
        const next = dropHeldReads(rows, held);
        if (next.length !== rows.length) {
          changed = true;
          if (next.length) doc.items[id] = next;
          else delete doc.items[id];
        }
      }
      if (changed) await writeFile(path, JSON.stringify(doc));
    }
  } catch { /* no item-read shards */ }

  const factDir = join(root, "research/assets/public/feed/facts");
  const droppedIds = new Set(dropped);
  try {
    for (const name of await readdir(factDir)) {
      if (!name.endsWith(".json")) continue;
      const path = join(factDir, name);
      const doc = await readJson(path);
      const subject = cardIdOf(doc?.item?.id || doc?.id || name);
      const readId = String(doc?.id || name.replace(/\.json$/, ""));
      if (held.has(subject) || droppedIds.has(readId) || mentionsHeld(readId, held)) {
        await unlink(path);
      }
    }
  } catch { /* facts are optional */ }

  const moversPath = join(root, "research/assets/public/movers.json");
  const movers = await readJson(moversPath);
  if (movers) {
    let changed = false;
    for (const key of Object.keys(movers)) {
      if (!Array.isArray(movers[key])) continue;
      const next = movers[key].filter((row) => row && !held.has(cardIdOf(String(row.id || "").replace(/^(heating|cooling|mover)-/, ""))));
      if (next.length !== movers[key].length) { movers[key] = next; changed = true; }
    }
    if (changed) await writeFile(moversPath, pretty(movers));
  }
  return { held: held.size, dropped: dropped.length };
}

// Chips are stamped after the feed scrub, so they get the same hold check here.
// A chip whose id or row names a held card is removed, with any bySku pointer and sample.
export function dropHeldChips(doc, held) {
  if (!doc || !doc.byId || !held || !held.size) return { doc, dropped: 0 };
  const gone = new Set(Object.keys(doc.byId).filter((id) => mentionsHeld(id, held) || mentionsHeld(doc.byId[id], held)));
  if (!gone.size) return { doc, dropped: 0 };
  const byId = Object.fromEntries(Object.entries(doc.byId).filter(([id]) => !gone.has(id)));
  const bySku = Object.fromEntries(Object.entries(doc.bySku || {}).filter(([sku, id]) => !gone.has(id) && !mentionsHeld(sku, held)));
  const samples = (doc.samples || []).filter((row) => !mentionsHeld(row, held));
  const preview = doc.preview && !mentionsHeld(doc.preview, held) ? doc.preview : (samples[0] || null);
  return { doc: { ...doc, byId, bySku, preview, samples }, dropped: gone.size };
}
