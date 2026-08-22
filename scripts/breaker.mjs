// breaker.mjs — BUILD IT. BREAK IT. REPEAT.
//
// Every guard we own exists because something already broke. That is reactive
// by construction: we are always one incident behind. This agent tries to get
// ahead of the next one by asking a question no existing test asks —
// "what is NOT covered?" — and proposing the attack that would prove it.
//
// It does not re-run known tests; audit.mjs does that. It looks for the SHAPE
// of an untested assumption: a guard with no negative test, a data file nothing
// validates, a code path only one caller exercises, an external dependency with
// no failure simulation, a number published from a source nothing cross-checks.
//
// It proposes; it never executes. An agent that breaks production to prove a
// point has understood the motto backwards.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return null; } };

const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const sources = {};
for (const f of files) sources[f] = await R(`scripts/${f}`) ?? "";
const registry = await R("research/SAFEGUARD-REGISTRY.md") ?? "";
const auditSrc = (sources["audit.mjs"] ?? "") + (sources["negative-tests.mjs"] ?? "");

const schemaTargets = new Set(Object.keys((await J("data/schemas.json"))?.files ?? {}));
const hypotheses = [];
const H = (target, attack, why, severity) => hypotheses.push({ target, attack, why, severity });

// 1 — A GUARD WITH NO NEGATIVE TEST. Our own law says a guard is not real until
// breaking it fails the build. Anything in the registry that the audit never
// deliberately breaks is a guard we are trusting on faith.
{
  const rows = registry.split("\n").filter(l => /^\| \d+ \|/.test(l));
  for (const row of rows) {
    const cells = row.split("|").map(c => c.trim());
    const name = cells[2], test = cells[5] || "";
    if (!name) continue;
    const key = name.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 4)[0];
    const exercised = key && auditSrc.toLowerCase().includes(key);
    if (!exercised && test && !/simulat|delete|remove|corrupt|break|re-?set|crash/i.test(test))
      H(name, `Break it deliberately and confirm the build fails. The registry names a test but audit.mjs never runs it, so nothing checks that this guard still works.`,
        "Our own law: a guard is not real until breaking it fails the build. An unexercised guard is a comfort, not a control.", "high");
  }
}

// 2 — A DATA FILE NOTHING VALIDATES. Files consumed by many scripts but shaped
// by none are where a silent format change does the most damage.
{
  const dataFiles = (await readdir(join(ROOT, "data"))).filter(f => f.endsWith(".json"));
  for (const df of dataFiles) {
    const readers = files.filter(f => sources[f].includes(`data/${df}`));
    // A file can be validated by NAME in a guard, or by REGISTRY — schema-guard
    // reads its targets from data/schemas.json rather than mentioning each path.
    // A detector that keeps reporting solved problems trains people to ignore it,
    // which is worse than not having one.
    const inSchemas = schemaTargets.has(`data/${df}`);
    const validated = inSchemas || files.some(f => /guard|assert|audit|lint/.test(f) && sources[f].includes(`data/${df}`));
    if (readers.length >= 2 && !validated)
      H(`data/${df}`, `Corrupt it — empty object, missing top-level key, wrong types — and see which of its ${readers.length} readers notices. Then decide which of them SHOULD have.`,
        `Read by ${readers.length} scripts and validated by none. A silent shape change here propagates everywhere before anything complains.`, "high");
  }
}

// 3 — AN EXTERNAL DEPENDENCY WITH NO FAILURE SIMULATION.
{
  const hosts = new Set();
  for (const f of files) for (const m of sources[f].matchAll(/https:\/\/([a-z0-9.\-]+)/gi)) hosts.add(m[1]);
  const simulated = /outage|stale|partial|unavailable|simulat/i.test(auditSrc);
  for (const h of [...hosts].filter(h => !/github|githubusercontent|fonts\./.test(h))) {
    const users = files.filter(f => sources[f].includes(h));
    if (!simulated || users.length > 1)
      H(h, `Simulate this host being down, slow, and returning a 200 with garbage. The third case is the dangerous one — everything we own handles a failure better than it handles a plausible-looking wrong answer.`,
        `${users.length} script(s) depend on it. We have tested absence of DATA but not absence of THIS SOURCE specifically.`, "medium");
  }
}

// 4 — A PUBLISHED NUMBER WITH NO SECOND OPINION. Anything we print that only
// one source can confirm is a single point of failure wearing a chip.
{
  const der = await J("data/derived-insights.json") ?? {};
  const single = [];
  if (der.sealedIndex) single.push("the sealed index (our own measurement only — nothing external corroborates the level)");
  if (der.packPricing?.switched) single.push("pack prices (TCGplayer via one provider, no second source)");
  if (der.dealZone) single.push("the deal zone (built on published fee schedules that change without notice)");
  for (const s of single)
    H(s, `Find one independent way to sanity-check this number, even a crude one. If none exists, say so on the methodology page rather than letting a reader assume corroboration we do not have.`,
      "A figure only one source can confirm is a single point of failure wearing a VERIFIED chip.", "medium");
}

// 5 — THE ASSUMPTION NOBODY HAS WRITTEN DOWN. Time is the classic one: every
// date comparison here assumes UTC days and a well-behaved clock.
{
  const dateMath = files.filter(f => /toISOString\(\)\.slice\(0, ?10\)/.test(sources[f]));
  if (dateMath.length >= 3)
    H("date handling across the pipeline", `Run the pipeline with the clock set to 23:59 UTC on the last day of a month, and again at 00:01 on the first. Confirm nothing double-counts, skips a day, or writes two entries for one date.`,
      `${dateMath.length} scripts slice UTC dates into day keys. Month and year boundaries are where that quietly goes wrong, and no test covers it.`, "medium");
}

const bySeverity = { high: 0, medium: 0, low: 0 };
for (const h of hypotheses) bySeverity[h.severity]++;
const report = { generatedAt: new Date().toISOString(),
  motto: "Build it. Break it. Repeat.",
  method: "Looks for the SHAPE of an untested assumption rather than re-running known tests. Proposes attacks; never executes them.",
  counts: bySeverity, hypotheses: hypotheses.slice(0, 40) };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/breaker-report.json"), JSON.stringify(report, null, 1));

const VOICE = ["Went looking for what we have not tested yet. Found a few doors nobody has tried.",
  "Here is what would break us today, in the order I would try it.",
  "We test the things we already got wrong. This is a list of the ones we have not."];
console.log(`\n  ${VOICE[new Date().getUTCDate() % VOICE.length]}\n`);
console.log(`✓ breaker: ${hypotheses.length} untested assumption(s) — ${bySeverity.high} high, ${bySeverity.medium} medium`);
for (const h of hypotheses.filter(x => x.severity === "high").slice(0, 6)) console.log(`  HIGH   ${String(h.target).slice(0, 40).padEnd(40)} ${h.why.slice(0, 70)}`);
for (const h of hypotheses.filter(x => x.severity === "medium").slice(0, 3)) console.log(`  MED    ${String(h.target).slice(0, 40).padEnd(40)} ${h.why.slice(0, 70)}`);
