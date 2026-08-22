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

if (problems.length) {
  console.error(`\n✗ SCHEMA GUARD — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ schema guard: ${Object.keys(schemas.files || {}).length} data files match their shape`);
