// scripts/daily-research.mjs
// Daily Pokemon TCG research agent for Catch'em.
// Calls Claude API with web search, writes research/digests/YYYY-MM-DD.md
// and updates data/release-radar.json when the radar changes.
// Requires: ANTHROPIC_API_KEY env var. Node 20+.

import { readFile, writeFile, mkdir } from "node:fs/promises";
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

  // ── A TRUNCATED ANSWER IS NOT AN ANSWER ──────────────────────────────────
  // The API said so in stop_reason on eight consecutive runs and this script
  // threw the field away. When a response is cut off at max_tokens the radar
  // block loses its closing fence; the extractor below requires one, finds
  // nothing, writes no radar — and the run still prints a tick and exits 0.
  //
  // Every digest from 2026-08-18 to 2026-08-25 opens a json fence and never
  // closes it, all landing within 400 bytes of the same size, because 4000
  // tokens could not hold a 12KB digest plus a 2.5K-token radar. Eight green
  // runs, a radar frozen on 2026-08-19, and the only symptom was a date that
  // read like a quiet week.
  //
  // The check now lives in lib/claude.mjs, which every Anthropic caller in this
  // repo goes through — because three of the four had made the same omission
  // independently, and a rule kept in four places is kept in one of them.
  let text = "";
  try {
    ({ text } = await callClaude({
      apiKey: API_KEY,
      maxTokens: 12000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content: userMsg }],
      label: "daily-research",
    }));
  } catch (e) {
    // The digest is worth reading even when the radar block is cut, so the
    // partial text is saved — clearly labelled — and the radar is left alone.
    if (e.name === "TruncatedError") {
      await saveDigest(e.partialText, "TRUNCATED — response hit max_tokens. The radar block is incomplete and was NOT applied.");
      console.error("✗ " + e.message);
      console.error("  Digest saved for reading. Radar NOT written.");
      process.exit(1);
    }
    console.error("✗ " + e.message);
    process.exit(1);
  }

  // AN OPENED FENCE THAT NEVER CLOSES is the same failure arriving by another
  // route — a stop_reason we do not know about yet, or a model that simply
  // stops. Checked separately so it cannot pass silently either.
  const FENCE = String.fromCharCode(96, 96, 96);
  const opens = (text.match(new RegExp(FENCE + "json", "g")) || []).length;
  const jsonBlocks = [...text.matchAll(new RegExp(FENCE + "json[^]*?" + FENCE, "g"))]
    .map(m => m[0].slice(FENCE.length + 4, -FENCE.length));
  if (opens > jsonBlocks.length) {
    await saveDigest(text, "TRUNCATED — a json block was opened and never closed. The radar was NOT applied.");
    console.error("✗ a radar block was opened and never closed. Radar NOT written.");
    process.exit(1);
  }

  // ── WRITE THE RADAR, OR RECORD THAT WE LOOKED ────────────────────────────
  // "Nothing changed" and "the pipeline is dead" produced an identical file for
  // six days: an `updated` date going stale on its own. They are different
  // states, and the file now says which one it is. `updated` is the last time
  // the CONTENT moved; `checkedAt` is the last time anybody looked. A stale
  // checkedAt is a broken agent, visible without reading a single digest.
  //
  // Same class as "nothing due for a reading": silence that cannot be told
  // apart from failure is a defect, not a quiet day.
  let digest = text, radarNote = "";
  const prev = JSON.parse(await readFile(RADAR_FILE, "utf-8"));

  if (jsonBlocks.length) {
    const raw = jsonBlocks[jsonBlocks.length - 1];
    let parsed = null;
    try { parsed = JSON.parse(raw); }
    catch (e) {
      await saveDigest(text, "Radar block present but INVALID JSON (" + e.message.slice(0, 80) + "). Radar NOT applied.");
      console.error("✗ radar block is not valid JSON. Radar NOT written:", e.message.slice(0, 120));
      process.exit(1);
    }
    if (!Array.isArray(parsed.upcoming)) {
      await saveDigest(text, "Radar block parsed but carried no upcoming[]. Radar NOT applied.");
      console.error("✗ radar block has no upcoming[] array. Radar NOT written.");
      process.exit(1);
    }
    // Compare on CONTENT, ignoring bookkeeping, so a model that re-emits the
    // radar verbatim under a new date does not read as a change.
    const strip = (o) => JSON.stringify({ ...o, updated: 0, checkedAt: 0, checkedBy: 0, lastCheck: 0, notes: 0 });
    const changed = strip(parsed) !== strip(prev);
    parsed.checkedAt = new Date().toISOString();
    parsed.checkedBy = "daily-research";
    parsed.lastCheck = changed ? "updated" : "checked, no change";
    if (!changed) parsed.updated = prev.updated;      // never fake movement
    await writeFile(RADAR_FILE, JSON.stringify(parsed, null, 2) + "\n");
    radarNote = changed ? "radar updated" : "radar checked, no change";
    console.log("✓ " + radarNote);
    digest = text.split(FENCE + "json").slice(0, -1).join(FENCE + "json").trim() || text.trim();
  } else {
    // No block at all is a legitimate "nothing to change" under the brief. It
    // still counts as having looked, and must be recorded as such.
    prev.checkedAt = new Date().toISOString();
    prev.checkedBy = "daily-research";
    prev.lastCheck = "checked, no change";
    await writeFile(RADAR_FILE, JSON.stringify(prev, null, 2) + "\n");
    radarNote = "radar checked, no change (no block emitted)";
    console.log("✓ " + radarNote);
  }

  await saveDigest(digest, radarNote);
  console.log("✓ digest written: research/digests/" + today + ".md");
}

// ONE WRITER, so every exit path leaves a readable digest AND states at the top
// what happened to the radar. A digest that does not say is how six days of
// truncation went unnoticed.
async function saveDigest(body, note) {
  await mkdir(DIGEST_DIR, { recursive: true });
  const head = note ? "> RADAR: " + note + "\n\n" : "";
  await writeFile(join(DIGEST_DIR, today + ".md"), head + String(body).trim() + "\n");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
