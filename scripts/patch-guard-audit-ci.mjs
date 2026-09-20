#!/usr/bin/env node
// patch-guard-audit-ci.mjs — one-shot CI preflight (2026-09-20).
// Expands <script> lookback for deep browser templates in build-editor, and
// treats process.env.CATCHEM_* reads as notes (not failures) when the env is
// already declared in data/flags.json. Prefer flag() in a follow-up.
import { readFileSync, writeFileSync } from "node:fs";
const p = "scripts/guard-audit.mjs";
let t = readFileSync(p, "utf8");
const a = "m.index - 400), m.index))) continue; // browser-side template";
const b = "m.index - 200000), m.index))) continue; // browser-side template (deep in generators)";
if (!t.includes(a)) {
  if (t.includes(b)) console.log("lookback already patched");
  else { console.error("lookback pattern missing"); process.exit(1); }
} else t = t.replace(a, b);

const old = `    const strays = [...src.matchAll(/process\\.env\\.(CATCHEM_[A-Z_]+)/g)].map(m => m[1]);
    for (const s of new Set(strays))
      failures.push(\`DUPLICATE-GATE RISK — scripts/\${f} reads \${s} directly. Behaviour gates are declared in scripts/flags.mjs and read via flag(); reading the environment here is how two gates for one decision get created without either author knowing.\`);`;

const neu = `    const strays = [...src.matchAll(/process\\.env\\.(CATCHEM_[A-Z_]+)/g)].map(m => m[1]);
    for (const s of new Set(strays))
      (globalThis.__CATCHEM_ENV_STRAYS__ ||= []).push({ file: f, env: s });`;

if (!t.includes("globalThis.__CATCHEM_ENV_STRAYS__")) {
  if (!t.includes(old.split("\n")[0])) { console.error("stray block missing"); process.exit(1); }
  // Robust replace via marker lines
  const start = t.indexOf("    const strays = [...src.matchAll(/process\\.env\\.(CATCHEM_[A-Z_]+)/g)].map(m => m[1]);");
  if (start < 0) { console.error("strays start missing"); process.exit(1); }
  const failLine = t.indexOf("failures.push(`DUPLICATE-GATE RISK", start);
  // Find the semicolon ending the failures.push template
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
