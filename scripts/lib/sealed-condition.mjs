// NM (Near Mint) is a single-card condition. Sealed items (packs, ETBs, tins,
// boxes, bundles, collections) never carry it. This scrub runs on every
// published row whose kind is "sealed" and also turns "$A → $B" into
// "from $A to $B" and drops a parenthetical that repeats the name.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MONEY = "\\$[\\d,]+(?:\\.\\d{1,2})?";
export const SEALED_NM = /\bNM\b|Near Mint/i;

export function isSealedRow(row) {
  return Boolean(row && typeof row === "object" && (row.kind === "sealed" || row.readKind === "sealed" || row.itemKind === "sealed"));
}

export function plainSealedText(text, name = "") {
  let s = String(text ?? "");
  if (!s) return s;
  s = s.replace(/\s*\((?:NM|Near Mint)(?: for singles)?\)/gi, "");
  s = s.replace(new RegExp(`(${MONEY})\\s+NM\\b`, "g"), "$1");
  s = s.replace(/\b(?:in|at)\s+Near Mint\b/gi, "");
  s = s.replace(/,?\s*Near Mint\b,?/gi, (m) => (m.startsWith(",") && m.endsWith(",") ? "," : ""));
  s = s.replace(/\bNM\s+(?=\$)/g, "");
  s = s.replace(/\bNM\b\s*/g, "");
  s = s.replace(new RegExp(`:\\s*(${MONEY})\\s*(?:→|->)\\s*(${MONEY})`, "g"), ", from $1 to $2");
  s = s.replace(new RegExp(`(${MONEY})\\s*(?:→|->)\\s*(${MONEY})`, "g"), "from $1 to $2");
  s = dropRepeat(s, name);
  return s.replace(/ {2,}/g, " ").replace(/ ([.,])/g, "$1");
}

// "Delta Reign Elite Trainer Box (Delta Reign)" and
// "First Partner Pack (Alola) (First Partner Pack)" say the same words twice.
export function dropRepeat(text, name = "") {
  const n = String(name || "").trim();
  if (!n) return text;
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(text).replace(new RegExp(`(${esc(n)})\\s*\\(([^()]+)\\)`, "g"), (m, nm, inner) => (
    nm.toLowerCase().includes(inner.trim().toLowerCase()) ? nm : m
  ));
}

const SKIP = new Set(["id", "sku", "slug", "setSlug", "image", "img", "url", "href", "sourceLine", "call_id"]);

export function scrubSealedRow(row) {
  let changed = false;
  const name = String(row.name || "");
  for (const [k, v] of Object.entries(row)) {
    if (SKIP.has(k)) continue;
    if (typeof v === "string") {
      const next = plainSealedText(v, k === "name" ? "" : name);
      if (next !== v) { row[k] = next; changed = true; }
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      const next = v.map((x) => plainSealedText(x, name));
      if (next.some((x, i) => x !== v[i])) { row[k] = next; changed = true; }
    } else if (v && typeof v === "object") {
      if (scrubTree(v, true)) changed = true;
    }
  }
  return changed;
}

// Walk any doc. Returns the number of sealed rows changed.
export function scrubTree(node, inSealed = false) {
  let n = 0;
  if (Array.isArray(node)) { for (const x of node) n += scrubTree(x, inSealed); return n; }
  if (!node || typeof node !== "object") return 0;
  if (isSealedRow(node) || (inSealed && !node.kind)) return scrubSealedRow(node) ? 1 : 0;
  for (const v of Object.values(node)) n += scrubTree(v, false);
  return n;
}

export function sealedLeaks(node, out = [], where = "") {
  if (Array.isArray(node)) { node.forEach((x) => sealedLeaks(x, out, where)); return out; }
  if (!node || typeof node !== "object") return out;
  if (isSealedRow(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (SKIP.has(k)) continue;
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (k !== "condition" && k !== "label" && SEALED_NM.test(s || "")) out.push(`${where} ${node.id || node.name}: ${k}`);
    }
    return out;
  }
  for (const v of Object.values(node)) sealedLeaks(v, out, where);
  return out;
}

// Mixed rows (sealed vs its top card, rip value, release, year range) are not
// kind "sealed", so the row scrub misses them. This pass looks at the words
// that lead into each "$A NM" and drops NM when they name a sealed product.
const SEALED_WORD = /\b(?:Booster Box(?:es)?|Booster Bundles?|Elite Trainer Box(?:es)?|ETBs?|Booster Packs?|Sleeved Boosters?|Blisters?|Tins?|Collections?|Cases?|Bundles?|Build & Battle|Display|Boxes|Box|Packs?|Deck Set|Booster Display)\b/gi;
const CARD_WORD = /\btop card\b|\bcards?\b|\bsingles?\b|\b\d{1,3}\/\d{2,3}\b|\b[A-Z]{2,5}\d{2,3}\b/gi;
const NM_PRICE = new RegExp(`(${MONEY})\\s+NM\\b`, "g");
const plain = (s) => s.replace(/\([^()]*\)|\[[^\]]*\]/g, " ");
const lastAt = (re, s) => { let at = -1; for (const m of s.matchAll(re)) at = m.index; return at; };

// subject: the row itself is a sealed product (its sku or name says so). Then a
// price with no card or sealed word in its sentence is the product's own price.
function sealedLead(prefix, lastEnd, subject = false) {
  const lead = plain(prefix.slice(lastEnd));
  const tail = lead.split(/[:.;]\s|:$/).pop();
  if (/rip value\s*$/i.test(tail)) return false;
  const card = lastAt(CARD_WORD, tail), seal = lastAt(SEALED_WORD, tail);
  if (card >= 0 || seal >= 0) return seal > card;
  const sentence = plain(prefix).split(/[.;]\s/).pop();
  const sc = lastAt(CARD_WORD, sentence), ss = lastAt(SEALED_WORD, sentence);
  if (sc >= 0 || ss >= 0) return ss > sc;
  if (subject) return true;
  const all = plain(prefix);
  return lastAt(SEALED_WORD, all) > lastAt(CARD_WORD, all);
}

export function sealedNmHits(text, subject = false) {
  const s = String(text ?? ""), hits = [];
  let lastEnd = 0;
  for (const m of s.matchAll(NM_PRICE)) {
    if (sealedLead(s.slice(0, m.index), lastEnd, subject)) hits.push(m.index);
    lastEnd = m.index + m[0].length;
  }
  return hits;
}

export function dropSealedNm(text, subject = false) {
  const s = String(text ?? "");
  const hits = new Set(sealedNmHits(s, subject));
  if (!hits.size) return s;
  return s.replace(NM_PRICE, (m, amt, at) => (hits.has(at) ? amt : m));
}

// A row is about a sealed product when its sku is one (data/sealed-products.json,
// or a catalogue id passed in) or its name names one ("3 Pack Blister", "Booster Box").
const SEALED_NAME = new RegExp(SEALED_WORD.source, "i");
export function sealedSubject(row, sealedIds = new Set()) {
  if (!row || typeof row !== "object") return false;
  if (row.sku && sealedIds.has(String(row.sku))) return true;
  const name = String(row.name || "");
  return Boolean(name) && SEALED_NAME.test(plain(name)) && !/\bsingles?\b|\bcards?\b/i.test(name);
}

const fmtUsd = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// prices[] on a sealed row: drop the condition from any amount the row's text
// prints without NM (the product's own price). Card prices keep theirs.
function scrubPrices(row) {
  if (!Array.isArray(row.prices)) return 0;
  const text = JSON.stringify([row.headline, row.path, row.lines, row.lineCards]);
  let n = 0;
  for (const p of row.prices) {
    if (!p || typeof p !== "object" || !(p.condition || /near mint/i.test(p.label || ""))) continue;
    const a = fmtUsd(p.amount);
    const bare = new RegExp(`${a.replace(/[$.]/g, "\\$&")}(?!\\d)(?!\\s+NM\\b)`);
    const withNm = new RegExp(`${a.replace(/[$.]/g, "\\$&")}\\s+NM\\b`);
    if (bare.test(text) && !withNm.test(text)) { delete p.condition; delete p.label; n += 1; }
  }
  return n;
}

export function scrubMixed(node, sealedIds = new Set(), subject = false) {
  let n = 0;
  if (Array.isArray(node)) { node.forEach((x, i) => { if (typeof x === "string") { const y = dropSealedNm(x, subject); if (y !== x) { node[i] = y; n += 1; } } else n += scrubMixed(x, sealedIds, subject); }); return n; }
  if (!node || typeof node !== "object") return 0;
  const here = subject || sealedSubject(node, sealedIds);
  for (const [k, v] of Object.entries(node)) {
    if (SKIP.has(k) || k === "prices") continue;
    if (typeof v === "string") { const y = dropSealedNm(v, here); if (y !== v) { node[k] = y; n += 1; } }
    else n += scrubMixed(v, sealedIds, here && !(v && typeof v === "object" && !Array.isArray(v) && (v.sku || v.name)));
  }
  if (here && node.prices) n += scrubPrices(node);
  return n;
}

export function mixedLeaks(node, out = [], where = "", sealedIds = new Set(), subject = false) {
  if (typeof node === "string") { if (sealedNmHits(node, subject).length) out.push(`${where}: ${node.slice(0, 120)}`); return out; }
  if (Array.isArray(node)) { node.forEach((x) => mixedLeaks(x, out, where, sealedIds, subject)); return out; }
  if (node && typeof node === "object") {
    const here = subject || sealedSubject(node, sealedIds);
    for (const [k, v] of Object.entries(node)) if (!SKIP.has(k) && k !== "prices") mixedLeaks(v, out, where, sealedIds, here && !(v && typeof v === "object" && !Array.isArray(v) && (v.sku || v.name)));
  }
  return out;
}

export async function sealedIdsFor(root) {
  try {
    const list = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8"));
    const ids = new Set();
    for (const p of list) { if (p.id) ids.add(String(p.id)); if (p.tcgPlayerId) ids.add(`tcgcsv-${p.tcgPlayerId}`); }
    return ids;
  } catch { return new Set(); }
}

async function jsonFiles(dir) {
  const out = [];
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await jsonFiles(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

export function publishedFiles(root) {
  const base = join(root, "research/assets/public");
  return Promise.all([jsonFiles(join(base, "feed")), Promise.resolve([join(base, "reads.json"), join(base, "today.json")])]).then((a) => a.flat());
}

export async function scrubPublished(root) {
  let files = 0, rows = 0;
  const ids = await sealedIdsFor(root);
  for (const path of await publishedFiles(root)) {
    let text;
    try { text = await readFile(path, "utf8"); } catch { continue; }
    if (!SEALED_NM.test(text) && !text.includes("→")) continue;
    let doc;
    try { doc = JSON.parse(text); } catch { continue; }
    const n = scrubTree(doc) + scrubMixed(doc, ids);
    if (!n) continue;
    const pretty = /^\{\n /.test(text);
    await writeFile(path, (pretty ? JSON.stringify(doc, null, 1) : JSON.stringify(doc)) + (text.endsWith("\n") ? "\n" : ""));
    files += 1; rows += n;
  }
  return { files, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ sealedScrub: await scrubPublished(process.argv[2] || process.cwd()) }));
}
