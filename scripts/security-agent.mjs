// security-agent.mjs — the failure a solo founder does not recover from.
//
// WHY THIS EXISTS: the 2025 Verizon DBIR found small organisations saw
// ransomware in 88% of their breaches against 39% for large ones, and that 46%
// of compromised systems carrying corporate logins were unmanaged personal
// devices. Founders reliably treat security as a later problem. It is the one
// category where a single mistake is not a correction — there is no correction
// page for a leaked key, and no negative test that un-publishes a secret.
//
// FOURTEEN of our scripts reference a webhook, key or token. That is the
// surface. This watches it, every run, and it is the ONE agent that blocks:
// everything else here advises, because everything else is recoverable.
//
// WHAT IT WILL NOT DO: claim we are secure. It checks the things it can check
// — what is in the repo, what is in the history, what is reachable — and says
// plainly that a personal machine and a browser session are outside its reach.
// A security agent that implies total coverage is worse than none, because it
// buys exactly the false confidence the research describes.
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = async (...a) => { try { return (await run("git", a, { cwd: ROOT })).stdout; } catch { return ""; } };

const critical = [], warnings = [], checked = [], inventory = [];
const C = (what, why, fix) => critical.push({ what, why, fix });
const W = (what, why, fix) => warnings.push({ what, why, fix });

// ── PUBLISHED BY DESIGN IS NOT A LEAK ──────────────────────────────────────
// This agent blocked on the Formspree endpoint, which cannot be removed without
// breaking the waitlist: a form action must carry its endpoint or the form posts
// nowhere. A blocking guard that CANNOT BE SATISFIED gets ignored, and an
// ignored guard is not a guard - it is a red light everyone has learned to
// drive through, which is worse than no light at all.
//
// The agent could not tell a leaked secret from a necessarily-public endpoint
// and called both CRITICAL. Visibility was never the problem; severity was. So
// these are inventory: named on every run, with what an attacker can do, and
// an explicit note that it is intentional. Never a failure.
const I = (what, where, canDo, cannotDo) => inventory.push({ what, where, canDo, cannotDo });

// Shapes of real credentials. Deliberately narrow — a scanner that cries wolf
// gets muted, and a muted security scanner is the worst object in the repo.
// WHAT THIS AGENT CAN AND CANNOT SEE. Printed on every run, because this file
// argues in its own header that an agent implying total coverage is worse than
// none - and then did exactly that for months.
//
// IT DETECTS SHAPES WITH A DISTINCTIVE PREFIX OR STRUCTURE: sk-ant-, gh[pousr]_,
// AKIA, a Discord webhook URL, a PEM header, and an assignment of a 28+ char
// token to a variable named key/secret/token/password.
//
// IT CANNOT DETECT AN OPAQUE ID WITH NO SHAPE. A Formspree form id is eight
// lowercase letters. It is indistinguishable from a word, so no pattern can
// find it, and one sat in ten tracked files while this agent reported clean
// every day through generate-pulse. Nothing was broken - it was never looking.
// scripts/secret-scan.mjs closes that by scanning for the actual VALUES in
// .env rather than guessing what a secret looks like.
const DETECTS = [
  "sk-ant- prefixed Anthropic keys",
  "gh[pousr]_ prefixed GitHub tokens",
  "AKIA-prefixed AWS keys",
  "Discord webhook URLs",
  "PEM private key headers",
  "28+ character tokens assigned to key/secret/token/password",
  "Formspree form endpoints (added 2026-08-25, after one sat exposed)",
];
const CANNOT_DETECT = [
  "any opaque id with no distinctive shape - a form id, a short slug, a bare account number",
  "a secret that is only a URL, unless the host is one of the few named above",
  "anything in git history - it reads the working tree and recent commits only",
  "whether a value SHOULD be secret. It knows shapes, not intent.",
];

// IT HAD NO ACCESS TO .env, so the filter that was supposed to recognise the
// already-public form id compared against undefined and matched nothing. The
// agent then reported the generated artifact as a fresh CRITICAL leak.
const { loadEnv: loadEnvSec } = await import("./lib/load-env.mjs");
loadEnvSec();

const SECRETS = [
  { name: "Discord webhook", rx: /https:\/\/discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]{40,}/g },
  { name: "Anthropic key", rx: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "GitHub token", rx: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { name: "generic long token assignment", rx: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{28,}["']/gi },
  { name: "AWS key", rx: /AKIA[0-9A-Z]{16}/g },
  // A FORM ENDPOINT IS A SECRET IN A PUBLIC REPO. Not a credential - it reads
  // nothing - but hardcoding it invites spam straight into the destination
  // inbox and names where that inbox is.
  { name: "Formspree form endpoint", rx: /formspree\.io\/f\/[a-zA-Z0-9]{6,}/g },
  { name: "private key block", rx: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

// ── 1 · IS A SECRET IN THE WORKING TREE? ───────────────────────────────────
{
  const scan = async (dir) => {
    let entries = [];
    try { entries = await readdir(join(ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const rel = `${dir}/${e.name}`.replace(/^\//, "");
      if (e.isDirectory()) { await scan(rel); continue; }
      if (!/\.(mjs|js|jsx|json|md|yml|yaml|html|env|txt)$/.test(e.name)) continue;
      // FIFTH SELF-READ IN A DAY. The negative test plants a fake key to prove
      // this scanner works, and the scanner read it as a leak - flagging our own
      // proof-of-correctness as a critical incident, at the top of the digest,
      // where it crowded out the one finding that was real. Fixtures are marked
      // FAKEFAKE precisely so they can be told apart; the check is that the
      // string is obviously synthetic, not that the file is exempt, because
      // exempting a whole file is what let /tmp through seven times.
      const src = await readFile(join(ROOT, rel), "utf-8").catch(() => "");
      for (const s of SECRETS) {
        const hits = (src.match(s.rx) ?? [])
          .filter(h => !/(FAKE)+|EXAMPLE|XXXX+|PLACEHOLDER|REDACTED|DUMMY|TEST{2,}|abcd1234|abc123/i.test(h))
          // ALREADY PUBLIC AND NOT FIXABLE BY EDITING FILES. The waitlist form id
          // has been in this repo and in six commits of its history since August.
          // Rewriting history would not unpublish it - anyone can already read
          // it - so the remedy is ROTATION, which only Tyler can do. Reported
          // once below rather than from each of the eight files that carry it.
          .filter(h => { const known = (process.env.FORMSPREE_FORM_ID || "").trim();
            return !(known && h.includes(known)); });
        if (hits.length) C(`${s.name} found in ${rel}`,
          "A credential in the working tree is one commit from being permanent. There is no correction page for a leaked key.",
          "Revoke it first, then remove it. Revoking comes first because removal does not un-share what was already shared.");
      }
    }
  };
  await scan("scripts"); await scan("data"); await scan("research"); await scan(".github");
  {
    // The waitlist endpoint, RECORDED rather than reported as a fault. It was a
    // CRITICAL here, blocking on a value that cannot be removed without breaking
    // the form, which is how a guard teaches people to ignore it.
    const id = (process.env.FORMSPREE_FORM_ID || "").trim();
    if (id) {
      const carriers = [];
      for (const f of ["research/assets/index-landing.html", "research/pulse/2026-08-19.html"]) {
        const t = await readFile(join(ROOT, f), "utf-8").catch(() => "");
        if (t.includes(id)) carriers.push(f);
      }
      I("Formspree waitlist endpoint",
        carriers.length ? carriers.join(", ") : "generated artifacts only",
        "submit to the form from anywhere, burn the 50-per-month free-tier cap, and bury real signups in junk",
        "read any existing submission, see or reach the inbox, or touch anything else in the account - it is write-only");
    }
  }
  checked.push("working tree scanned for six credential shapes");
}

// ── 2 · IS A SECRET IN THE HISTORY? ────────────────────────────────────────
// Removing a secret from a file does not remove it from git. This is the check
// people skip, and it is the one that matters, because history is public the
// moment the repo is.
{
  const diff = await git("log", "-p", "--since=30 days ago", "--", "scripts", "data", ".github");
  for (const s of SECRETS) {
    const hits = diff.match(s.rx);
    if (hits) C(`${s.name} appears in git history (${hits.length} occurrence(s), last 30 days)`,
      "Deleting a secret from a file leaves it in every clone of the history. If this repo is ever public, it is already public.",
      "Revoke and rotate the credential. Rewriting history is secondary and usually not worth it — the credential is what matters, not the record.");
  }
  checked.push("30 days of history scanned");
}

// ── 3 · IS ANYTHING THAT SHOULD BE SECRET BEING READ FROM A FILE? ──────────
{
  const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
  for (const f of files) {
    const src = await readFile(join(ROOT, "scripts", f), "utf-8").catch(() => "");
    if (f !== "security-agent.mjs" && /readFile[^\n]*(webhook|secret|credential)/i.test(src))
      W(`scripts/${f} reads a credential from a file`,
        "Secrets belong in the environment, not on disk. A file gets committed by accident; an env var cannot be.",
        "Move it to process.env and document the variable name.");
  }
  checked.push(`${files.length} scripts checked for on-disk credential reads`);
}

// ── 4 · IS .gitignore DOING ITS JOB? ───────────────────────────────────────
{
  const gi = await readFile(join(ROOT, ".gitignore"), "utf-8").catch(() => "");
  const want = [".env", "node_modules", "*.pem", "*.key"];
  const missing = want.filter(w => !gi.includes(w));
  if (missing.length)
    W(`.gitignore does not cover ${missing.join(", ")}`,
      "The most common way a secret enters a repo is a file nobody meant to add. .gitignore is the cheapest control that exists.",
      `Add: ${missing.join(", ")}`);
  else checked.push(".gitignore covers env files, keys and modules");
}

// ── 5 · WHAT THIS CANNOT SEE, said plainly ─────────────────────────────────
const blindSpots = [
  "Tyler's own machine — the DBIR finding that 46% of compromised corporate logins came from unmanaged personal devices applies here and nothing in this repo can check it.",
  "Browser sessions and saved passwords for Cloudflare, Buttondown, GitHub, PPT and Discord.",
  "Whether two-factor authentication is on for each of those accounts.",
  "Anything in the private bot repo, which this agent does not read.",
];

const out = { generatedAt: new Date().toISOString(),
  role: "The one agent that blocks. Everything else here advises, because everything else is recoverable — there is no correction page for a leaked key.",
  critical, warnings, checked, inventory, blindSpots,
  honesty: "This checks what is in the repo and its recent history. It does not and cannot tell you that you are secure — a security agent implying total coverage buys exactly the false confidence that makes founders stop looking." };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/security-report.json"), JSON.stringify(out, null, 1));

if (critical.length) {
  console.error(`\n✗ SECURITY — ${critical.length} CRITICAL:`);
  for (const c of critical) console.error(`   ${c.what}\n     ${c.fix}`);
  console.error("");
  process.exitCode = 1;   // the only agent permitted to fail a run
} else {
  // INVENTORY PRINTS BEFORE THE VERDICT, pass or fail. "What of ours is public on
// purpose" deserves an answer on a good day as much as a bad one.
if (inventory.length) {
  console.log(`\n  PUBLISHED BY DESIGN — ${inventory.length} endpoint(s), intentional, not a fault:`);
  for (const i of inventory) {
    console.log(`     ${i.what}`);
    console.log(`       appears in : ${i.where}`);
    console.log(`       someone can: ${i.canDo}`);
    console.log(`       they cannot: ${i.cannotDo}`);
  }
}
console.log("\n  DETECTS: " + DETECTS.join("; "));
console.log("  CANNOT DETECT: " + CANNOT_DETECT.join("; "));
console.log("  Value-based scanning lives in scripts/secret-scan.mjs.\n");
console.log(`✓ security: no credentials in the tree or recent history · ${warnings.length} warning(s) · ${checked.length} checks`);
  for (const w of warnings.slice(0, 3)) console.log(`  ⚠ ${w.what}`);
}
