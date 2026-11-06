// One issue titled PRICES STALE. Updated, never duplicated.
// Opens when sealed-prices.json asOf (or updatedAt) is older than 36 hours.
// Closes when the file is fresh again. No-op outside GitHub Actions.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { STALE_TITLE, pricesAreStale, staleBody, staleIssueAction } from "./lib/price-alarm.mjs";

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const doc = await readJson("data/sealed-prices.json");
const tests = await readFile("/tmp/tests.log", "utf8").catch(() => "");
const stale = pricesAreStale(doc);
const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || ""}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
const body = staleBody({ runUrl: run, doc, tests });

if (process.env.GITHUB_ACTIONS !== "true") {
  console.log(stale ? `stale: ${body.split("\n")[3]}` : "fresh");
  process.exit(0);
}

let open = [];
try {
  const listed = JSON.parse(gh("issue", "list", "--state", "open", "--limit", "20", "--search", `in:title "${STALE_TITLE}"`, "--json", "number,title"));
  open = listed.filter((issue) => issue.title === STALE_TITLE).map((issue) => issue.number);
} catch (err) {
  console.log(`::warning::could not list issues: ${String(err.message || err).split("\n")[0]}`);
  process.exit(0);
}

const action = staleIssueAction(open, stale);
try {
  if (action.action === "open") console.log(gh("issue", "create", "--title", STALE_TITLE, "--body", body).trim());
  else if (action.action === "update") {
    gh("issue", "edit", String(action.number), "--body", body);
    gh("issue", "comment", String(action.number), "--body", body);
    console.log(`updated issue #${action.number}`);
  } else if (action.action === "close") {
    gh("issue", "close", String(action.number), "--comment", `sealed-prices.json is fresh again. ${run}`);
    console.log(`closed issue #${action.number}`);
  } else console.log("fresh, no open issue");
} catch (err) {
  console.log(`::warning::issue not updated: ${String(err.message || err).split("\n")[0]}`);
}
