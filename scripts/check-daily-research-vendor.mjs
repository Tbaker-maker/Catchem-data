// The research workflow may schedule an xAI run. It may not call the old
// paid chat API. This file is the check. It is not one of the files it scans.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function dailyResearchVendorProblem(workflowSrc, scriptSrc) {
  const blob = String(workflowSrc || "") + "\n" + String(scriptSrc || "");
  if (/ANTHROPIC_API_KEY/.test(blob)) return "anthropic-key";
  if (/api\.anthropic\.com/i.test(blob)) return "anthropic-call";
  if (/\bclaude\b/i.test(blob)) return "claude-call";
  if (!/^[ \t]*schedule:/m.test(String(workflowSrc || ""))) return "missing-schedule";
  if (!/XAI_API_KEY/.test(blob) || !/api\.x\.ai/.test(String(scriptSrc || ""))) return "missing-xai";
  return "";
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const wf = await readFile(join(root, ".github/workflows/daily-research.yml"), "utf8");
  const src = await readFile(join(root, "scripts/daily-research.mjs"), "utf8");
  const problem = dailyResearchVendorProblem(wf, src);
  if (problem) {
    console.error("FAIL: daily-research vendor check: " + problem);
    process.exit(1);
  }
  console.log("OK: xAI schedule, no paid-chat call");
}
