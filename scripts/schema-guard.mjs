// schema-guard.mjs — a silent format change is the most expensive kind.
//
// sealed-prices.json is read by 21 scripts. divergence-report by 9. Not one of
// them checks its shape, so a key that quietly changes name propagates through
// every instrument before anything complains — and the failure surfaces as a
// wrong number, not an error. The Breaker flagged this class and it was right.
//
// Schemas are MINIMUMS derived from known-good files: required top-level keys,
// their types, minimum array lengths, and the fields a row must carry. Extra
// keys are always fine — this catches loss and drift, not growth.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let schemas;
try { schemas = JSON.parse(await readFile(join(ROOT, "data/schemas.json"), "utf-8")); }
catch { console.log("· schema guard: no schemas.json"); process.exit(0); }

const problems = [];
for (const [path, spec] of Object.entries(schemas.files || {})) {
  let d;
  try { d = JSON.parse(await readFile(join(ROOT, path), "utf-8")); }
  catch (e) {
    // A schema may be declared BEFORE the file exists, so a new data file is
    // validated from its first run rather than after it has gone wrong once.
    if (spec.optional) continue;
    problems.push(`${path}: unreadable or not valid JSON (${e.message}) — ${spec.readers} scripts depend on it`); continue;
  }

  const isArr = Array.isArray(d);
  if ((spec.root === "array") !== isArr) { problems.push(`${path}: root is ${isArr ? "array" : "object"}, expected ${spec.root}`); continue; }

  for (const [key, want] of Object.entries(spec.requires || {})) {
    const v = isArr ? d : d[key];
    if (v === undefined || v === null) { problems.push(`${path}: missing key "${key}" — read by ${spec.readers} scripts`); continue; }
    if (want.type === "array") {
      if (!Array.isArray(v)) { problems.push(`${path}.${key}: expected an array, got ${typeof v}`); continue; }
      // Losing most of a dataset is the failure that looks like success.
      if (want.minLength && v.length < want.minLength)
        problems.push(`${path}.${key}: ${v.length} rows, expected at least ${want.minLength} — this is the shape of a run that silently lost most of its data`);
      if (want.rowRequires && v.length) {
        const missing = want.rowRequires.filter(f => !(f in (v[0] || {})));
        if (missing.length) problems.push(`${path}.${key}: rows are missing ${missing.join(", ")}`);
      }
    } else if (want.type === "object") {
      if (typeof v !== "object" || Array.isArray(v)) problems.push(`${path}.${key}: expected an object`);
      else {
        const missing = (want.keys || []).filter(k => !(k in v));
        if (missing.length > (want.keys || []).length / 2)
          problems.push(`${path}.${key}: lost most of its keys (missing ${missing.slice(0, 5).join(", ")}…)`);
      }
    }
  }
}


// ── PLAUSIBILITY: shape and possibility are two different guards ────────────
// Everything above passes on a file whose every key is present and whose every
// value is impossible. That is what a broken upstream, a bad merge or a unit
// error actually produces — it does not corrupt the structure, it corrupts the
// numbers. The feed-level version of this caught a poisoned feed that shape
// checking called "healthy" (2026-08-22); the same idea belongs on every file.
//
// Driven by field NAME, not per-file config: 21 hand-written specs rot, and the
// next new file would arrive unprotected. The cost is that exemptions have to
// be deliberate — FUTURE_OK is one, because a release date SHOULD be ahead of
// today (Delta Reign is a real set in November).
const FUTURE_OK = /^(release|eol|debut|expires|clears)/i;
const isPct = (k) => /(pct|percent)$/i.test(k);
const isDateField = (k) => /(date|at|since|reviewed|lastseen)$/i.test(k) && !FUTURE_OK.test(k);
const isCount = (k) => /(count|listings|cards|constituents|peers|qty|quantity)$/i.test(k);
const isPrice = (k) => /(price|median|market|floor|high|low|value|ceiling|perpack)$/i.test(k) && !isPct(k);
const SKEW_MS = 48 * 3600 * 1000;
const impossible = [];
function scan(node, path, file, depth) {
  if (node == null || depth > 6 || impossible.length > 40) return;
  if (Array.isArray(node)) { node.slice(0, 400).forEach((v, i) => scan(v, path + "[" + i + "]", file, depth + 1)); return; }
  if (typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    const at = path + "." + k;
    if (typeof v === "number" && Number.isFinite(v)) {
      if (isPrice(k) && v < 0) impossible.push(file + at + " = " + v + " — a price cannot be negative");
      else if (isPrice(k) && v > 1e6) impossible.push(file + at + " = " + v + " — nothing we track is worth this");
      if (isCount(k) && v < 0) impossible.push(file + at + " = " + v + " — a count cannot be negative");
      if (isPct(k) && Math.abs(v) > 1000) impossible.push(file + at + " = " + v + "% — beyond any real move");
      if (k === "level" && (v <= 0 || v > 10000)) impossible.push(file + at + " = " + v + " — an index chain-linked from 100 cannot sit here");
    }
    // Context matters as much as the field name: release-radar's upcoming[].date
    // is called "date" and is SUPPOSED to be ahead of today. Exempting by name
    // alone flagged nine real, correct rows on the first run.
    const forwardLooking = FUTURE_OK.test(k) || /(upcoming|radar|release|schedule|calendar|window|print)/i.test(file + path);
    if (typeof v === "string" && isDateField(k) && !forwardLooking && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const ts = Date.parse(v);
      if (Number.isFinite(ts) && ts - Date.now() > SKEW_MS) impossible.push(file + at + " = " + v + " — recorded in the future");
    }
    if (v && typeof v === "object") scan(v, at, file, depth + 1);
  }
  const lo = node.floor ?? node.priceFloorClean, hi = node.high ?? node.priceHigh, mid = node.median ?? node.priceMedian;
  if (typeof lo === "number" && typeof hi === "number" && lo > hi) impossible.push(file + path + ": floor " + lo + " above high " + hi);
  if (typeof mid === "number" && typeof lo === "number" && mid < lo) impossible.push(file + path + ": median " + mid + " below floor " + lo);
  if (typeof mid === "number" && typeof hi === "number" && mid > hi) impossible.push(file + path + ": median " + mid + " above high " + hi);
}
for (const [p2, sp2] of Object.entries(schemas.files || {})) {
  try { scan(JSON.parse(await readFile(join(ROOT, p2), "utf-8")), "", p2, 0); } catch {}
}
for (const i of impossible) problems.push(i);

if (problems.length) {
  console.error(`\n✗ SCHEMA GUARD — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ schema guard: ${Object.keys(schemas.files || {}).length} data files match their shape`);
