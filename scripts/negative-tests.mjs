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
      await copyFile(P("catchem-knowledge-base.md"), TMP("/tmp/nt-kb2.bak"));
      const kb = await readFile(P("catchem-knowledge-base.md"), "utf-8");
      await writeFile(P("catchem-knowledge-base.md"), kb.replace(/\*\*last_updated:\*\*\s*\d{4}-\d{2}-\d{2}/, "**last_updated:** 2020-01-01"));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-kb2.bak"), P("catchem-knowledge-base.md")); } },

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
      await writeFile(P("scripts/_leaktest.mjs"), ["sk", "ant", "api03", "Zq7mKp2xRv9nLd4tYcB8hJwF3sG"].join("-").replace("sk-ant-api03", "sk-ant-api03") + "\n");
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

  { guard: "Legal knowledge sourced", detect: null,
    // Every legal claim must carry a source and the disclaimer must survive.
    // An unsourced legal assertion is the most dangerous sentence this system
    // could produce, because it is the one a reader would most trust.
    fn: async () => {
      const kb = JSON.parse(await readFile(P("data/legal-knowledge.json"), "utf-8"));
      const bad = (kb.domains ?? []).filter(d => !(d.sources ?? []).length || !d.rule);
      const hasDisclaimer = /not legal advice/i.test(kb.disclaimer ?? "");
      return { pass: bad.length === 0 && hasDisclaimer,
        why: bad.length ? `${bad.map(b => b.id).join(", ")} state a rule with no source` : hasDisclaimer ? "" : "the not-legal-advice disclaimer is missing" };
    } },

  { guard: "Content is meaningful", detect: "content-sanity.mjs",
    // The chase card published the single word "chase" as its explanation and
    // EVERY guard passed it: the feed was valid, the product was not blocked,
    // the voice was not hyped, the jargon was clean, the shape was right. It
    // was simply meaningless, and meaninglessness was not on anybody's list.
    break: async () => {
      await copyFile(P("research/pulse/pulse-feed.json"), TMP("/tmp/nt-cs.bak"));
      const f = JSON.parse(await readFile(P("research/pulse/pulse-feed.json"), "utf-8"));
      if (!f.dailyThree?.raw) return false;
      f.dailyThree.raw.explain = "chase";
      await writeFile(P("research/pulse/pulse-feed.json"), JSON.stringify(f));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-cs.bak"), P("research/pulse/pulse-feed.json")); } },

  { guard: "Agent competence declared", detect: "competence-guard.mjs",
    // Strip an agent's blind spots and the build must fail. A specialist who
    // cannot name the edge of their own competence is the one that does damage.
    break: async () => {
      await copyFile(P("data/agent-competence.json"), TMP("/tmp/nt-ac.bak"));
      const c = JSON.parse(await readFile(P("data/agent-competence.json"), "utf-8"));
      c.domains.security.blindSpots = [];
      await writeFile(P("data/agent-competence.json"), JSON.stringify(c, null, 1));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-ac.bak"), P("data/agent-competence.json")); } },

  { guard: "App builds before push", detect: null,
    // I pushed a JSX syntax error to main. The data repo has a dozen guards and
    // the app repo had nothing checking that it still compiles from here.
    fn: async () => {
      try {
        // shell:true because npx is npx.cmd on Windows and execFile cannot
        // resolve it otherwise — without this the spawn fails with ENOENT and
        // the catch below called a perfectly healthy app broken.
        await run("npx", ["esbuild", "--loader:.jsx=jsx", "--outfile=" + TMP("/tmp/nt-appbuild.js"), "../catchem-app/src/Ticker.jsx"],
          { cwd: ROOT, shell: process.platform === "win32" });
        return { pass: true, why: "" };
      } catch (e) {
        const out = ((e.stdout || "") + (e.stderr || ""));
        // A MISSING TOOL is not a broken app. ENOENT arrives on e.code with
        // empty stdout/stderr, so testing the output alone fell through to
        // "does not compile: unknown" — turning "I could not check" into "your
        // app is broken", which is the worse of the two lies a guard can tell.
        if (e.code === "ENOENT" || /not found|ENOENT|Cannot find/.test(out))
          return { pass: null, why: "esbuild/npx unavailable here — SKIPPED, not passed" };
        return { pass: false, why: `catchem-app does not compile: ${out.split("\n").find(l => /ERROR/.test(l)) ?? "unknown"}` };
      }
    } },

  { guard: "API strategist does not read itself", detect: null,
    // It reported 0 critical findings because its own WORTH map names every
    // field it looks for, so it found itself and called everything used. Fourth
    // self-read in one day: three checkers audited comments, one audited a test
    // fixture, this one audited its own vocabulary. The pattern is a checker
    // whose search space includes the checker.
    // REWRITTEN 2026-08-23. This asserted `critical > 0` as a proxy for "the
    // walk still works", and it went red the day the walk started working
    // BETTER: vol30 is now genuinely consumed by compute-demand, and the rest
    // are read by the enrichment distiller, so the critical count legitimately
    // fell to zero. A test that fails when the codebase improves trains people
    // to ignore it. So prove the walk directly instead — plant a field that
    // nothing anywhere reads, and require the strategist to find it.
    fn: async () => {
      const target = P("scripts/api-strategist.mjs");
      const src = await readFile(target, "utf-8");
      const excludesSelf = /api-strategist\.mjs/.test(src);
      if (!excludesSelf) return { pass: false, why: "it no longer excludes its own source, so it will find its own vocabulary and report everything as used" };
      const bak = TMP("/tmp/nt-strategist.bak");
      await copyFile(target, bak);
      // ASSEMBLED AT RUNTIME, never written as a literal. The first version of
      // this test spelled the canary out, and the strategist found it here, in
      // the test file, and correctly called it "used" — the very self-read
      // failure this guard exists to catch, reproduced by the guard's own test.
      const CANARY = ["nt", "Canary", "Field"].join("");
      try {
        // A field name that appears in the WORTH map and nowhere else on disk.
        // If the walk is alive, this is an unread field and it says so.
        const planted = src.replace("const WORTH = {",
          `const WORTH = {\n      ${CANARY}: { v: "critical", why: "planted by negative-tests; nothing reads this." },`);
        if (planted === src) return { pass: false, why: "could not plant the canary — the WORTH map moved" };
        await writeFile(target, planted);
        // Plant the value too, or the walk never sees the key on the row.
        const enrichPath = P("data/singles-enrichment.json");
        const ebak = TMP("/tmp/nt-enrich.bak");
        await copyFile(enrichPath, ebak);
        try {
          const e = JSON.parse(await readFile(enrichPath, "utf-8"));
          const rows = e.cards ?? e.rows ?? [];
          if (!rows.length) return { pass: true, why: "" }; // nothing to scan; not a failure of this guard
          rows[0][CANARY] = 123;
          await writeFile(enrichPath, JSON.stringify(e, null, 1));
          await run("node", [target], { cwd: ROOT }).catch(() => {});
          const rep = JSON.parse(await readFile(P("research/pulse/api-strategy.json"), "utf-8").catch(() => "{}"));
          const found = JSON.stringify(rep.findings ?? []).includes(CANARY);
          return { pass: found, why: "the strategist did not report a field that nothing in the repo reads — the unused-field walk is broken" };
        } finally { await copyFile(ebak, enrichPath); }
      } finally {
        await copyFile(bak, target);
        // Leave the real report behind, not the canary one.
        await run("node", [target], { cwd: ROOT }).catch(() => {});
      }
    } },

  { guard: "Teacher does not scold a winner", detect: null,
    // Its first run told the falsifier it was in a rut for finding nothing -
    // but the falsifier finding nothing means no thesis failed, which is the
    // whole point of it. Sixth crying-wolf in a day, in a new costume: telling
    // somebody who is winning that they are stuck.
    fn: async () => {
      const rep = JSON.parse(await readFile(P("research/pulse/teacher.json"), "utf-8").catch(() => "{}"));
      const scolded = (rep.lessons ?? []).filter(l => l.kind === "in a rut" && ["falsifier", "compliance", "anomaly", "security", "review-agents"].includes(l.agent));
      return { pass: scolded.length === 0,
        why: scolded.length ? `${scolded.map(s => s.agent).join(", ")} told they are in a rut for succeeding` : "" };
    } },

  { guard: "Falsifier tests the actual claim", detect: null,
    // RT-5 makes TWO claims - a tax on established chases and an INVERSION on
    // Mega-era ones. The first test pooled both cohorts, got 50%, and reported
    // TRIPPED on a thesis that is 11 of 12 accurate. A falsifier that tests a
    // simpler version of a claim will eventually retire a correct thesis.
    fn: async () => {
      const src = await readFile(P("scripts/falsifier.mjs"), "utf-8");
      const doc = await readFile(P("research/house-theses.md"), "utf-8");
      // Any thesis whose statement contains a contrast word must be tested as
      // more than one cohort.
      const contrastive = [...doc.matchAll(/^## (RT-[0-9a-z]+)[\s\S]{0,400}?(invert|unless|except|but not|whereas)/gmi)].map(m => m[1]);
      const untested = contrastive.filter(id => {
        const block = (src.split(`id: "${id}"`)[1] ?? "").slice(0, 1600);
        return block && !/filter\(|cohort|split|both halves/i.test(block);
      });
      return { pass: untested.length === 0,
        why: untested.length ? `${untested.join(", ")} state a contrast and are tested as a single pooled claim - pooling a contrastive thesis produces its own failure by construction` : "" };
    } },

  { guard: "Windowless price never publishes", detect: "windowless-price-guard.mjs",
    // The worst failure of the project: a PSA 10 median with no date range was
    // published as a current price and nearly went out as a post. Tyler caught
    // it. Plant one back into the feed and the build must fail.
    break: async () => {
      await copyFile(P("research/pulse/pulse-feed.json"), TMP("nt-wp.bak"));
      const f = JSON.parse(await readFile(P("research/pulse/pulse-feed.json"), "utf-8"));
      f.dailyThree = f.dailyThree || {};
      f.dailyThree.graded = { name: "test", raw: 1000, psa10: 5000, chip: "VERIFIED" };
      await writeFile(P("research/pulse/pulse-feed.json"), JSON.stringify(f));
      return true;
    },
    restore: async () => { await copyFile(TMP("nt-wp.bak"), P("research/pulse/pulse-feed.json")); } },

  { guard: "Work verification catches a windowless figure", detect: "verify-work.mjs",
    // Strip the asOf from a chipped price and the build must fail — that is the
    // exact shape of error 18, which nearly went out as a post.
    break: async () => {
      await copyFile(P("research/pulse/pulse-feed.json"), TMP("nt-vw.bak"));
      const f = JSON.parse(await readFile(P("research/pulse/pulse-feed.json"), "utf-8"));
      if (f.dailyThree?.raw) { delete f.dailyThree.raw.asOf; delete f.dailyThree.raw.source; }
      await writeFile(P("research/pulse/pulse-feed.json"), JSON.stringify(f));
      return true;
    },
    restore: async () => { await copyFile(TMP("nt-vw.bak"), P("research/pulse/pulse-feed.json")); } },

  { guard: "Decision log entries are gradable", detect: "decision-audit.mjs",
    // A decision with no falsifiable prediction cannot ever be graded, which
    // makes it an opinion with a timestamp. Strip one and the build must fail.
    fn: async () => {
      const src = await readFile(P("scripts/decision-audit.mjs"), "utf-8");
      const log = JSON.parse(await readFile(P("data/decision-log.json"), "utf-8"));
      const ungradable = (log.decisions ?? []).filter(d => !d.predicts || !d.rejected || !d.checkAfter);
      const enforces = /no prediction/.test(src) && /no rejected alternative/.test(src);
      return { pass: ungradable.length === 0 && enforces,
        why: ungradable.length ? `${ungradable.map(d => d.id).join(", ")} cannot be graded` : "the auditor no longer enforces that every decision carries a prediction" };
    } },

  { guard: "Verifier cannot be quietly weakened", detect: null,
    // I wrote the thing that checks my work and can soften it at any time. This
    // asserts it still covers every class in the ledger — so relaxing a rule
    // fails the build rather than passing silently.
    fn: async () => {
      const v = await readFile(P("scripts/verify-work.mjs"), "utf-8");
      const ledger = await readFile(P("research/RESEARCH-GATE.md"), "utf-8");
      const classes = ledger.split("\n").filter(l => /^\| \d+ \|/.test(l))
        .map(r => (r.split("|")[4] ?? "").trim().toLowerCase()).filter(Boolean);
      const unguarded = [...new Set(classes)].filter(c => {
        const words = c.split(/\W+/).filter(w => w.length > 4);
        return words.length && !words.some(w => v.toLowerCase().includes(w));
      });
      return { pass: unguarded.length === 0,
        why: unguarded.length ? `${unguarded.length} ledger class(es) no longer covered: ${unguarded.slice(0, 3).join("; ")} — the verifier has been weakened or the ledger has grown past it` : "" };
    } },

  { guard: "Layout is measured, not estimated", detect: null,
    // Five broken visuals in one day, all layout, all shipped because I
    // estimated text width from character count. The fonts are vendored; the
    // measurement uses the same glyphs the renderer does.
    fn: async () => {
      // pathToFileURL, not the bare path. Dynamic import() on Windows rejects
      // "C:\..." with "Received protocol 'c:'", so this test ERRORED rather
      // than ran, and an errored test reports as a failed guard — the layout
      // guard looked broken when only the harness was. (Verified 2026-08-23;
      // this is the same gotcha the file's own header records, one more time.)
      const { checkSvg } = await import(pathToFileURL(P("scripts/layout-check.mjs")).href);
      const clip = `<svg viewBox="0 0 1200 675"><text x="70" y="188" font-family="Syne" font-weight="800" font-size="46">He drew Base Set Charizard in 1999.</text></svg>`;
      const collide = `<svg viewBox="0 0 1200 675"><text x="70" y="592" font-family="JetBrainsMono" font-weight="700" font-size="27">-66.7%</text><text x="70" y="620" font-family="Syne" font-weight="800" font-size="30">Catch</text></svg>`;
      const good = `<svg viewBox="0 0 1200 675"><text x="70" y="188" font-family="Syne" font-weight="800" font-size="40">He drew Base Set Charizard</text></svg>`;
      const c1 = checkSvg(clip, { name: "t" }).some(i => /clip/.test(i.issue));
      const c2 = checkSvg(collide, { name: "t" }).some(i => /overlaps/.test(i.issue));
      const c3 = checkSvg(good, { name: "t" }).filter(i => i.severity === "critical").length === 0;
      return { pass: c1 && c2 && c3,
        why: !c1 ? "does not catch clipping" : !c2 ? "does not catch collisions" : "false-positives on a card that is fine" };
    } },

  { guard: "Slop is caught", detect: "slop-guard.mjs",
    // A grouping not in the data is the fastest way to lose trust in every
    // grouping that IS. Plant one and the build must fail.
    break: async () => {
      await copyFile(P("research/pulse/formulas.json"), TMP("nt-slop.bak"));
      const f = JSON.parse(await readFile(P("research/pulse/formulas.json"), "utf-8"));
      f.formulas.push({ kind: "t", title: "The cutest cards", basis: "vibes", cards: ["a", "b"], count: 2, why: "iconic", angle: "the best" });
      await writeFile(P("research/pulse/formulas.json"), JSON.stringify(f));
      return true;
    },
    restore: async () => { await copyFile(TMP("nt-slop.bak"), P("research/pulse/formulas.json")); } },

  { guard: "Theme scout proposes, never adopts", detect: null,
    // Deciding a group of Pokemon belongs together is taste. An agent writing
    // its own taste into data/themes.json would be asserting significance,
    // which is the one thing the slop law exists to stop.
    fn: async () => {
      const src = await readFile(P("scripts/theme-scout.mjs"), "utf-8");
      const writesThemes = /writeFile\([^)]*themes\.json/.test(src);
      const rep = JSON.parse(await readFile(P("research/pulse/theme-scout.json"), "utf-8").catch(() => "{}"));
      const candidates = (rep.finds ?? []).filter(f => f.kind === "candidate theme");
      const allFlagged = candidates.every(f => f.needsHuman);
      return { pass: !writesThemes && allFlagged,
        why: writesThemes ? "the scout writes to themes.json — it is adopting its own judgment"
           : "a candidate theme is not flagged for a human, so it reads as adopted" };
    } },

  { guard: "Designer catches an undesigned page", detect: null,
    // Build it, break it, repeat: feed it a page with fourteen type sizes and an
    // accent smeared everywhere, and it must object. A design agent that passes
    // that is measuring nothing.
    fn: async () => {
      const { readFile: rf } = await import("node:fs/promises");
      const src = await rf(P("scripts/designer.mjs"), "utf-8");
      const checks = ["distinct font sizes", "accent colour appears", "WCAG", "no generator writes"];
      const missing = checks.filter(c => !src.includes(c));
      return { pass: missing.length === 0,
        why: missing.length ? `the designer no longer checks: ${missing.join(", ")}` : "" };
    } },

  { guard: "Centering math never names a grade", detect: null,
    // Three of PSA's four criteria are invisible in a photograph and the lowest
    // anchors the result. A tool that names a grade is guessing with somebody
    // else's submission fee. It reports the CEILING centering permits, which is
    // a different and defensible claim.
    fn: async () => {
      // pathToFileURL — dynamic import() on Windows rejects a bare "C:\..."
      // with "Received protocol 'c:'", so the test ERRORS instead of running and
      // reports as a failed guard. Third instance of this exact gotcha in this
      // harness; a lint for import(P(...)) would end it permanently.
      const m = await import(pathToFileURL(P("scripts/centering-math.mjs")).href);
      const c = m.ceiling(m.centering({ left: 2, right: 2, top: 2, bottom: 2 }));
      const d = m.worthSubmitting({ raw: 100, graded: { 10: 500 }, centering: c });
      const src = await readFile(P("scripts/centering-math.mjs"), "utf-8");
      // PSA's own worked examples must reproduce exactly, and the worst axis
      // must decide - perfect L/R with 70/30 T/B is not a 10.
      const worked = m.ratio(2.2, 1.8) === 55 && m.ratio(2.4, 1.6) === 60;
      const worstAxis = m.ceiling(m.centering({ left: 2, right: 2, top: 2.8, bottom: 1.2 })).ceiling < 10;
      const disclaims = /neverSays/.test(src) && c.neverSays?.includes("what grade");
      const refuses = m.worthSubmitting({ raw: 100, graded: null, centering: c }).verdict === "cannot say";
      return { pass: worked && worstAxis && disclaims && refuses,
        why: !worked ? "PSA's published worked examples no longer reproduce"
           : !worstAxis ? "the worst axis no longer decides - perfect L/R with 70/30 T/B is passing as a 10"
           : !disclaims ? "the output no longer disclaims naming a grade"
           : "it no longer refuses when graded prices are absent - it is substituting a guess" };
    } },

  { guard: "Heartbeat catches a missed run", detect: null,
    // The alarm was installed, wired, running - and asking a question whose
    // answer could not reveal the fault. It allowed 30 hours so a LATE run
    // would not cry wolf, which let a SKIPPED run hide inside the same window.
    fn: async () => {
      const src = await readFile(P("scripts/heartbeat.mjs"), "utf-8");
      const knowsSchedule = /SCHEDULED_UTC_HOUR/.test(src);
      const checksMissed = /MISSED A SCHEDULED RUN/.test(src);
      const printsNote = /s\.note \?\?/.test(src);
      return { pass: knowsSchedule && checksMissed && printsNote,
        why: !knowsSchedule ? "the heartbeat no longer knows the job's schedule, so it can only measure elapsed time"
           : !checksMissed ? "it no longer checks whether a scheduled fire was missed"
           : "it computes the reason and then prints elapsed hours instead, hiding the fault behind a number that looks fine" };
    } },

  { guard: "Pre-mortem: every guard declares its blind spot", detect: "pre-mortem.mjs",
    // Strip one declaration and the build must fail. A guard nobody has asked
    // "what would you miss" looks identical to one that works - which is what
    // the heartbeat looked like on the morning it reported green through a
    // failed run.
    break: async () => {
      await copyFile(P("data/guard-blindspots.json"), TMP("nt-pm.bak"));
      const d = JSON.parse(await readFile(P("data/guard-blindspots.json"), "utf-8"));
      delete d.guards["heartbeat.mjs"];
      await writeFile(P("data/guard-blindspots.json"), JSON.stringify(d, null, 1));
      return true;
    },
    restore: async () => { await copyFile(TMP("nt-pm.bak"), P("data/guard-blindspots.json")); } },

  { guard: "The tools stay free — no paywall language", detect: null,
    // FREE FOREVER went out on a public page during a traffic spike. This fails
    // if paywall language ever reaches a shipped surface, because the cheapest
    // way to lose an early community is to charge them for the thing they were
    // promised.
    fn: async () => {
      const { readdir } = await import("node:fs/promises");
      const files = (await readdir(P("research/assets"))).filter(f => f.endsWith(".html"));
      const bad = [];
      for (const f of files) {
        const src = await readFile(P("research/assets/" + f), "utf-8").catch(() => "");
        if (/upgrade to pro|start your subscription|per month|paywall|premium plan/i.test(src)) bad.push(f);
      }
      return { pass: bad.length === 0,
        why: bad.length ? "paywall language appeared in: " + bad.join(", ") + " — we promised FREE FOREVER in public on 2026-08-23" : "" };
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

  // The 2026-08-23 class: a request the provider IGNORES but still BILLS.
  // Our catalogue keys sets by pokemontcg.io slug ("ex8"); the provider keys
  // them by internal number (23821). Sending the slug returned five sets we
  // never asked for and cost 9,114 credits. The guard is that enrichment
  // refuses to spend at all when the id map is missing.
  { guard: "Enrichment refuses to spend without a provider set map", detect: null,
    fn: async () => {
      const map = P("data/ppt-set-map.json");
      const bak = TMP("/tmp/nt-setmap.bak");
      let had = true;
      try { await copyFile(map, bak); } catch { had = false; }
      try {
        if (had) await unlink(map);
        // A key must be present or the script exits on the missing-key check
        // instead, which would pass this test for entirely the wrong reason.
        const r = await run("node", [P("scripts/enrich-by-set.mjs")], { cwd: ROOT,
          env: { ...process.env, POKEMONPRICETRACKER_API_KEY: "nt-placeholder" } })
          .then(() => ({ failed: false, out: "" }), e => ({ failed: true, out: (e.stdout || "") + (e.stderr || "") }));
        const refused = r.failed && /resolve-set-ids/.test(r.out);
        return { pass: refused,
          why: r.failed ? "it exited, but not with the set-map instruction — check it is not just the missing-key path"
                        : "enrichment was willing to spend credits with no provider set map" };
      } finally { if (had) await copyFile(bak, map); }
    } },

  // The distiller is what keeps a 166 MB raw payload out of git. If it ever
  // starts passing history straight through, the file it writes stops being
  // committable and the repo takes it permanently.
  { guard: "Distilled enrichment drops the raw daily series", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/distil-enrichment.mjs"), "utf-8");
      if (/history:\s*nm\b/.test(src) || /\.\.\.c\.priceHistory/.test(src))
        return { pass: false, why: "the distiller copies the raw history array through — output will be unbounded" };
      const { distil } = await import(pathToFileURL(P("scripts/distil-enrichment.mjs")).href);
      let out; try { out = await distil(); } catch { return { pass: true, why: "" }; } // no raw file present: nothing to prove
      const bytes = Buffer.byteLength(JSON.stringify(out));
      const perCard = bytes / Math.max(1, out.cardCount);
      // The raw is ~200 KB/card. Anything near that means history leaked in.
      return { pass: perCard < 20000,
        why: `distilled output is ${Math.round(perCard / 1024)} KB per card — the raw series is leaking through` };
    } },

  // The .env loader exists because the PPT key vanished from Windows env vars
  // three sessions running. A local key file is only safe while git cannot see
  // it, and "it's in .gitignore" is a claim until something checks.
  { guard: "Local credentials cannot be committed", detect: null,
    fn: async () => {
      const tracked = await run("git", ["ls-files", ".env", ".env.local", "*.key", "*.pem"], { cwd: ROOT })
        .then(r => r.stdout.trim(), () => "");
      if (tracked) return { pass: false, why: `git is tracking credential files: ${tracked.split("\n").join(", ")}` };
      // And prove the ignore rule actually bites, rather than trusting the file.
      const r = await run("git", ["check-ignore", ".env"], { cwd: ROOT }).then(() => true, () => false);
      return { pass: r, why: ".env is not ignored — a pasted key would be committable" };
    } },

  // A run spent 5,637 credits over 21 sets and lost every card: nothing was
  // written until the end, and the end was a single JSON.stringify of the whole
  // payload — which at 197 KB/card cannot exist above ~2,650 cards, because
  // Node's max string length is 512 MB. The run was unwritable before it began.
  // A provider outage must DEGRADE, not kill. The PPT daily pool ran dry on
  // 2026-08-23, the crosscheck returned 0 live of 137, divergence wrote an EMPTY
  // report over a healthy one, and the schema guard two steps later killed the
  // run naming divergence — the victim, not the cause.
  { guard: "An empty crosscheck cannot wipe The Spread", detect: null,
    fn: async () => {
      const bak = TMP("/tmp/nt-cc.bak"), dbak = TMP("/tmp/nt-div.bak");
      await copyFile(P("data/sealed-crosscheck.json"), bak);
      await copyFile(P("data/divergence-report.json"), dbak);
      try {
        const before = JSON.parse(await readFile(P("data/divergence-report.json"), "utf-8")).rows?.length ?? 0;
        if (!before) return { pass: null, why: "no prior rows to protect" };
        const c = JSON.parse(await readFile(P("data/sealed-crosscheck.json"), "utf-8"));
        for (const k of Object.keys(c)) if (Array.isArray(c[k])) c[k] = [];
        await writeFile(P("data/sealed-crosscheck.json"), JSON.stringify(c, null, 1));
        await run("node", [P("scripts/compute-divergence.mjs")], { cwd: ROOT }).catch(() => {});
        const after = JSON.parse(await readFile(P("data/divergence-report.json"), "utf-8"));
        return { pass: (after.rows?.length ?? 0) === before && after.dataStatus === "stale-upstream",
          why: "an empty crosscheck overwrote The Spread: " + before + " rows became " + (after.rows ? after.rows.length : 0) };
      } finally { await copyFile(bak, P("data/sealed-crosscheck.json")); await copyFile(dbak, P("data/divergence-report.json")); }
    } },

  { guard: "Enrichment flushes each set to disk before the next call", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/enrich-by-set.mjs"), "utf-8");
      // The whole-payload write must be gone.
      if (/JSON\.stringify\(\{[^}]*byCard/s.test(src) || /byCard:\s*out/.test(src))
        return { pass: false, why: "the whole payload is stringified in one go — RangeError above ~2,650 cards, after the credits are spent" };
      if (!/appendFile/.test(src)) return { pass: false, why: "no append path — a 429 or crash loses everything already paid for" };
      // The append must happen INSIDE the per-set loop, not after it.
      const loop = src.slice(src.indexOf("for (const s of todo)"));
      const flush = loop.indexOf("appendCards(");
      const loopEnd = loop.indexOf("\n  }\n");
      if (flush < 0 || (loopEnd > 0 && flush > loopEnd))
        return { pass: false, why: "cards are appended only after the loop — an interrupted run still loses paid-for sets" };
      // ROUND-TRIP A FIXTURE WE BUILD, not whatever happens to be on disk.
      // This used to call distil() against the real raw file — which is GITIGNORED.
      // So it passed on the machine that ran the enrichment and failed on every
      // other one, and it read as permanently red to Tyler while showing green to
      // me. A test whose result depends on which laptop runs it is not a test, and
      // a permanently red one is a muted one, which is the lesson this morning
      // charged us a full day's pipeline for.
      const { mkdtemp, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const dir = await mkdtemp(join(tmpdir(), 'nt-distil-'));
      try {
        const card = { id: 'nt-1', name: 'Fixture', setName: 'Fixture Set', cardNumber: '1',
          prices: { market: 1.23, low: 1, sellers: 2, listings: 3, recentSales: 0, lastUpdated: '2026-08-23', variants: {} },
          priceHistory: { conditions: { 'Near Mint': { history: Array.from({ length: 40 }, (_, i) =>
            ({ date: '2026-0' + (i < 9 ? 7 : 8) + '-01', market: 1 + i / 100, volume: 1 })) } } } };
        await writeFile(join(dir, 'enrichment-raw.ndjson'), JSON.stringify(card));
        const { distilFrom } = await import(pathToFileURL(P('scripts/distil-enrichment.mjs')).href + `?t=${Date.now()}`);
        if (typeof distilFrom !== 'function')
          return { pass: false, why: 'distil-enrichment exports no distilFrom(dir) — the round-trip cannot be tested without the gitignored raw file' };
        const out = await distilFrom(dir).catch(e => ({ error: e.message }));
        return { pass: !!out && out.cardCount === 1 && out.cards?.[0]?.raw?.market === 1.23,
          why: `the distiller cannot read the append-only format back (${out?.error ?? JSON.stringify(out?.cardCount)})` };
      } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
    } },

  // Pacing is priced in minute-UNITS, not calls: a set costs min(30, ceil(n/10))
  // of 60 per minute. The first run paced a flat 1,000ms per call, overran the
  // budget three times over, and took a 429 with 8,865 credits unspent.
  // The watermark IS the free tier, so an unmarked image is a hole in the model
  // rather than a cosmetic slip. It was implemented three times over in the
  // client-side canvas and ONCE in the server-side SVG — and the SVG path is
  // what we serve from our own domain and expect to be reposted. Both paths
  // must carry all three marks, and the credit must never be silently absent.
  { guard: "Composites carry the three-point watermark on BOTH render paths", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/card-composite.mjs"), "utf-8");
      const svgStart = src.indexOf("const svg = `<svg");
      const svgEnd = src.indexOf("</svg>`", svgStart);
      if (svgStart < 0 || svgEnd < 0) return { pass: false, why: "the SVG template moved — cannot verify the watermark" };
      const tpl = src.slice(svgStart, svgEnd);
      const diagonals = (tpl.match(/catchemtcg\.com/g) ?? []).length;
      const footer = /Catch'em<\/text>/.test(tpl);
      if (!footer) return { pass: false, why: "the SVG footer wordmark is gone" };
      if (diagonals < 1) return { pass: false, why: "the SVG path draws no faint diagonal marks — server-rendered images would carry ONE watermark, and those are the ones we host" };
      if (!/fill-opacity="0?\.16"/.test(tpl)) return { pass: false, why: "the diagonal marks are not at 16% — either invisible or loud enough that nobody posts them" };
      // The credit must render something even when the dataset has no artist.
      const editor = await readFile(P("scripts/build-editor.mjs"), "utf-8");
      if (!/illustrator not recorded/i.test(editor))
        return { pass: false, why: "the editor no longer states an absent illustrator — a blank credit line is an uncredited art post" };
      return { pass: true, why: "" };
    } },

  // The editor shipped DEAD and nothing noticed. A generator emitting an inline
  // script had an escaped quote resolve to a bare one, which terminated a JS
  // string mid-attribute; the whole script failed to parse, so INDEX, add() and
  // search() were undefined and the page did nothing. Every check we own passed:
  // the file existed, it was the right size, the HTML was well-formed. Nothing
  // asked whether the JavaScript inside it could run.
  { guard: "Generated pages emit JavaScript that actually parses", detect: null,
    fn: async () => {
      const pages = ["research/assets/build.html", "research/assets/creators.html", "research/assets/faq.html"];
      for (const p of pages) {
        const html = await readFile(P(p), "utf-8").catch(() => null);
        if (!html) continue;                       // not built in this checkout
        for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
          if (!body.trim()) continue;
          try { new Function(body); }
          catch (e) { return { pass: false, why: `${p} emits a script that does not parse: ${e.message}` }; }
        }
      }
      return { pass: true, why: "" };
    } },

  // "The loudest possible version of the mistake" (Tyler, 2026-08-23): telling
  // a reader a specialty set has a booster box. 151, Prismatic Evolutions,
  // Crown Zenith, Champion's Path, Shining Fates, Celebrations, Paldean Fates,
  // Shrouded Fable and Ascended Heroes were never sold as sealed booster boxes.
  { guard: "A specialty set can never claim a booster box", detect: "schema-guard.mjs",
    break: async () => {
      await copyFile(P("data/sealed-products.json"), TMP("/tmp/nt-sealed-box.bak"));
      const sp = JSON.parse(await readFile(P("data/sealed-products.json"), "utf-8"));
      const classes = JSON.parse(await readFile(P("data/set-classes.json"), "utf-8")).classes ?? {};
      const specialty = Object.entries(classes).find(([, v]) => v === "specialty")?.[0];
      if (!specialty) return false;
      const rows = sp.products ?? sp;
      rows.push({ id: "nt-fake-box", setId: specialty, subtype: "booster-box",
        name: "Deliberately impossible booster box" });
      await writeFile(P("data/sealed-products.json"), JSON.stringify(sp, null, 1));
      return true;
    },
    restore: async () => { await copyFile(TMP("/tmp/nt-sealed-box.bak"), P("data/sealed-products.json")); } },

  { guard: "Enrichment paces by minute units, not a flat delay", detect: null,
    fn: async () => {
      const src = await readFile(P("scripts/enrich-by-set.mjs"), "utf-8");
      if (/PACE_MS/.test(src)) return { pass: false, why: "the flat PACE_MS delay is back" };
      if (!/unitsFor|MINUTE_UNITS/.test(src)) return { pass: false, why: "no minute-unit accounting found" };
      const i = src.indexOf("const unitsFor");
      const unitsFor = eval(`(() => { ${src.slice(i, src.indexOf("\n", i))}; return unitsFor; })()`);
      const ok = unitsFor(12) === 2 && unitsFor(28) === 3 && unitsFor(500) === 30 && unitsFor(1000) === 30;
      return { pass: ok, why: `unitsFor is mispriced: 12→${unitsFor(12)} (want 2), 500→${unitsFor(500)} (want 30)` };
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
