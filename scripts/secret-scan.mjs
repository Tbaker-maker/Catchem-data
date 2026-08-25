// secret-scan.mjs — no value from .env may appear in a tracked file.
//
// WHY THIS EXISTS AND security-agent.mjs WAS NOT ENOUGH. That agent looks for
// credential SHAPES: an sk-ant- prefix, an AKIA key, a Discord webhook. It ran
// daily through generate-pulse and reported clean for months while a Formspree
// form endpoint sat in ten tracked files, because a form id has no distinctive
// shape - it is eight lowercase letters. Nothing that scans for patterns can
// catch a secret that looks like a word.
//
// So this scans for the ACTUAL VALUES we hold. .env is the list of things that
// must not be public; this checks that none of them is. It cannot be fooled by
// a value that looks ordinary, because it is not guessing what a secret looks
// like - it is reading the ones we have.
//
// IT SCANS EVERY TRACKED FILE, not a diff. A leak introduced before this guard
// existed is exactly the case it is here for, and a changed-files check would
// have walked straight past all ten.
//
// BLOCKING. A published credential cannot be unpublished; there is no
// correction page for it. The cost of a false positive is a minute of a
// person's time, and the cost of a miss is permanent.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./lib/load-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv();

// Values too short or too common to search for without drowning in noise. A
// four-character value is not protected by this guard and should not be a
// secret in the first place.
const MIN_LEN = 6;

// Some values are legitimately published: a public username is not a secret.
// Named explicitly rather than pattern-matched, so adding one is a decision
// somebody makes on purpose.
// ANTHROPIC_BASE_URL is https://api.anthropic.com - the public API host, which
// is in five files precisely because it is meant to be. Named here rather than
// excluded by a pattern, so that adding one is a decision somebody makes on
// purpose and can be argued with later.
const PUBLISHABLE = new Set(["X_ACCOUNT", "PUBLIC_SITE", "SITE_URL", "ANTHROPIC_BASE_URL"]);

const env = {};
for (const [k, v] of Object.entries(process.env)) {
  if (!/^(X_|EBAY_|FORMSPREE_|DISCORD_|CLOUDFLARE_|ANTHROPIC_|PPT_|BUTTONDOWN_)/.test(k)) continue;
  if (PUBLISHABLE.has(k)) continue;
  const s = String(v || "").trim();
  if (s.length >= MIN_LEN) env[k] = s;
}

if (!Object.keys(env).length) {
  console.log("✓ secret scan: no .env values long enough to check (nothing to protect)");
  process.exit(0);
}

// Every file git actually tracks. Untracked scratch cannot leak; tracked files
// are the published surface.
let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf-8" })
    .split(/\r?\n/).filter(Boolean);
} catch (e) {
  console.error("✗ secret scan: could not list tracked files — " + e.message);
  process.exit(1);
}

const SKIP_BIN = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|pdf|zip)$/i;

// ── A CLIENT-SIDE FORM ENDPOINT CANNOT BE KEPT SECRET ─────────────────────
// This is the part that took a wrong turn first. A Formspree action lives in
// the HTML a browser downloads, so the moment the form works, the endpoint is
// readable by anyone who views source. Moving it to .env stops it entering
// SOURCE and stops future commits carrying it; it does not and cannot make the
// deployed page private.
//
// So the guard draws the line where the line actually is. A value in a SOURCE
// file is a leak and blocks. A value in a generated ARTIFACT is published by
// design, and is reported every run so nobody mistakes it for private. The
// mitigation there is not secrecy - it is Formspree's own domain restriction
// and spam filtering.
//
// Treating the artifact as a leak would mean untracking research/assets/
// build.html, which is the editor people are meant to open from this repo. That
// trade is not worth making for a value a browser hands out anyway.
const GENERATED = [
  "research/assets/build.html",
  "research/assets/index-landing.html",
  "research/assets/corrections.html",
  "research/pulse/",
];
const isGenerated = (rel) => GENERATED.some(g => rel.startsWith(g));
const hits = [];
for (const rel of tracked) {
  if (SKIP_BIN.test(rel)) continue;
  // The scanner must not flag the scanner. It names no secret value itself -
  // it reads them from .env - so only its own path is excluded, and only from
  // the redaction-marker check below.
  const src = await readFile(join(ROOT, rel), "utf-8").catch(() => null);
  if (src === null) continue;
  for (const [name, value] of Object.entries(env)) {
    if (!src.includes(value)) continue;
    const line = src.split(/\r?\n/).findIndex(l => l.includes(value)) + 1;
    hits.push({ rel, name, line, generated: isGenerated(rel) });
  }
}

// Reported every run, pass or fail, because a limit nobody is told about is
// the failure this whole file exists because of.
const published = hits.filter(h => h.generated);
if (published.length) {
  console.log(`\n  PUBLISHED BY DESIGN — ${published.length} generated artifact(s) carry an .env value:`);
  for (const h of published) console.log(`     ${h.rel}:${h.line}  (${h.name})`);
  console.log("  A client-side form endpoint is in the HTML a browser downloads. It is");
  console.log("  public the moment the form works, and .env cannot change that. Restrict");
  console.log("  the form to your domain in Formspree; do not rely on it being unknown.\n");
}

const leaks = hits.filter(h => !h.generated);
if (leaks.length) {
  const hitsAll = hits; const byName = {};
  for (const h of leaks) (byName[h.name] ??= []).push(h);
  console.error(`\n✗ SECRET SCAN — a value from .env appears in ${leaks.length} tracked SOURCE file(s):\n`);
  for (const [name, list] of Object.entries(byName)) {
    console.error(`   ${name} — ${list.length} file(s)`);
    for (const h of list.slice(0, 12)) console.error(`      ${h.rel}:${h.line}`);
    if (list.length > 12) console.error(`      … ${list.length - 12} more`);
    console.error("");
  }
  console.error("  A value in a tracked file is published the moment it is pushed, and");
  console.error("  cannot be unpublished. Read it from .env at build time instead, and");
  console.error("  redact it in historical records rather than rewriting history.\n");
  process.exit(1);
}

console.log(`✓ secret scan: ${Object.keys(env).length} .env value(s) checked against ${tracked.length} tracked files · no source leaks`);
