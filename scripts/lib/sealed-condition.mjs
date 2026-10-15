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
  for (const path of await publishedFiles(root)) {
    let text;
    try { text = await readFile(path, "utf8"); } catch { continue; }
    if (!SEALED_NM.test(text) && !text.includes("→")) continue;
    let doc;
    try { doc = JSON.parse(text); } catch { continue; }
    const n = scrubTree(doc);
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
