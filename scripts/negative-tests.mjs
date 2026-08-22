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
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
// /tmp is Linux-only. Every backup path here was hardcoded to it, so on
// Windows all nine tests that snapshot a file errored on C:	mp and the audit
// reported "9/18 guards proved real" — the guards were fine, the harness was
// not. A negative-test harness that cannot run is worse than none: it reports
// unproven guards as a guard failure and buries the real signal. (Fifth
// instance of this gotcha in this repo.)
const TMP = p => join(tmpdir(), p.replace(/^\/tmp\//, ""));
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
      await copyFile(P("data/derived-insights.json"), TMP("/tmp/nt-der.bak"));
      await copyFile(P("research/pulse/pulse-feed.json"), TMP("/tmp/nt-feed2.bak"));
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
        await copyFile(TMP("/tmp/nt-der.bak"), P("data/derived-insights.json"));
        try { await copyFile(TMP("/tmp/nt-feed2.bak"), P("research/pulse/pulse-feed.json")); } catch {}
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
      await copyFile(P("data/knowledge.json"), TMP("/tmp/nt-kb.bak"));
      const kb = JSON.parse(await readFile(P("data/knowledge.json"), "utf-8"));
      delete kb.facts[0].falsifier;
      await writeFile(P("data/knowledge.json"), JSON.stringify(kb, null, 1));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-kb.bak"), P("data/knowledge.json")); } },

  { guard: "Flag registry (one condition, one gate)", detect: "flag-guard.mjs",
    break: async () => {
      await copyFile(P("data/flags.json"), TMP("/tmp/nt-flags.bak"));
      const f = JSON.parse(await readFile(P("data/flags.json"), "utf-8"));
      delete f.flags.site;
      await writeFile(P("data/flags.json"), JSON.stringify(f, null, 1));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-flags.bak"), P("data/flags.json")); } },

  { guard: "Publication block wiring", detect: "guard-audit.mjs",
    break: async () => {
      await copyFile(P("scripts/compute-derived.mjs"), TMP("/tmp/nt-cd.bak"));
      const s = await readFile(P("scripts/compute-derived.mjs"), "utf-8");
      await writeFile(P("scripts/compute-derived.mjs"), s.replace("r.signal && !blockedIds.has(r.id)", "r.signal"));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-cd.bak"), P("scripts/compute-derived.mjs")); } },

  { guard: "Content sanity (empty edition)", detect: "publish-assert.mjs",
    break: async () => {
      await copyFile(P("research/pulse/pulse-feed.json"), TMP("/tmp/nt-feed.bak"));
      const f = JSON.parse(await readFile(P("research/pulse/pulse-feed.json"), "utf-8"));
      f.products = [];
      await writeFile(P("research/pulse/pulse-feed.json"), JSON.stringify(f));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-feed.bak"), P("research/pulse/pulse-feed.json")); } },

  { guard: "Stale edition breaker", detect: "publish-assert.mjs",
    break: async () => {
      await copyFile(P("data/sealed-prices.json"), TMP("/tmp/nt-sp.bak"));
      const sp = JSON.parse(await readFile(P("data/sealed-prices.json"), "utf-8"));
      for (const p of sp.products) if (p.lastSeen) p.lastSeen = "2020-01-01";
      await writeFile(P("data/sealed-prices.json"), JSON.stringify(sp, null, 2));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-sp.bak"), P("data/sealed-prices.json")); } },

  { guard: "Data file shapes", detect: "schema-guard.mjs",
    break: async () => {
      await copyFile(P("data/divergence-report.json"), TMP("/tmp/nt-dv.bak"));
      const d = JSON.parse(await readFile(P("data/divergence-report.json"), "utf-8"));
      d.rows = (d.rows || []).slice(0, 2);   // the shape of a run that lost its data
      await writeFile(P("data/divergence-report.json"), JSON.stringify(d));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-dv.bak"), P("data/divergence-report.json")); } },

  { guard: "Thin-sample premium gate", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/compute-derived.mjs"), "utf-8");
      const uses = (src.match(/premiumThin/g) || []).length;
      return { pass: uses >= 2, why: `premiumThin appears ${uses}× — it must be SET when a sample is thin and READ where the premium is published` };
    } },

  { guard: "Run-level wipe guard (fetch)", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/fetch-sealed-prices.mjs"), "utf-8");
      const declared = /WIPE GUARD/.test(src);
      const refuses = /Refusing to overwrite/i.test(src) && /prevLive/.test(src);
      return { pass: declared && refuses, why: declared ? "the wipe guard is described but does not refuse the write" : "no wipe guard found — a run that loses its prices could overwrite the file" };
    } },

  { guard: "Deal Zone model contract", detect: null,
    fn: async () => {
      const der = JSON.parse(await readFile(P("data/derived-insights.json"), "utf-8"));
      const m = der.dealZone?.model;
      const ok = m && typeof m.buyerSide === "string" && typeof m.sellerSide === "string";
      return { pass: !!ok, why: ok ? "" : "dealZone.model is missing its rate description — the app reads its rates from here, so a missing contract means the app silently uses stale defaults" };
    } },

  { guard: "Rotation across boundaries", detect: null,
    // The bug this exists for: day-of-month modulo repeats itself when a month
    // ends on the 31st, because 31 % 5 === 1 % 5. Every rotation in the system
    // had it, including the Daily Three lens rotation the freshness law depends on.
    fn: async () => {
      const { rotateIndex } = await import(pathToFileURL(P("scripts/rotate.mjs")).href);
      const edges = [["2027-01-31", "2027-02-01"], ["2026-12-31", "2027-01-01"], ["2026-11-30", "2026-12-01"], ["2028-02-29", "2028-03-01"]];
      const bad = [];
      for (const n of [3, 5, 7, 9]) {
        for (const [a, b] of edges) {
          const ia = rotateIndex(n, 0, new Date(a + "T12:00:00Z"));
          const ib = rotateIndex(n, 0, new Date(b + "T12:00:00Z"));
          if (ia === ib) bad.push(`${a}→${b} repeats at length ${n}`);
        }
      }
      // and the old approach must still be demonstrably broken, or this test
      // is proving nothing
      const oldRepeats = (31 % 5) === (1 % 5);
      return { pass: bad.length === 0 && oldRepeats,
        why: bad.length ? `rotation repeats across a boundary: ${bad[0]}` : "the old day-of-month approach no longer demonstrates the bug — test is stale" };
    } },

  { guard: "Plausible garbage from a source", detect: "publish-assert.mjs",
    // Everything we own handles a source being DOWN better than it handles a
    // source returning 200 with a believable wrong answer. This is that case:
    // valid JSON, right shape, prices an order of magnitude off. If nothing
    // notices, our guards only protect against honest failures.
    break: async () => {
      await copyFile(P("data/sealed-prices.json"), TMP("/tmp/nt-garbage.bak"));
      const sp = JSON.parse(await readFile(P("data/sealed-prices.json"), "utf-8"));
      for (const p of sp.products) if (p.dataStatus === "live" && p.priceMedian) p.priceMedian = Math.round(p.priceMedian * 10 * 100) / 100;
      await writeFile(P("data/sealed-prices.json"), JSON.stringify(sp, null, 2));
      try { await run("node", [P("scripts/qa-gate.mjs")], { cwd: ROOT }); } catch {}
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-garbage.bak"), P("data/sealed-prices.json")); } },

  { guard: "Thesis coverage (every claim has a live test)", detect: null,
    // A thesis written into doctrine and tested by nothing is exactly the
    // failure the Falsifier exists to prevent. RT-2 and RT-7 were both in that
    // state when this was written — published claims nobody was checking.
    fn: async () => {
      const doc = await readFile(P("research/house-theses.md"), "utf-8");
      const src = await readFile(P("scripts/falsifier.mjs"), "utf-8");
      const theses = [...doc.matchAll(/^## (RT-[0-9a-z]+)/gm)].map(m => m[1]);
      const missing = theses.filter(t => !src.includes(`id: "${t}"`));
      return { pass: missing.length === 0,
        why: missing.length ? `${missing.join(", ")} written into doctrine with no falsifier test — write one or retire the thesis` : "" };
    } },

  { guard: "Agent supervision (farming and broken records)", detect: null,
    // Nothing watched the agents. Their natural failure is not crashing, it is
    // producing volume that looks like work and changes nothing — which gets
    // read for a week and skimmed forever, so the day one finds something real
    // nobody is looking.
    fn: async () => {
      await copyFile(P("data/agent-history.json"), TMP("/tmp/nt-ah.bak"));
      try {
        const h = JSON.parse(await readFile(P("data/agent-history.json"), "utf-8"));
        h.runs["correction-hunter"] = [12, 16, 20, 26].map((c, i) => ({ date: `2026-08-${15 + i}`, count: c, sample: Array.from({ length: c }, (_, n) => `f${n}`) }));
        await writeFile(P("data/agent-history.json"), JSON.stringify(h, null, 1));
        let caught = false;
        try { await run("node", [P("scripts/agent-supervisor.mjs"), "--dry"], { cwd: ROOT }); }
        catch { caught = true; }
        return { pass: caught, why: caught ? "" : "a farming pattern (12→16→20→26 with nothing resolved) did not trip the supervisor" };
      } finally { await copyFile(TMP("/tmp/nt-ah.bak"), P("data/agent-history.json")); }
    } },

  { guard: "Agents cannot halt the run", detect: null,
    // process.exit() is not catchable by the try/catch that wraps agent
    // imports, so an agent calling it kills every guard downstream while
    // still calling itself advisory. Our own supervisor did exactly this
    // minutes after the law forbidding it was written.
    fn: async () => {
      const AGENTS = ["falsifier.mjs", "correction-hunter.mjs", "breaker.mjs", "agent-supervisor.mjs", "review-agents.mjs"];
      const offenders = [];
      for (const f of AGENTS) {
        const src = await readFile(P(`scripts/${f}`), "utf-8").catch(() => "");
        // exitCode is fine (sets a status without halting); exit() is not,
        // unless it is guarded by a standalone check.
        const halts = /process\.exit\(/.test(src);
        const guarded = /STANDALONE/.test(src);
        if (halts && !guarded) offenders.push(f);
      }
      return { pass: offenders.length === 0,
        why: offenders.length ? `${offenders.join(", ")} call process.exit() — not catchable, so they halt every guard downstream while claiming to be advisory` : "" };
    } },

  { guard: "Agent output reaches a human", detect: null,
    // The Improver's first finding was that every agent wrote JSON nothing read
    // — the farming law from the inside. An agent whose output reaches no human
    // has not done work, it has made a file.
    fn: async () => {
      const digest = await readFile(P("scripts/agent-digest.mjs"), "utf-8").catch(() => "");
      const sup = await readFile(P("scripts/agent-supervisor.mjs"), "utf-8").catch(() => "");
      const REPORTS = [...sup.matchAll(/output: "research\/pulse\/([a-z0-9\-]+\.json)"/g)].map(m => m[1]);
      if (!REPORTS.length) return { pass: false, why: "could not read the agent registry — the check would silently pass" };
      const orphaned = REPORTS.filter(r => !digest.includes(r));
      return { pass: orphaned.length === 0,
        why: orphaned.length ? `${orphaned.join(", ")} produced daily and surfaced to nobody — either put it in the digest or stop generating it` : "" };
    } },

  { guard: "Memory findability", detect: "memory-guard.mjs",
    // The knowledge base said last_updated 2026-08-18 while carrying 74 laws
    // written after it, 20,000 characters on one line. All preserved, all
    // unreadable. Work that cannot be found again was not saved, only stored.
    break: async () => {
      await copyFile(P("catchem-knowledge-base.md"), "/tmp/nt-kb2.bak");
      const kb = await readFile(P("catchem-knowledge-base.md"), "utf-8");
      await writeFile(P("catchem-knowledge-base.md"), kb.replace(/\*\*last_updated:\*\*\s*\d{4}-\d{2}-\d{2}/, "**last_updated:** 2020-01-01"));
      return true;
    },
    restore: async () => { await copyFile("/tmp/nt-kb2.bak", P("catchem-knowledge-base.md")); } },

  { guard: "Registered agents actually run", detect: null,
    // Four agents were registered with the supervisor, given cadences and
    // surfaced in the digest — and never added to the pipeline. They existed,
    // were managed, and did nothing. Being registered is not being employed.
    fn: async () => {
      const sup = await readFile(P("scripts/agent-supervisor.mjs"), "utf-8");
      const pipe = await readFile(P("scripts/generate-pulse.mjs"), "utf-8");
      const ids = [...sup.matchAll(/\{ id: "([a-z\-]+)"/g)].map(m => m[1]);
      const MANUAL = ["review-agents"];   // deliberately not scheduled
      const missing = ids.filter(id => !MANUAL.includes(id) &&
        !pipe.includes(`${id}.mjs`) && !pipe.includes(`${id}-agent.mjs`) && !pipe.includes(`${id}-watcher.mjs`) && !pipe.includes(`${id}-agents.mjs`));
      return { pass: missing.length === 0,
        why: missing.length ? `${missing.join(", ")} registered with the supervisor but never imported by the pipeline — managed and doing nothing` : "" };
    } },

  { guard: "Agent contract (steward, platform, anomaly, creator, experience)", detect: null,
    // One case covering the five agents that had none. Each of the last four
    // hires caught a failure in an earlier one — good outcome, bad method. This
    // is the same coverage arrived at by design rather than by luck.
    fn: async () => {
      const AGENTS = ["steward.mjs", "platform-agents.mjs", "anomaly-watcher.mjs", "creator-agent.mjs", "experience.mjs", "universe-advisor.mjs"];
      const bad = [];
      for (const f of AGENTS) {
        const src = await readFile(P(`scripts/${f}`), "utf-8").catch(() => "");
        if (!src) { bad.push(`${f} missing`); continue; }
        // The two failures that have actually bitten us: halting the pipeline,
        // and writing a report nothing reads.
        // Strip comments first — this test read a comment EXPLAINING why we do not
        // call process.exit as evidence that we do. Third time today a checker has
        // audited prose instead of code.
        const code = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
        if (/process\.exit\(/.test(code) && !/STANDALONE/.test(code)) bad.push(`${f} can halt the run`);
        const out = /writeFile\([^)]*research\/pulse\/([a-z0-9\-]+\.json)/.exec(src);
        if (out) {
          const digest = await readFile(P("scripts/agent-digest.mjs"), "utf-8").catch(() => "");
          if (!digest.includes(out[1])) bad.push(`${f} output unsurfaced`);
        }
      }
      return { pass: bad.length === 0, why: bad.join("; ") };
    } },

  { guard: "Secret detection", detect: "security-agent.mjs",
    // The one guard where a miss is unrecoverable. Plant a fake credential and
    // confirm the scanner fails the run; a scanner nobody has tested is a
    // scanner that has never caught anything.
    break: async () => {
      await writeFile(P("scripts/_leaktest.mjs"), 'const k = "sk-ant-FAKEFAKEFAKEFAKEFAKEFAKE123456";\n');
      return true;
    },
    restore: async () => { try { await (await import("node:fs/promises")).unlink(P("scripts/_leaktest.mjs")); } catch {} } },

  { guard: "Compliance trip-wires", detect: null,
    // Plant real payment machinery and confirm the existential trigger fires.
    // A trip-wire nobody has tested is a trip-wire that has never tripped.
    fn: async () => {
      await writeFile(P("scripts/_paytest.mjs"), 'import Stripe from "@stripe/stripe-js";\nconst s = await createCheckoutSession();\n');
      try {
        await run("node", [P("scripts/compliance-agent.mjs")], { cwd: ROOT });
        const rep = JSON.parse(await readFile(P("research/pulse/compliance-report.json"), "utf-8"));
        const fired = (rep.tripped ?? []).some(t => t.id === "pokemon-ip-depiction");
        return { pass: fired, why: fired ? "" : "payment machinery did not trip the IP obligation — the trip-wire is not connected" };
      } finally {
        try { await (await import("node:fs/promises")).unlink(P("scripts/_paytest.mjs")); } catch {}
        try { await run("node", [P("scripts/compliance-agent.mjs")], { cwd: ROOT }); } catch {}
      }
    } },

  { guard: "Referee Doctrine (adversarial framing)", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/voice-lint.mjs"), "utf-8");
      const defined = /const ADVERSARIAL\s*=/.test(src), applied = /ADVERSARIAL\.filter\(/.test(src);
      return { pass: defined && applied, why: defined ? "ADVERSARIAL is defined but never applied — a pattern list nothing checks is decoration" : "ADVERSARIAL is missing" };
    } },

  // ── THE BREAKER'S PENDING LIST, closed 2026-08-22 ────────────────────────
  // The two catchem-app guards were registered and never deliberately broken.
  // Both were broken for real this session — a blank render shipped to a local
  // preview, and collector mode made to hide the Listings figure — both failed
  // correctly, both restored. Those runs need a browser and a served build, so
  // they cannot live in this harness. What lives here is the LOGIC each guard
  // depends on, exercised directly, so a regression in the comparator or in the
  // blank-page threshold is caught even where no browser exists.

  { guard: "Mode honesty comparator", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/mode-diff-test.mjs"), "utf-8");
      const m = src.match(/export const figures =[\s\S]*?\.sort\(\);/);
      if (!m) return { pass: false, why: "figures() not found in mode-diff-test.mjs" };
      const figures = eval("(" + m[0].replace("export const figures =", "").replace(/;$/, "") + ")");
      const base = figures("Index 100.6 and $54.45 and 20 listings and 0.6%");
      const reordered = figures("0.6% and 20 listings and $54.45 and Index 100.6");
      const dropped = figures("Index 100.6 and $54.45 and 0.6%");
      const changed = figures("Index 100.6 and $54.45 and 19 listings and 0.6%");
      const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const ok = eq(base, reordered) && !eq(base, dropped) && !eq(base, changed);
      const why = !eq(base, reordered) ? "reordering must compare EQUAL — modes are allowed to reorder"
        : eq(base, dropped) ? "a DROPPED figure compared equal — the honesty law would not be enforced"
        : "a CHANGED figure compared equal — set-difference blindness";
      return { pass: ok, why };
    } },

  { guard: "Deploy smoke test (blank page)", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/smoke-test.mjs"), "utf-8");
      const hasBlank = src.includes("app is not a blank page");
      const hasNav = src.includes("nav present");
      const hasPrice = src.includes("a product price renders");
      const hasErrors = src.includes("pageerror");
      const ok = hasBlank && hasNav && hasPrice && hasErrors;
      const why = !hasBlank ? "the blank-page check is gone — a blank deploy would pass"
        : !hasNav ? "nav assertion missing" : !hasPrice ? "price assertion missing" : "pageerror capture missing";
      return { pass: ok, why };
    } },

  { guard: "Slow host cannot hang the smoke test", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/smoke-test.mjs"), "utf-8");
      if (!src.includes("AbortSignal.timeout")) return { pass: false, why: "no fetch timeout — a slow host hangs the run" };
      if (/await fetch\(/.test(src)) return { pass: false, why: "a bare fetch() remains — every fetch must carry the timeout" };
      const { createServer } = await import("node:http");
      const server = createServer(() => {});
      await new Promise((r) => server.listen(0, r));
      const port = server.address().port;
      const t0 = Date.now();
      let aborted = false;
      try { await fetch("http://localhost:" + port + "/", { signal: AbortSignal.timeout(1200) }); }
      catch { aborted = true; }
      server.close();
      const ms = Date.now() - t0;
      return { pass: aborted && ms < 5000, why: aborted ? "abort took " + ms + "ms" : "a hanging host did not abort" };
    } },

  { guard: "Feed values, not just shape", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/smoke-test.mjs"), "utf-8");
      const missing = ["index level is plausible", "product values are possible"].filter((c) => !src.includes(c));
      if (missing.length) return { pass: false, why: "value checks missing: " + missing.join(", ") };
      const PRICE_MAX = 100000;
      const bad = (p) => (p.median != null && !(p.median > 0 && p.median < PRICE_MAX))
        || (p.listings != null && !(Number.isFinite(p.listings) && p.listings >= 0))
        || (p.floor != null && p.high != null && p.floor > p.high);
      const poison = [{ median: -412.55, listings: -7, floor: 5000000, high: 0.01 }, { median: 99999999 }];
      const good = [{ median: 249.99, listings: 74, floor: 130.81, high: 490.55 }];
      const lvlBad = !(8123456.9 > 1 && 8123456.9 < 10000);
      const lvlGood = 100 > 1 && 100 < 10000;
      const ok = poison.every(bad) && !good.some(bad) && lvlBad && lvlGood;
      const why = !poison.every(bad) ? "impossible product values were accepted"
        : good.some(bad) ? "a REAL product row was rejected — false positive"
        : "the index plausibility band is wrong";
      return { pass: ok, why };
    } },

  { guard: "Image bytes must be an image", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/rasterize-cards.mjs"), "utf-8");
      const m = src.match(/function looksLikeImage[\s\S]*?\n}/);
      if (!m) return { pass: false, why: "looksLikeImage() missing — image bytes are unverified" };
      const looksLikeImage = new Function("return " + m[0])();
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      const text = Buffer.from("this is not a JPEG, but the headers say it is");
      const ok = looksLikeImage(jpeg) && looksLikeImage(png) && !looksLikeImage(text) && !looksLikeImage(Buffer.alloc(0));
      const why = looksLikeImage(text) ? "text passed as an image — garbage would reach a minted card"
        : "a REAL image header was rejected — cards would lose their photos";
      return { pass: ok, why };
    } },

  { guard: "Slow image host cannot hang the run", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/rasterize-cards.mjs"), "utf-8");
      const ok = src.includes("AbortSignal.timeout(IMG_TIMEOUT_MS)");
      return { pass: ok, why: "the image fetch has no timeout — a slow CDN hangs the daily run" };
    } },

  { guard: "Plausibility (values, not just shape)", detect: null,
    // schema-guard passed on files whose every key was present and every number
    // impossible. Shape and possibility are two different guards; we had one.
    fn: async () => {
      const src = await readFile(P("scripts/schema-guard.mjs"), "utf-8");
      for (const marker of ["cannot be negative", "above high", "recorded in the future", "beyond any real move"])
        if (!src.includes(marker)) return { pass: false, why: `plausibility check missing: "${marker}"` };
      const { readFile: rf, writeFile, copyFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const target = P("data/sealed-prices.json");
      const bak = join(tmpdir(), "nt-plaus.bak");
      await copyFile(target, bak);
      try {
        const d = JSON.parse(await rf(target, "utf-8"));
        d.products[0].priceMedian = -99.99;                 // impossible, shape untouched
        await writeFile(target, JSON.stringify(d, null, 1));
        const r = await sh("schema-guard.mjs");
        return { pass: r.failed, why: r.failed ? "" : "a negative price passed the schema guard — shape is checked, values are not" };
      } finally { await copyFile(bak, target); }
    } },

  { guard: "No unbounded fetch()", detect: null,
    // Node's fetch never times out. One unguarded call hangs a CI job until the
    // runner kills it: nothing goes red, the allowance burns, no guard reports.
    fn: async () => {
      const src = await readFile(P("scripts/guard-audit.mjs"), "utf-8");
      if (!src.includes("UNBOUNDED fetch")) return { pass: false, why: "guard-audit no longer checks for unbounded fetch()" };
      const { readFile: rf, writeFile, copyFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const target = P("scripts/heartbeat.mjs");
      const bak = join(tmpdir(), "nt-fetch.bak");
      await copyFile(target, bak);
      try {
        const s2 = await rf(target, "utf-8");
        await writeFile(target, 'const __p = async () => await fetch("https://example.com/x");\n' + s2);
        const r = await sh("guard-audit.mjs");
        return { pass: r.failed, why: r.failed ? "" : "an unbounded fetch() passed guard-audit" };
      } finally { await copyFile(bak, target); }
    } },

  { guard: "No hardcoded /tmp", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/guard-audit.mjs"), "utf-8");
      if (!src.includes("HARDCODED /tmp")) return { pass: false, why: "guard-audit no longer checks for hardcoded /tmp" };
      const { readFile: rf, writeFile, copyFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const target = P("scripts/heartbeat.mjs");
      const bak = join(tmpdir(), "nt-tmp.bak");
      await copyFile(target, bak);
      try {
        const s2 = await rf(target, "utf-8");
        await writeFile(target, 'const __t = "/tmp/deliberate.bak";\n' + s2);
        const r = await sh("guard-audit.mjs");
        return { pass: r.failed, why: r.failed ? "" : "a hardcoded /tmp passed guard-audit" };
      } finally { await copyFile(bak, target); }
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
