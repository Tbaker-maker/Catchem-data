// scripts/generate-content.mjs
// Catch'em Content Hub — generates a daily content pack (X posts, thread,
// short-form scripts, YouTube concept) from the same data spine as the
// newsletter: heat report + digests + radar, bound by the Trust Standard.
// DRAFTS ONLY → research/content/. Human selects and posts. Never auto-publishes.
//
// Usage: node scripts/generate-content.mjs [--dry-run]

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
const DRY = process.argv.includes("--dry-run");
const today = new Date().toISOString().split("T")[0];

async function latestDigests(n = 2) {
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
    readFile(join(ROOT, "research", "CONTENT-VOICE.md"), "utf-8"),
    readFile(join(ROOT, "TRUST-STANDARD.md"), "utf-8"),
    readFile(join(ROOT, "data", "heat-report.json"), "utf-8"),
    readFile(join(ROOT, "data", "release-radar.json"), "utf-8"),
    latestDigests(),
  ]);

  const prompt = `${voice}

=== TRUST STANDARD (binding) ===
${trust}

=== HEAT REPORT ===
${heat}

=== RELEASE RADAR ===
${radar}

=== RECENT RESEARCH DIGESTS ===
${digests}

Today's date: ${today}. Generate today's content pack now, per the format
in the guide. If the heat report has zero publishable reads (rebuild
period), lean on radar events, digest news, and cultural angles — say the
momentum data is rebuilding rather than faking reads.`;

  await mkdir(join(ROOT, "research", "content"), { recursive: true });
  if (DRY) {
    const p = join(ROOT, "research", "content", `${today}-pack.PROMPT.txt`);
    await writeFile(p, prompt);
    console.log(`✓ dry-run: prompt assembled (${prompt.length.toLocaleString()} chars) → ${p}`);
    return;
  }
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }
  // Through lib/claude.mjs, which refuses a truncated answer. A content pack
  // that stops halfway through the fourth idea still reads like a content pack.
  let text;
  try {
    ({ text } = await callClaude({ apiKey: API_KEY, maxTokens: 12000,
      messages: [{ role: "user", content: prompt }], label: "generate-content" }));
  } catch (e) {
    console.error("✗ " + e.message);
    if (e.name === "TruncatedError") console.error("  Nothing was written. The pack would have been incomplete.");
    process.exit(1);
  }
  const out = join(ROOT, "research", "content", `${today}-pack.md`);
  await writeFile(out, text + "\n");
  console.log(`✓ CONTENT PACK: research/content/${today}-pack.md — human selects before anything posts`);
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });
