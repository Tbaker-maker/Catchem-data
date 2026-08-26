// ── RESPONSE AUDIT — BLOCKING ──────────────────────────────────────────────
// Three times in one day a green run asserted something the artifact did not
// contain. The research agent slipped past both the log guard and the secret
// guard because the failure was UPSTREAM of anything they read: the Anthropic
// API reported stop_reason "max_tokens" on eight consecutive runs and the
// script dropped the field on the floor.
//
// THE RULE THIS ENFORCES: any external call whose response carries a signal
// about its own completeness must have that signal CHECKED — acted on, or
// explicitly declared ignored with a reason. Silently discarding a field the
// provider went to the trouble of sending is how all three survived.
//
// Completeness signals are not just HTTP status. They are:
//
//   HTTP          res.ok / res.status          did the call succeed at all
//   Anthropic     stop_reason                  was the answer cut off
//   pokemontcg.io totalCount vs page/pageSize  is there a page 2 we never read
//   eBay Browse   total vs limit               same, under a different name
//   X API         errors[] beside a 200        partial success reported as OK
//
// The pagination cases are the same bug as the truncated radar wearing a
// different hat: the provider says "there are 900 of these and I gave you 250"
// and the code writes 250 to a file whose name implies all of them.
//
// A call may legitimately ignore a signal. It may not do so silently: put
// RESPONSE-AUDIT-OK on or near the line, with the reason, and this passes.
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

// How far after a fetch( we look for the check. A multi-line options object
// pushes the status guard well down the file — daily-research puts it 18 lines
// later — and too tight a window produces false alarms, which is how a guard
// stops being read. 30 is past every real call site in this repo.
const WINDOW = 30;

// SOME FILES TALK ABOUT fetch RATHER THAN CALLING IT. guard-audit.mjs and
// negative-tests.mjs exist to police unbounded fetches and both quote the word;
// counting their mentions made this audit's first run look broken, which is
// precisely how a new guard loses its audience before it has earned one.
const isRealCall = (line) => {
  const stripped = line
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/`[^`]*`/g, "``");
  return /(?:await|=|return|\()\s*fetch\s*\(/.test(stripped);
};

const HOST_RULES = [
  { host: "api.anthropic.com", signal: "stop_reason",
    rx: /stop_reason/, why: "an answer cut off at max_tokens is not an answer" },
  { host: "api.pokemontcg.io", signal: "totalCount",
    rx: /totalCount|total_count/, why: "page 1 of N can be written as if it were all of them" },
  { host: "api.ebay.com", signal: "total",
    rx: /\.total\b|\btotal\s*[>=<]/, why: "the result set is larger than the page we read" },
  { host: "api.twitter.com", signal: "errors[]",
    rx: /\.errors\b|errors\s*&&|\berrors\b/, why: "X returns 200 with an errors array for partial failure" },
];

const files = (await readdir(SCRIPTS, { recursive: true }))
  .filter(f => f.endsWith(".mjs") && !f.endsWith("response-audit.mjs"));

const findings = [];
let callSites = 0, declared = 0;

for (const rel of files) {
  const src = await readFile(join(SCRIPTS, rel), "utf-8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!/\bfetch\s*\(/.test(line)) return;
    if (t.startsWith("//") || t.startsWith("*")) return;
    if (!isRealCall(line)) return;
    callSites++;

    const window = lines.slice(i, i + WINDOW).join("\n");
    const near = lines.slice(Math.max(0, i - 5), i + WINDOW).join("\n");

    if (/RESPONSE-AUDIT-OK/.test(near)) { declared++; return; }

    // 1. HTTP status — every call, no exceptions. A try/catch alone does not
    // count: fetch resolves happily on a 404 and only rejects on a transport
    // error, so catch-only code turns an error page into data.
    const checksStatus = /\bres(ponse)?\w*\.(ok|status)\b|\.ok\b|\bstatus\s*[!=]==?|\bstatus\s*[><]/.test(window);
    if (!checksStatus) {
      findings.push({ file: rel, line: i + 1, signal: "HTTP status",
        code: t.slice(0, 88),
        why: "fetch resolves on a 404 — without res.ok an error page becomes data" });
    }

    // 2. Provider-specific completeness signals, only where this call is the
    // one talking to that host.
    for (const rule of HOST_RULES) {
      if (!window.includes(rule.host)) continue;
      if (rule.rx.test(src)) continue;      // read somewhere in the same file
      findings.push({ file: rel, line: i + 1, signal: rule.signal,
        code: t.slice(0, 88), why: rule.why });
    }
  });
}

console.log("RESPONSE AUDIT — does each call read what the provider told it?\n");
console.log(`  ${callSites} real fetch call sites · ${declared} with a declared waiver\n`);

// A guard that scans nothing reports green forever.
if (!callSites) {
  console.log("  ✗ no call sites found — this guard would pass vacuously");
  process.exit(1);
}

for (const f of findings) {
  console.log(`  ✗ ${f.file}:${f.line}  [${f.signal}]`);
  console.log(`      ${f.code}`);
  console.log(`      ${f.why}`);
}

console.log("");
if (findings.length) {
  console.log(`RESPONSE AUDIT FAILED — ${findings.length} call(s) discard a signal the provider sent.`);
  console.log("Either act on the signal, or write RESPONSE-AUDIT-OK with the reason it is safe");
  console.log("to ignore. Silence is the one option this guard removes.");
  process.exit(1);
}
// A ✓ MARK, BECAUSE THAT IS WHAT THE FLEET READS. fleet.mjs extracts an
// agent's verdict from the last ✓/✗ line in its output, and a guard printing
// only "PASSED" produced NO mark at all — so the fleet reported it as CRASHED,
// which is its label for an agent that emitted nothing. A passing guard was
// showing up in the blocking-failure list. Following the house convention is
// not cosmetic when another tool parses your output.
console.log(`✓ response audit: ${callSites} call sites, every completeness signal read or waived`);
