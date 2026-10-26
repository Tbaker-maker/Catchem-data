// Opens or updates ONE issue for nightly test trouble, so a red night is never silent.
// Reads data/derived/test-triage.json. Clean night: comments and closes the issue.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const TITLE = "Nightly price run: tests blocked or withheld";
const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || ""}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
let doc = null;
try { doc = JSON.parse(await readFile(process.argv[2] || "data/derived/test-triage.json", "utf8")); } catch { doc = null; }
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8" });

const trouble = !doc || doc.blocked?.length || doc.withheld?.length || doc.monitor?.length;
const body = `Run: ${run}\n\n${doc ? doc.summary : "No test triage was written. The test step did not finish."}`;
let open = [];
try { open = JSON.parse(gh("issue", "list", "--state", "open", "--search", `in:title "${TITLE}"`, "--json", "number,title")).filter((i) => i.title === TITLE); } catch { open = []; }
try {
  if (trouble) {
    if (open.length) { gh("issue", "comment", String(open[0].number), "--body", body); console.log(`updated issue #${open[0].number}`); }
    else { console.log(gh("issue", "create", "--title", TITLE, "--body", body).trim()); }
  } else if (open.length) {
    gh("issue", "close", String(open[0].number), "--comment", `Clean night, nothing blocked or withheld. ${run}`);
    console.log(`closed issue #${open[0].number}`);
  }
} catch (e) {
  console.log(`::warning::issue not updated: ${String(e.message).split("\n")[0]}`);
}
