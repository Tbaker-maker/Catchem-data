// Puts each withheld group's public files back to the last committed copy, so a
// file that failed its own test tonight is never committed or published.
// Reads data/derived/test-triage.json from scripts/triage-tests.mjs. A path that
// did not exist at HEAD is removed. Nothing outside research/assets/public is touched.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const file = process.argv[2] || "data/derived/test-triage.json";
let doc = null;
try { doc = JSON.parse(await readFile(file, "utf8")); } catch { doc = null; }
const paths = (doc?.paths || []).filter((p) => p.startsWith("research/assets/public/") && !p.includes(".."));
if (!paths.length) { console.log("Nothing withheld."); process.exit(0); }

const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
for (const p of paths) {
  const tracked = git("ls-tree", "-r", "--name-only", "HEAD", "--", p).trim();
  if (tracked) {
    git("checkout", "-q", "HEAD", "--", p);
    git("clean", "-fdq", "--", p);
    console.log(`withheld ${p}: kept the last committed copy`);
  } else if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`withheld ${p}: new tonight and failed its test, left out`);
  }
}
