// Write data/ppt/run-report.json and one GitHub Actions summary line. No prices.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildRunReport, reportLine } from "./lib/run-report.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

export async function writeRunReport(root = ROOT, finishedAt = new Date().toISOString()) {
  const started = await readJson(join(root, "data/ppt/run-started.json"));
  const usage = await readJson(join(root, "data/meta/ppt-usage.json"));
  const mount = await readJson(join(root, "data/ppt/mount-status.json"));
  const push = await readJson(join(root, "data/ppt/push-status.json"));
  const report = buildRunReport({
    startedAt: started?.startedAt || null,
    finishedAt,
    usage: usage || {},
    mount: mount || { restored: false, files: 0 },
    push: push || { expected: false, pushed: false, reason: "no push status" },
  });
  const leaked = JSON.stringify(report).match(/unopenedPrice|marketPrice|"price"/);
  if (leaked) throw new Error("refusing to write a price field");
  const dir = join(root, "data/ppt");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "run-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const line = reportLine(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  }
  return { report, line };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { line } = await writeRunReport();
  console.log(line);
}
