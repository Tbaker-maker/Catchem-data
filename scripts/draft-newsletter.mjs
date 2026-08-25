// scripts/draft-newsletter.mjs
// Catch'Em News draft generator. Assembles heat-report + research digests +
// release radar + voice guide + trust standard into a drafting prompt,
// calls Claude API, writes a DRAFT for human review.
//
// HUMAN GATE IS MANDATORY: this script writes drafts to research/drafts/.
// Nothing here sends, posts, or publishes. Ever.
//
// Usage:
//   node scripts/draft-newsletter.mjs --type warm            (or cold)
//   node scripts/draft-newsletter.mjs --type warm --dry-run  (assemble prompt only, no API call)

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { callClaude } from "./lib/claude.mjs";

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this script until the CI runner kills the job.
// A hung job is worse than a failed one — nothing goes red, the whole
// allowance burns and no guard reports. Every call below is bounded.
const FETCH_TIMEOUT_MS = 120000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const typeIdx = args.indexOf("--type");
let TYPE = typeIdx >= 0 ? args[typeIdx + 1] : null;
if (!TYPE) { const d = new Date().getUTCDay(); TYPE = d >= 4 ? "cold" : "warm"; } // Fri+ = cold
if (!["warm", "cold"].includes(TYPE)) { console.error("--type must be warm|cold"); process.exit(1); }

const today = new Date().toISOString().split("T")[0];

async function latestDigests(n = 3) {
  try {
    const dir = join(ROOT, "research", "digests");
    const files = (await readdir(dir)).filter(f => f.endsWith(".md")).sort().slice(-n);
    const out = [];
    for (const f of files) out.push(`--- DIGEST ${f} ---\n` + await readFile(join(dir, f), "utf-8"));
    return out.join("\n\n");
  } catch { return "(no digests available)"; }
}

async function main() {
  const [voice, trust, heat, radar, digests] = await Promise.all([
    readFile(join(ROOT, "research", "NEWSLETTER-VOICE.md"), "utf-8"),
    readFile(join(ROOT, "TRUST-STANDARD.md"), "utf-8"),
    readFile(join(ROOT, "data", "heat-report.json"), "utf-8"),
    readFile(join(ROOT, "data", "release-radar.json"), "utf-8"),
    latestDigests(),
  ]);

  const prompt = `${voice}

=== TRUST STANDARD (binding) ===
${trust}

=== HEAT REPORT (data/heat-report.json) ===
${heat}

=== RELEASE RADAR ===
${radar}

=== RECENT RESEARCH DIGESTS ===
${digests}

Today's date: ${today}. Draft the ${TYPE.toUpperCase()} issue now, per the
structure and output format in the guide. Remember: reads only from the
heat report's "reads" array; quarantined SKUs do not exist to you; unknown
= [EDITOR: ...] marker; this is a draft for human review.`;

  await mkdir(join(ROOT, "research", "drafts"), { recursive: true });

  if (DRY) {
    const p = join(ROOT, "research", "drafts", `${today}-${TYPE}.PROMPT.txt`);
    await writeFile(p, prompt);
    console.log(`✓ dry-run: prompt assembled (${prompt.length.toLocaleString()} chars) → ${p}`);
    return;
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }
  // Through lib/claude.mjs, which refuses a truncated answer. This call used
  // 4000 tokens with no stop_reason check — the same omission that left the
  // release radar frozen for eight days while every run reported success. A
  // newsletter cut off mid-sentence is worse than no newsletter: it looks
  // finished.
  let text;
  try {
    ({ text } = await callClaude({ apiKey: API_KEY, maxTokens: 12000,
      messages: [{ role: "user", content: prompt }], label: "draft-newsletter" }));
  } catch (e) {
    console.error("✗ " + e.message);
    if (e.name === "TruncatedError") console.error("  Nothing was written. The draft would have been incomplete.");
    process.exit(1);
  }
  const out = join(ROOT, "research", "drafts", `${today}-${TYPE}.md`);
  await writeFile(out, text + "\n");
  console.log(`✓ DRAFT written: research/drafts/${today}-${TYPE}.md — human review required before any send`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
