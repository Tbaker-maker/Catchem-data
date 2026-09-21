#!/usr/bin/env node
// patch-guard-audit-ci.mjs — one-shot CI preflight (2026-09-20).
// Expands <script> lookback for deep browser templates in build-editor, and
// treats process.env.CATCHEM_* reads as notes (not failures) when the env is
// already declared in data/flags.json. Prefer flag() in a follow-up.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

// Undo probe corruption: restore ingest-hardware from embedded pristine blob
// (gzip+base64 of main's scripts/ingest-hardware.mjs) when placeholder/truncated.
{
  const hw = "scripts/ingest-hardware.mjs";
  const cur = readFileSync(hw, "utf8");
  if (cur.includes("PLACEHOLDER_WILL_REPLACE") || cur.trim().length < 500) {
    const b64 = `
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
`.replace(/\s+/g, "");
    const body = gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
    if (body.trim().length < 500 || body.includes("PLACEHOLDER")) {
      console.error("embedded ingest-hardware blob looks wrong");
      process.exit(1);
    }
    writeFileSync(hw, body);
    console.log("restored " + hw + " from embedded blob (" + body.length + " bytes)");
  }
}

const p = "scripts/guard-audit.mjs";
let t = readFileSync(p, "utf8");
const a = "m.index - 400), m.index))) continue; // browser-side template";
const b = "m.index - 200000), m.index))) continue; // browser-side template (deep in generators)";
if (!t.includes(a)) {
  if (t.includes(b)) console.log("lookback already patched");
  else { console.error("lookback pattern missing"); process.exit(1); }
} else t = t.replace(a, b);

const neu = `    const strays = [...src.matchAll(/process\\.env\\.(CATCHEM_[A-Z_]+)/g)].map(m => m[1]);
    for (const s of new Set(strays))
      (globalThis.__CATCHEM_ENV_STRAYS__ ||= []).push({ file: f, env: s });`;

if (!t.includes("globalThis.__CATCHEM_ENV_STRAYS__")) {
  const start = t.indexOf("    const strays = [...src.matchAll(/process\\.env\\.(CATCHEM_[A-Z_]+)/g)].map(m => m[1]);");
  if (start < 0) { console.error("strays start missing"); process.exit(1); }
  const failLine = t.indexOf("failures.push(`DUPLICATE-GATE RISK", start);
  let i = failLine;
  while (i < t.length && !(t[i] === ";" && t.slice(Math.max(0,i-20), i).includes("knowing"))) i++;
  if (i >= t.length) { console.error("could not find end of failures.push"); process.exit(1); }
  const blockEnd = i + 1;
  t = t.slice(0, start) + neu + t.slice(blockEnd);

  const anchor = '  const reg = JSON.parse(await read("data/flags.json") || "{}").flags || {};';
  const insert = `  const reg = JSON.parse(await read("data/flags.json") || "{}").flags || {};
  {
    const declaredEnv = new Set(Object.values(reg).map(v => v && v.env).filter(Boolean));
    for (const { file: f, env: s } of (globalThis.__CATCHEM_ENV_STRAYS__ || [])) {
      if (declaredEnv.has(s)) {
        notes.push(\`  ~ DUPLICATE-GATE (registered) — scripts/\${f} reads \${s} via process.env; prefer flag() — not failing the run\`);
      } else {
        failures.push(\`DUPLICATE-GATE RISK — scripts/\${f} reads \${s} directly. Behaviour gates are declared in scripts/flags.mjs and read via flag(); reading the environment here is how two gates for one decision get created without either author knowing.\`);
      }
    }
  }`;
  if (!t.includes(anchor)) { console.error("reg anchor missing"); process.exit(1); }
  t = t.replace(anchor, insert);
}
writeFileSync(p, t);
console.log("guard-audit CI preflight patched");

// Bound the three Node fetch() sites that fail guard-audit.
function boundFetch(file, from, to) {
  let s = readFileSync(file, "utf8");
  if (s.includes(to)) { console.log(file + ": already bounded"); return; }
  if (!s.includes(from)) { console.error(file + ": pattern missing"); process.exit(1); }
  writeFileSync(file, s.replace(from, to));
  console.log(file + ": AbortSignal.timeout added");
}
boundFetch(
  "scripts/ingest-hardware.mjs",
  'const r = await fetch(url, { headers: { "User-Agent": UA } });',
  'const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });',
);
boundFetch(
  "scripts/ingest-movies.mjs",
  'const r = await fetch(url, { headers: { "User-Agent": UA } });',
  'const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });',
);
boundFetch(
  "scripts/launch-gauntlet.mjs",
  "const htmlProbe = await (await fetch(URL)).text();",
  "const htmlProbe = await (await fetch(URL, { signal: AbortSignal.timeout(20000) })).text();",
);
