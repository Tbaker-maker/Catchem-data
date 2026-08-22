// scripts/daily-research.mjs
// Daily Pokemon TCG research agent for Catch'em.
// Calls Claude API with web search, writes research/digests/YYYY-MM-DD.md
// and updates data/release-radar.json when the radar changes.
// Requires: ANTHROPIC_API_KEY env var. Node 20+.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this script until the CI runner kills the job.
// A hung job is worse than a failed one — nothing goes red, the whole
// allowance burns and no guard reports. Every call below is bounded.
const FETCH_TIMEOUT_MS = 120000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RADAR_FILE = join(ROOT, "data", "release-radar.json");
const PROMPT_FILE = join(ROOT, "research", "RESEARCH_PROMPT.md");
const DIGEST_DIR = join(ROOT, "research", "digests");

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const today = new Date().toISOString().split("T")[0];

async function main() {
  const radar = await readFile(RADAR_FILE, "utf-8");
  const brief = await readFile(PROMPT_FILE, "utf-8");

  const userMsg = `${brief}

Today's date: ${today}

Current release radar (data/release-radar.json):
\`\`\`json
${radar}
\`\`\`

Run today's check now. Remember: digest first, then the fenced \`\`\`json radar block ONLY if the radar needs changes.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    console.error(`API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const data = await res.json();

  // Join all text blocks (server runs the searches; we get final text)
  const text = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  if (!text.trim()) { console.error("Empty response"); process.exit(1); }

  // Extract optional radar update: last ```json fenced block
  const jsonBlocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  let digest = text;
  if (jsonBlocks.length) {
    const candidate = jsonBlocks[jsonBlocks.length - 1][1];
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed.upcoming)) {
        await writeFile(RADAR_FILE, JSON.stringify(parsed, null, 2) + "\n");
        console.log("✓ radar updated");
        digest = text.replace(jsonBlocks[jsonBlocks.length - 1][0], "").trim();
      }
    } catch { console.warn("⚠ radar block present but invalid JSON — digest saved, radar untouched"); }
  }

  await mkdir(DIGEST_DIR, { recursive: true });
  const outPath = join(DIGEST_DIR, `${today}.md`);
  await writeFile(outPath, digest + "\n");
  console.log(`✓ digest written: research/digests/${today}.md`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
