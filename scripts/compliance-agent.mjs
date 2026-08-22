// compliance-agent.mjs — watching the trip-wires on things we chose to defer.
//
// 18% of startups fail on legal challenges, and almost never because somebody
// decided to ignore a rule. They fail because a deferral was never revisited.
// Deferring is legitimate and often correct — a pre-revenue tool should not
// spend on an attorney it does not need yet. But a deferral nobody re-examines
// is just forgetting with extra steps.
//
// So every deferred obligation carries a TRIGGER: the specific, checkable
// condition that ends the deferral. This watches those triggers against what is
// actually happening in the repo, and says so the moment one trips.
//
// IT IS NOT LEGAL ADVICE AND SAYS SO. It watches trip-wires. When one trips the
// answer is always the same — talk to a person who does this for a living —
// and the agent's entire job is making sure that conversation happens BEFORE
// the thing it was about, rather than after.
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const git = async (...a) => { try { return (await run("git", a, { cwd: ROOT })).stdout; } catch { return ""; } };

const reg = await J("data/compliance-register.json");
if (!reg) { console.log("· compliance: no register"); process.exitCode = 0; }

// ── EVIDENCE: what is actually true in the repo right now? ─────────────────
// Each signal is deliberately conservative. A false trip sends Tyler to an
// attorney he does not need, which teaches him to ignore the next one.
const app = await R("../catchem-app/src/Ticker.jsx");
const scripts = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const allSrc = (await Promise.all(scripts.filter(f => f !== "compliance-agent.mjs").map(f => R(`scripts/${f}`)))).join("\n");
const flags = (await J("data/flags.json"))?.flags ?? {};
const prizes = await J("data/prizes-ledger.json");
const recentCommits = await git("log", "--since=14 days ago", "--format=%s");

const signals = {
  // Shapes that cannot appear innocently. Bare words like "checkout" match
  // `git checkout`; these do not match anything but real payment machinery.
  revenue: /stripe\.(com|js)|["'`]price_[A-Za-z0-9]{8,}|createCheckoutSession|paddle\.com|lemonsqueezy|@stripe\//i.test(app + allSrc),
  auth: /signInWith|createUserWith|@supabase\/|firebase\/auth|next-auth|session\.user/i.test(app),
  personalData: /email.*collect|store.*email|user.*record|profile/i.test(app) && /localStorage/.test(app) === false,
  liveDraw: Boolean((prizes?.lots ?? prizes?.entries ?? []).some?.(l => /drawn|shipped|cashed/i.test(JSON.stringify(l)))),
  nameSpend: /\b(merch order|print run|paid ads?|trademark (application|filing)|incorporat(ed|ion))\b/i.test(recentCommits),
  pptPublic: flags["ppt.publicDisplay"]?.value === true,
};

const tripped = [], watching = [];
for (const item of reg.items ?? []) {
  const hits = [];
  // Map each register item to the signals that would end its deferral.
  if (item.id === "pokemon-ip-depiction" && signals.revenue) hits.push("revenue machinery appeared in the code");
  if (item.id === "sweepstakes-structure" && signals.liveDraw) hits.push("a draw has been recorded as run");
  if (item.id === "ppt-commercial-licence" && signals.revenue && signals.pptPublic) hits.push("revenue machinery exists while PPT figures are published");
  if (item.id === "name-clearance" && signals.nameSpend) hits.push("recent work mentions spend coupled to the name");
  if (item.id === "user-data-handling" && (signals.auth || signals.personalData)) hits.push("authentication or personal-data handling appeared");

  if (hits.length) tripped.push({ ...item, firedBy: hits });
  else watching.push({ id: item.id, severity: item.severity, trigger: item.trigger, status: item.status });
}

// A register nobody re-reads is the failure mode this exists to prevent, so the
// register itself gets a staleness check.
const lastTouched = (await git("log", "-1", "--format=%ad", "--date=short", "--", "data/compliance-register.json")).trim();
const ageDays = lastTouched ? Math.round((Date.now() - Date.parse(lastTouched)) / 86400000) : 0;
const stale = ageDays >= 60;

const out = { generatedAt: new Date().toISOString(),
  disclaimer: "Not legal advice. This watches trip-wires we set ourselves. When one trips the answer is always to talk to somebody who does this for a living — the point is that the conversation happens BEFORE the thing it was about.",
  signals, tripped, watching, registerAgeDays: ageDays, stale,
  chip: "READ" };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/compliance-report.json"), JSON.stringify(out, null, 1));

if (tripped.length) {
  console.error(`\n⚖ COMPLIANCE — ${tripped.length} trigger(s) have fired:\n`);
  for (const t of tripped) console.error(`   [${t.severity}] ${t.obligation}\n     fired by: ${t.firedBy.join("; ")}\n     ${t.note}\n`);
  console.error("   These were deferred deliberately. The condition we said would end the deferral has happened.\n");
} else {
  console.log(`✓ compliance: ${watching.length} obligation(s) deferred, no trigger fired${stale ? ` · register unreviewed for ${ageDays} days` : ""}`);
  for (const w of watching.filter(w => w.severity === "existential" || w.severity === "high"))
    console.log(`  watching [${w.severity}] ${w.id}`);
}
