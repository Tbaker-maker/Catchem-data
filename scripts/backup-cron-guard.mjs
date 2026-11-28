// Local check for the 06:00 UTC backup. Reads git history and the price file.
// Checkout may already have happened. This file does not install or call out.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { sealedDateOf, skipBackup } from "./lib/backup-cron.mjs";

function subjectsFromHead() {
  const out = execFileSync("git", ["log", "HEAD", "--format=%s"], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function readSealedDate() {
  try {
    const doc = JSON.parse(readFileSync("data/sealed-prices.json", "utf8"));
    return sealedDateOf(doc);
  } catch {
    return null;
  }
}

function publish(skip) {
  const line = `skip=${skip ? "true" : "false"}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  let subjects = [];
  let sealedDate = null;
  try {
    subjects = subjectsFromHead();
    sealedDate = readSealedDate();
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    publish(false);
    return;
  }
  const skip = skipBackup({
    schedule: process.env.GITHUB_EVENT_SCHEDULE || "",
    subjects,
    today,
    sealedDate,
  });
  publish(skip);
  console.log(`backup guard today=${today} sealedDate=${sealedDate || ""} skip=${skip ? "true" : "false"}`);
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : String(err));
  try { publish(false); } catch { /* leave the job fail-open */ }
}
