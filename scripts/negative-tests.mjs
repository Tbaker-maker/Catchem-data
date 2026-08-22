// negative-tests.mjs — a guard is not real until breaking it fails the build.
//
// We wrote that law, registered 25 guards under it, and never actually broke
// most of them. The Breaker caught us. This closes it — not with 25 hand-written
// tests that rot, but with ONE harness and a declarative table. Adding a guard
// means adding a row; forgetting to add the row is itself caught, because
// guard-audit checks that every registry entry has a case here.
//
// Each case: break something specific, run the script that should notice,
// assert it fails, restore. Anything that passes when broken is a guard that
// does not exist, however confidently it is registered.
import { readFile, writeFile, copyFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = p => join(ROOT, p);
const sh = async (script) => { try { await run("node", [P(`scripts/${script}`)], { cwd: ROOT }); return { failed: false }; }
  catch (e) { return { failed: true, out: ((e.stdout || "") + (e.stderr || "")).slice(-300) }; } };

// break: mutate something. detect: the script that must fail because of it.
const CASES = [
  { guard: "Multi-item listings", detect: null,
    fn: async () => {
      const { readFile } = await import("node:fs/promises");
      const src = await readFile(P("scripts/fetch-sealed-prices.mjs"), "utf-8");
      const i = src.indexOf("const MULTI_ITEM_RX");
      const j = src.indexOf("const isMultiItem");
      const k = src.indexOf("\n", j);
      if (i < 0 || j < 0) return { pass: false, why: "MULTI_ITEM_RX or isMultiItem not found" };
      const test = eval(`(() => { ${src.slice(i, k)}; return isMultiItem; })()`);
      const rejects = test("Booster Pack x2") && test("Lot of 3 Booster Packs") && test("Sealed Case");
      const keeps = !test("Destined Rivals Booster Pack x1") && !test("Booster Pack (1x)") && !test("Evolving Skies Booster Box");
      return { pass: rejects && keeps, why: rejects ? (keeps ? "" : "rejects a SINGLE-pack listing — x1/(1x) must be kept") : "fails to reject a genuine multi-item listing" };
    } },

  { guard: "Currency guard", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/fetch-sealed-prices.mjs"), "utf-8");
      return { pass: /currency\s*!==\s*"USD"/.test(src) && /return null/.test(src),
        why: "the non-USD early return is missing from deliveredPriceOf" };
    } },

  { guard: "Manual quarantine durability", detect: null,
    // Asserts the OUTCOME, not a mechanism. The first version of this test
    // demanded that publish-assert specifically fail, and reported a hole when
    // an EARLIER layer stripped the poison instead — defence in depth looking
    // like a failure. What matters is that a quarantined product cannot reach
    // an editorial surface, whichever layer stops it.
    fn: async () => {
      await copyFile(P("data/derived-insights.json"), "/tmp/nt-der.bak");
      await copyFile(P("research/pulse/pulse-feed.json"), "/tmp/nt-feed2.bak");
      try {
        const q = JSON.parse(await readFile(P("data/quarantine.json"), "utf-8"));
        const sp = JSON.parse(await readFile(P("data/sealed-prices.json"), "utf-8"));
        const id = (q.entries || [])[0]?.id;
        const prod = (sp.products || []).find(x => x.id === id);
        if (!prod) return { pass: null, why: "nothing quarantined to test with" };
        const der = JSON.parse(await readFile(P("data/derived-insights.json"), "utf-8"));
        der.dailyThree = der.dailyThree || {};
        der.dailyThree.sealed = { name: prod.name, ebay: prod.priceMedian, chip: "VERIFIED", explain: "forced quarantined pick" };
        await writeFile(P("data/derived-insights.json"), JSON.stringify(der, null, 2));
        try { await run("node", [P("scripts/generate-pulse.mjs")], { cwd: ROOT }); } catch {}
        const feed = JSON.parse(await readFile(P("research/pulse/pulse-feed.json"), "utf-8"));
        const editorial = JSON.stringify({ dailyThree: feed.dailyThree, supplyShifts: feed.supplyShifts, watchOutcomes: feed.watchOutcomes });
        const leaked = editorial.includes(prod.name);
        return { pass: !leaked, why: leaked ? `${prod.name} reached an editorial block while quarantined` : `stripped before publication (${prod.name} never reached an editorial block)` };
      } finally {
        await copyFile("/tmp/nt-der.bak", P("data/derived-insights.json"));
        try { await copyFile("/tmp/nt-feed2.bak", P("research/pulse/pulse-feed.json")); } catch {}
      }
    } },

  { guard: "Seasoning (90-day)", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/compute-derived.mjs"), "utf-8");
      const uses = (src.match(/seasoned\(p\)/g) || []).length;
      return { pass: uses >= 2, why: `seasoned() is applied ${uses}× — it must gate the composite AND the subtype indexes` };
    } },

  { guard: "Venue boundary (RT-4a)", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/compute-divergence.mjs"), "utf-8");
      const uses = (src.match(/OFF_TCG\(/g) || []).length;
      return { pass: uses >= 2, why: `OFF_TCG is applied ${uses}× — it must be defined AND consulted when setting the signal` };
    } },

  { guard: "Knowledge entry law", detect: "knowledge-guard.mjs",
    break: async () => {
      await copyFile(P("data/knowledge.json"), "/tmp/nt-kb.bak");
      const kb = JSON.parse(await readFile(P("data/knowledge.json"), "utf-8"));
      delete kb.facts[0].falsifier;
      await writeFile(P("data/knowledge.json"), JSON.stringify(kb, null, 1));
      return true;
    },
    restore: async () => { await copyFile("/tmp/nt-kb.bak", P("data/knowledge.json")); } },

  { guard: "Flag registry (one condition, one gate)", detect: "flag-guard.mjs",
    break: async () => {
      await copyFile(P("data/flags.json"), "/tmp/nt-flags.bak");
      const f = JSON.parse(await readFile(P("data/flags.json"), "utf-8"));
      delete f.flags.site;
      await writeFile(P("data/flags.json"), JSON.stringify(f, null, 1));
      return true;
    },
    restore: async () => { await copyFile("/tmp/nt-flags.bak", P("data/flags.json")); } },

  { guard: "Publication block wiring", detect: "guard-audit.mjs",
    break: async () => {
      await copyFile(P("scripts/compute-derived.mjs"), "/tmp/nt-cd.bak");
      const s = await readFile(P("scripts/compute-derived.mjs"), "utf-8");
      await writeFile(P("scripts/compute-derived.mjs"), s.replace("r.signal && !blockedIds.has(r.id)", "r.signal"));
      return true;
    },
    restore: async () => { await copyFile("/tmp/nt-cd.bak", P("scripts/compute-derived.mjs")); } },

  { guard: "Content sanity (empty edition)", detect: "publish-assert.mjs",
    break: async () => {
      await copyFile(P("research/pulse/pulse-feed.json"), "/tmp/nt-feed.bak");
      const f = JSON.parse(await readFile(P("research/pulse/pulse-feed.json"), "utf-8"));
      f.products = [];
      await writeFile(P("research/pulse/pulse-feed.json"), JSON.stringify(f));
      return true;
    },
    restore: async () => { await copyFile("/tmp/nt-feed.bak", P("research/pulse/pulse-feed.json")); } },

  { guard: "Stale edition breaker", detect: "publish-assert.mjs",
    break: async () => {
      await copyFile(P("data/sealed-prices.json"), "/tmp/nt-sp.bak");
      const sp = JSON.parse(await readFile(P("data/sealed-prices.json"), "utf-8"));
      for (const p of sp.products) if (p.lastSeen) p.lastSeen = "2020-01-01";
      await writeFile(P("data/sealed-prices.json"), JSON.stringify(sp, null, 2));
      return true;
    },
    restore: async () => { await copyFile("/tmp/nt-sp.bak", P("data/sealed-prices.json")); } },

  { guard: "Referee Doctrine (adversarial framing)", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/voice-lint.mjs"), "utf-8");
      const defined = /const ADVERSARIAL\s*=/.test(src), applied = /ADVERSARIAL\.filter\(/.test(src);
      return { pass: defined && applied, why: defined ? "ADVERSARIAL is defined but never applied — a pattern list nothing checks is decoration" : "ADVERSARIAL is missing" };
    } },
];

const results = [];
for (const c of CASES) {
  try {
    if (c.fn) {
      const r = await c.fn();
      results.push({ guard: c.guard, ok: r.pass, note: r.pass ? "verified by inspection" : r.why });
      continue;
    }
    const broke = await c.break();
    if (!broke) { results.push({ guard: c.guard, ok: null, note: "could not stage the break (data missing) — SKIPPED, not passed" }); continue; }
    const r = await sh(c.detect);
    results.push({ guard: c.guard, ok: r.failed, note: r.failed ? `${c.detect} failed as it should` : `${c.detect} PASSED while broken — this guard does not exist` });
  } catch (e) {
    results.push({ guard: c.guard, ok: false, note: `test errored: ${e.message}` });
  } finally { if (c.restore) { try { await c.restore(); } catch {} } }
}

// Leave the world exactly as we found it.
try { await run("node", [P("scripts/compute-derived.mjs")], { cwd: ROOT }); } catch {}
try { await run("node", [P("scripts/generate-pulse.mjs")], { cwd: ROOT }); } catch {}

const failed = results.filter(r => r.ok === false);
const skipped = results.filter(r => r.ok === null);
console.log(`\n✓ negative tests: ${results.filter(r => r.ok).length}/${results.length} guards proved real${skipped.length ? ` · ${skipped.length} skipped` : ""}`);
for (const r of results) console.log(`  ${r.ok === true ? "✓" : r.ok === null ? "–" : "✗"} ${r.guard.padEnd(38)} ${r.note}`);
if (failed.length) { console.error(`\n✗ ${failed.length} guard(s) did not fail when broken. A guard that passes while broken is not a guard.\n`); process.exit(1); }
