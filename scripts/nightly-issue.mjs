// Opens or updates ONE issue for nightly test trouble, so a red night is never silent.
// Reads data/derived/test-triage.json. Clean night: comments and closes the issue.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const TITLE = "Nightly price run: tests blocked or withheld";
const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || ""}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
let doc = null;
try { doc = JSON.parse(await readFile(process.argv[2] || "data/derived/test-triage.json", "utf8")); } catch { doc = null; }
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8" });

if (process.argv.includes("--failed-step")) {
  const step = String(process.env.NIGHTLY_FAILED_STEP || "unknown step").replace(/[\r\n]/g, " ").slice(0, 180);
  const note = `Failed step: ${step}\nRun: ${run}\n\nThis line is the latest break. The test note under it is from earlier in the run, or from the previous note.`;
  let rows = [];
  try {
    rows = JSON.parse(gh("issue", "list", "--state", "all", "--limit", "20", "--search", `in:title "${TITLE}"`, "--json", "number,title,state")).filter((i) => i.title === TITLE);
  } catch { rows = []; }
  const hit = rows.find((i) => i.state === "OPEN") || rows[0];
  try {
    if (!hit) {
      console.log(gh("issue", "create", "--title", TITLE, "--body", note).trim());
    } else {
      const id = String(hit.number);
      let prior = "";
      try { prior = JSON.parse(gh("issue", "view", id, "--json", "body")).body || ""; } catch { prior = ""; }
      const next = `${note}\n\n${prior}`.slice(0, 60000);
      gh("issue", "comment", id, "--body", note);
      gh("issue", "edit", id, "--body", next);
      if (String(hit.state).toUpperCase() === "CLOSED") gh("issue", "reopen", id);
      console.log(`noted failure on #${id}`);
    }
  } catch (e) {
    console.log(`::warning::failure note not posted: ${String(e.message).split("\n")[0]}`);
  }
  process.exit(0);
}

const trouble = !doc || doc.blocked?.length || doc.withheld?.length || doc.monitor?.length;
const body = `Run: ${run}\n\n${doc ? doc.summary : "No test triage was written. The test step did not finish."}`;
let open = [];
try { open = JSON.parse(gh("issue", "list", "--state", "open", "--search", `in:title "${TITLE}"`, "--json", "number,title")).filter((i) => i.title === TITLE); } catch { open = []; }
try {
  if (trouble) {
    if (open.length) {
      const id = String(open[0].number);
      gh("issue", "comment", id, "--body", body);
      gh("issue", "edit", id, "--body", body);
      console.log(`updated issue #${id}`);
    } else { console.log(gh("issue", "create", "--title", TITLE, "--body", body).trim()); }
  } else if (open.length) {
    gh("issue", "close", String(open[0].number), "--comment", `Clean night, nothing blocked or withheld. ${run}`);
    console.log(`closed issue #${open[0].number}`);
  }
} catch (e) {
  console.log(`::warning::issue not updated: ${String(e.message).split("\n")[0]}`);
}
