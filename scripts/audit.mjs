// audit.mjs — THE REPEATABLE AUDIT.
// Audits were ad-hoc and depended on someone thinking to run one. This is
// the fixed checklist, including LIVE FAILURE SIMULATIONS — we break the
// system on purpose and confirm it refuses to publish. Reading code proves
// nothing; three of our four worst bugs passed a code read.
//
// Run: node scripts/audit.mjs   (safe — restores every file it touches)
// Writes: research/audits/<date>-audit.md
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os"; // /tmp is Linux-only; audits must run on the Windows desk too (2026-08-22)
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const sh = async (script) => { try { const { stdout } = await run("node", [join(ROOT, "scripts", script)], { cwd: ROOT }); return { ok: true, out: stdout.trim() }; }
  catch (e) { return { ok: false, out: ((e.stdout || "") + (e.stderr || "")).trim() }; } };

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };

console.log("\n═══ 1. WIRING ═══");
const ga = await sh("guard-audit.mjs");
check("every safeguard connected", ga.ok, ga.out.split("\n")[0]);

console.log("\n═══ 2. PUBLICATION GATES ═══");
const qa = await sh("qa-gate.mjs");
check("QA gate runs", qa.ok, qa.out.split("\n")[0]);
const pa = await sh("publish-assert.mjs");
check("no blocked product in published output", pa.ok, pa.out.split("\n").pop());
const vl = await sh("voice-lint.mjs");
check("no prediction language", vl.ok, vl.out.split("\n")[0]);
const jl = await sh("jargon-lint.mjs");
check("no unexplained jargon", jl.ok, jl.out.split("\n")[0]);

console.log("\n═══ 3. FAILURE SIMULATIONS (break it on purpose) ═══");
const SP = join(ROOT, "data/sealed-prices.json");
await copyFile(SP, join(tmpdir(), "audit-sp.bak"));
try {
  // 3a — total fetch outage
  let sp = JSON.parse(await readFile(SP, "utf-8"));
  for (const p of sp.products) if (p.lastSeen) p.lastSeen = "2026-01-01";
  await writeFile(SP, JSON.stringify(sp, null, 2));
  const outage = await sh("publish-assert.mjs");
  check("stale edition BLOCKS publication", !outage.ok, outage.ok ? "DID NOT BLOCK — critical" : "blocked correctly");

  // 3b — partial fetch
  await copyFile(join(tmpdir(), "audit-sp.bak"), SP);
  sp = JSON.parse(await readFile(SP, "utf-8"));
  const live = sp.products.filter(p => p.lastSeen);
  live.slice(0, Math.floor(live.length / 2)).forEach(p => { p.lastSeen = "2099-01-01"; });
  await writeFile(SP, JSON.stringify(sp, null, 2));
  const partial = await sh("publish-assert.mjs");
  check("partial fetch BLOCKS publication", !partial.ok, partial.ok ? "DID NOT BLOCK — critical" : "blocked correctly");
} finally {
  await copyFile(join(tmpdir(), "audit-sp.bak"), SP);
  await sh("qa-gate.mjs");
}

// 3c — disconnected guard (the 2026-08-21 bug)
const CD = join(ROOT, "scripts/compute-derived.mjs");
await copyFile(CD, join(tmpdir(), "audit-cd.bak"));
try {
  const src = await readFile(CD, "utf-8");
  await writeFile(CD, src.replace("r.signal && !blockedIds.has(r.id)", "r.signal"));
  const broken = await sh("guard-audit.mjs");
  check("disconnected guard FAILS the audit", !broken.ok, broken.ok ? "DID NOT CATCH — critical" : "caught correctly");
} finally { await copyFile(join(tmpdir(), "audit-cd.bak"), CD); }

// 3d — silent empty run
const FEED = join(ROOT, "research/pulse/pulse-feed.json");
await copyFile(FEED, join(tmpdir(), "audit-feed.bak"));
try {
  const f = JSON.parse(await readFile(FEED, "utf-8")); f.products = [];
  await writeFile(FEED, JSON.stringify(f));
  const empty = await sh("publish-assert.mjs");
  check("empty edition BLOCKS publication", !empty.ok, empty.ok ? "DID NOT BLOCK — critical" : "blocked correctly");
} finally { await copyFile(join(tmpdir(), "audit-feed.bak"), FEED); }

// 3e — an agent crash must never stop the guards
const FAL = join(ROOT, "scripts/falsifier.mjs");
await copyFile(FAL, "/tmp/audit-fal.bak");
try {
  const src = await readFile(FAL, "utf-8");
  await writeFile(FAL, src.replace("const today = new Date()", "throw new Error('audit: simulated agent crash');\nconst today = new Date()"));
  const r = await sh("generate-pulse.mjs");
  const guardsRan = r.out.includes("publication assert");
  check("agent crash does NOT stop the guards", guardsRan, guardsRan ? "publish-assert still ran" : "publish-assert was skipped — critical");
} finally { await copyFile("/tmp/audit-fal.bak", FAL); await sh("generate-pulse.mjs"); }

console.log("\n═══ 4. DATA INTEGRITY ═══");
const sp2 = await J("data/sealed-prices.json");
const liveRows = (sp2?.products || []).filter(p => p.dataStatus === "live" && p.priceMedian);
check("no price without a listing count", !liveRows.some(p => !p.listingCount));
check("no implausible medians (>$20k)", !liveRows.some(p => p.priceMedian > 20000));
for (const [f, key] of [["research/pulse/index-history.json", "entries"], ["research/pulse/premium-history.json", "entries"], ["research/pulse/watch-log.json", "entries"]]) {
  const d = await J(f); const rows = d?.[key] || [];
  const dates = rows.map(r => r.date);
  const dupes = key === "entries" && rows.length && !rows[0].id && !rows[0].cardId && !rows[0].era
    ? dates.filter((d_, i) => dates.indexOf(d_) !== i) : [];
  check(`${f.split("/").pop()} merge-by-date holds`, dupes.length === 0, dupes.length ? `duplicates: ${[...new Set(dupes)].slice(0, 3)}` : "");
}
const feedSize = (await readFile(join(ROOT, "research/pulse/pulse-feed.json"), "utf-8")).length / 1024;
check("feed under 300KB budget", feedSize < 300, `${feedSize.toFixed(0)}KB`);

console.log("\n═══ 5. PUBLISHED SURFACES ═══");
const mq = await J("data/quarantine.json");
check("quarantine file present and readable", !!mq, `${(mq?.entries || []).length} held`);
for (const f of ["research/assets/methodology.html", "research/assets/corrections.html"]) {
  const t = await readFile(join(ROOT, f), "utf-8").catch(() => null);
  check(`${f.split("/").pop()} exists`, !!t);
}

const failed = results.filter(r => !r.pass);
const date = new Date().toISOString().slice(0, 10);
await mkdir(join(ROOT, "research/audits"), { recursive: true });
await writeFile(join(ROOT, `research/audits/${date}-audit.md`),
  `# Automated audit — ${date}\n\nRun: \`node scripts/audit.mjs\`. Includes live failure simulations;\nevery file touched is restored.\n\n| check | result | detail |\n|---|---|---|\n` +
  results.map(r => `| ${r.name} | ${r.pass ? "PASS" : "**FAIL**"} | ${r.detail || ""} |`).join("\n") +
  `\n\n**${results.length - failed.length}/${results.length} passed.**` +
  (failed.length ? `\n\nFAILURES REQUIRING ACTION:\n${failed.map(f => `- ${f.name}: ${f.detail}`).join("\n")}` : "\n\nNo action required.") + "\n");

console.log(`\n${results.length - failed.length}/${results.length} passed · report: research/audits/${date}-audit.md`);
if (failed.length) process.exitCode = 1;
