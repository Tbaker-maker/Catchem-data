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
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000,
      messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) { console.error(`API ${res.status}: ${(await res.text()).slice(0,300)}`); process.exit(1); }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const out = join(ROOT, "research", "drafts", `${today}-${TYPE}.md`);
  await writeFile(out, text + "\n");
  console.log(`✓ DRAFT written: research/drafts/${today}-${TYPE}.md — human review required before any send`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
