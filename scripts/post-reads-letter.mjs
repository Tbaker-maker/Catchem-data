// Posts the reads letter summary to issue 573. Refuses a body that contains
// an address. Does not close the issue. Set READS_LETTER_POST=1 to comment.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const file = process.argv[2] || "letter-summary.md";
let body = "";
try {
  body = await readFile(file, "utf8");
} catch {
  console.error("letter summary was not written");
  process.exit(1);
}
if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(body)) {
  console.error("letter summary has an address, not posted");
  process.exit(1);
}
if (!body.trim()) {
  console.error("letter summary is empty, not posted");
  process.exit(1);
}
if (process.env.READS_LETTER_POST !== "1") {
  console.log(body);
  process.exit(0);
}
execFileSync("gh", ["issue", "comment", "573", "--body", body], { stdio: "inherit" });
