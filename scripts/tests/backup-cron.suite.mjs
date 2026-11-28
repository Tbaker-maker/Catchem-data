// Workflow parse for the 06:00 UTC sealed-prices backup. No GitHub API.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WF = join(ROOT, ".github/workflows/update-sealed-prices.yml");
const PRIMARY_CRON = "0 4 * * *";
const BACKUP_CRON = "0 6 * * *";
const GUARD_SCRIPT = "scripts/backup-cron-guard.mjs";

const UPDATE_IF = "!cancelled() && (github.event.schedule != '0 6 * * *' || needs.backup-guard.outputs.skip != 'true')";
const GUARD_IF = "github.event.schedule == '0 6 * * *'";

function normalizeIf(line) {
  return String(line || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\$\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// True when the update job is skipped. A missing or unexpected if is not a pass.
export function updateJobSkipped(ifLine, { schedule = "", skip = "false", cancelled = false } = {}) {
  if (normalizeIf(ifLine) !== UPDATE_IF) return null;
  if (cancelled) return true;
  return schedule === BACKUP_CRON && String(skip) === "true";
}

function commandText(stepText) {
  return String(stepText || "")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

// npm install, curl, setup-node, git network, and node scripts that fetch.
export function isNetworkStep(stepText) {
  const text = commandText(stepText).replaceAll(GUARD_SCRIPT, "");
  if (/\bnpm\s+install\b/.test(text)) return true;
  if (/\bcurl\b/.test(text)) return true;
  if (/actions\/setup-node\b/.test(text)) return true;
  if (/\bgit\s+(push|pull|fetch)\b/.test(text)) return true;
  if (/\bnode\s+scripts\/\S*(?:fetch|ebay|ppt|tcgcsv|pkmn|ppp-private-sync)\S*/i.test(text)) return true;
  return false;
}

export function parseWorkflowJobs(src) {
  const lines = String(src || "").split("\n");
  const jobsAt = lines.findIndex((line) => line === "jobs:");
  const jobs = [];
  let job = null;
  let step = null;
  if (jobsAt < 0) return jobs;
  for (let i = jobsAt + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[^\s#]/.test(line)) break;
    const jobHead = line.match(/^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/);
    if (jobHead) {
      job = { name: jobHead[1], ifLine: "", needs: "", steps: [] };
      jobs.push(job);
      step = null;
      continue;
    }
    if (!job) continue;
    const needs = line.match(/^    needs:\s*(.+?)\s*(?:#.*)?$/);
    if (needs) {
      job.needs = needs[1].trim().replace(/^\[|\]$/g, "");
      step = null;
      continue;
    }
    const iff = line.match(/^    if:\s*(.+?)\s*(?:#.*)?$/);
    if (iff) {
      job.ifLine = iff[1].trim();
      step = null;
      continue;
    }
    if (/^      - (?:name|uses):/.test(line)) {
      step = { line: i + 1, text: `${line}\n` };
      job.steps.push(step);
      continue;
    }
    if (step && (/^ {8}/.test(line) || line.trim() === "")) {
      step.text += `${line}\n`;
      continue;
    }
    step = null;
  }
  return jobs;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  let skipBackup = null;
  let sealedDateOf = null;
  try {
    ({ skipBackup, sealedDateOf } = await import("../lib/backup-cron.mjs"));
  } catch {
    skipBackup = null;
    sealedDateOf = null;
  }
  t("skipBackup is exported", typeof skipBackup === "function" && typeof sealedDateOf === "function");

  const today = "2026-11-27";
  const committed = ["data: listing counts 2026-11-27T01:44Z", "data: sealed prices 2026-11-27"];
  if (typeof skipBackup === "function") {
    t("backup skips when the sealed prices subject is today", skipBackup({
      schedule: BACKUP_CRON, subjects: committed, today, sealedDate: "2026-11-26",
    }) === true);
    t("backup skips when the Update sealed prices subject is today", skipBackup({
      schedule: BACKUP_CRON, subjects: [`Update sealed prices (${today})`], today, sealedDate: null,
    }) === true);
    t("backup skips when sealed-prices updatedAt is today", skipBackup({
      schedule: BACKUP_CRON, subjects: [], today, sealedDate: "2026-11-27T10:35:44.569Z",
    }) === true);
    t("a nearby subject is not today's commit", skipBackup({
      schedule: BACKUP_CRON, subjects: [`data: sealed prices ${today} extra`], today, sealedDate: null,
    }) === false);
    t("backup runs when today is not committed", skipBackup({
      schedule: BACKUP_CRON,
      subjects: ["data: sealed prices 2026-11-26", "Update sealed prices (2026-11-26)"],
      today,
      sealedDate: "2026-11-26",
    }) === false);
    t("primary cron does not skip", skipBackup({
      schedule: PRIMARY_CRON, subjects: committed, today, sealedDate: today,
    }) === false);
    t("workflow_dispatch does not skip", skipBackup({
      schedule: "", subjects: committed, today, sealedDate: today,
    }) === false);
    t("a missing schedule does not skip", skipBackup({
      schedule: undefined, subjects: committed, today, sealedDate: today,
    }) === false);
  }
  if (typeof sealedDateOf === "function") {
    t("the price file date is updatedAt", sealedDateOf({ updatedAt: "2026-11-27T10:35:44.569Z" }) === today);
    t("a date field that is not on the file is not invented", sealedDateOf({ date: today, asOf: today }) === null);
    t("a bad updatedAt is not a day", sealedDateOf({ updatedAt: "yesterday" }) === null);
    const live = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
    t("the live sealed-prices date is its updatedAt day", sealedDateOf(live) === String(live.updatedAt).slice(0, 10) && !Object.prototype.hasOwnProperty.call(live, "date"));
  }

  const src = await readFile(WF, "utf8");
  const crons = [...src.matchAll(/^\s*-\s*cron:\s*"([^"]+)"/gm)].map((m) => m[1]);
  t("primary cron is 04:00 UTC", crons.includes(PRIMARY_CRON));
  t("backup cron is 06:00 UTC", crons.includes(BACKUP_CRON));
  t("workflow concurrency stays update-sealed-prices", /concurrency:\n {2}group: update-sealed-prices\n {2}cancel-in-progress: false/.test(src));
  t("the update job keeps the ebay concurrency group", / {4}concurrency:\n {6}group: ebay\n {6}cancel-in-progress: false/.test(src));

  const jobs = parseWorkflowJobs(src);
  const update = jobs.find((job) => job.name === "update");
  const guard = jobs.find((job) => job.name === "backup-guard");
  t("the parser still sees one update job", jobs.filter((job) => job.name === "update").length === 1 && !!update);
  t("the parser sees npm install on the update job", !!update && update.steps.some((step) => /\bnpm\s+install\b/.test(commandText(step.text))));
  t("a backup-guard job checks git before the update job", !!guard && jobs.indexOf(guard) < jobs.indexOf(update));
  t("the guard job runs only for the backup cron", !!guard && normalizeIf(guard.ifLine) === GUARD_IF);
  t("the update job needs the guard", !!update && update.needs.split(/[,\s]+/).includes("backup-guard"));
  t("the update job if is the backup skip", !!update && normalizeIf(update.ifLine) === UPDATE_IF);

  const primarySkip = update ? updateJobSkipped(update.ifLine, { schedule: PRIMARY_CRON, skip: "true" }) : null;
  const dispatchSkip = update ? updateJobSkipped(update.ifLine, { schedule: "", skip: "true" }) : null;
  const backupSkip = update ? updateJobSkipped(update.ifLine, { schedule: BACKUP_CRON, skip: "true" }) : null;
  const backupRun = update ? updateJobSkipped(update.ifLine, { schedule: BACKUP_CRON, skip: "false" }) : null;
  t("primary cron does not take the skip path", primarySkip === false);
  t("workflow_dispatch does not take the skip path", dispatchSkip === false);
  t("backup cron skips only when today is already committed", backupSkip === true && backupRun === false);

  const guardStep = guard?.steps.find((step) => step.text.includes(GUARD_SCRIPT));
  t("the guard step runs the local script", !!guardStep && /run:\s*node scripts\/backup-cron-guard\.mjs\s*$/m.test(commandText(guardStep.text)));
  t("the guard step receives the schedule", !!guardStep && /GITHUB_EVENT_SCHEDULE:\s*\$\{\{\s*github\.event\.schedule\s*\}\}/.test(guardStep.text));
  const guardNetwork = guard ? guard.steps.filter((step) => isNetworkStep(step.text)) : [];
  t("the guard job has no network step", !!guard && guardNetwork.length === 0);
  const guardUses = guard ? guard.steps.filter((step) => /\buses:/.test(step.text) && !/actions\/checkout@/.test(step.text)) : [];
  t("the guard job uses checkout only", !!guard && guardUses.length === 0 && guard.steps.some((step) => /actions\/checkout@/.test(step.text)));
  const network = jobs.flatMap((job) => job.steps.filter((step) => isNetworkStep(step.text)));
  t("network steps are parsed", network.length > 0);
  t("the guard step is before every network step", !!guardStep && network.every((step) => step.line > guardStep.line));
  const scheduleHits = src.split("\n").filter((line) => line.includes(BACKUP_CRON) && !/^\s*#/.test(line));
  t("the backup cron is not pasted onto every step", scheduleHits.length >= 2 && scheduleHits.length <= 4);
  const stepBackupIfs = update ? update.steps.filter((step) => step.text.includes(BACKUP_CRON)) : [];
  t("the backup skip is not pasted onto update steps", stepBackupIfs.length === 0);

  let guardSrc = "";
  try { guardSrc = await readFile(join(ROOT, GUARD_SCRIPT), "utf8"); } catch { guardSrc = ""; }
  t("the guard script stays local", guardSrc.includes("skipBackup") && !/\bfetch\s*\(|\bcurl\b|\bnpm\b|https?:\/\/|\bgit\s+(push|pull|fetch)\b|node:https|node:http/.test(guardSrc));
  t("new lines have no em dash or en dash", !/[\u2014\u2013]/.test([
    guardSrc,
    await readFile(new URL("../lib/backup-cron.mjs", import.meta.url), "utf8").catch(() => ""),
    await readFile(new URL("./backup-cron.suite.mjs", import.meta.url), "utf8"),
  ].join("\n")));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("backup-cron.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
