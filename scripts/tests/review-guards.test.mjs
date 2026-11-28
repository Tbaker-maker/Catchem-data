// Fixture proof for the review holds. The numbers here are not live limits.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dashProblems, fixtureMarkerProblems, indexLimits, privateLimitProblems, writerProblems } from "../lib/review-guards.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };

const LIVE = indexLimits({ minReads: 4242, note: "not a fixture" });
const copied = [{ path: "scripts/tests/fixtures/sample-limits.json", text: JSON.stringify({ minReads: 4242 }) }];
const marked = [{ path: "scripts/tests/fixtures/sample-limits.json", text: JSON.stringify({ note: "Fake limits for tests.", minReads: 7 }) }];
t("a fixture that copies a live limit key fails", privateLimitProblems(copied, LIVE).length === 1);
t("a fake fixture with a different number passes", privateLimitProblems(marked, LIVE).length === 0);
t("a limits fixture with no fake marker fails", fixtureMarkerProblems(copied).some((row) => /no fake marker/.test(row)));
t("a limits fixture marked fake passes the marker check", fixtureMarkerProblems(marked).length === 0);

const readers = [{ file: "research/assets/public/counts.json", writer: "scripts/build-public-bundle.mjs" }];
t("generated public data without its writer fails", writerProblems({ files: ["research/assets/public/counts.json"], messages: "update counts", readers }).length === 1);
t("generated public data passes when the writer script is in the diff", writerProblems({ files: ["research/assets/public/counts.json", "scripts/build-public-bundle.mjs"], messages: "update counts", readers }).length === 0);
t("generated public data passes when the commit names the writer command", writerProblems({ files: ["research/assets/public/counts.json"], messages: "produced by node scripts/build-public-bundle.mjs", readers }).length === 0);

const dashDiff = [
  "+++ b/scripts/example.mjs",
  "+const label = \"wait \u2014 now\";",
].join("\n");
const cleanDiff = [
  "+++ b/scripts/example.mjs",
  "+const label = \"wait - now\";",
].join("\n");
t("an added em dash in a script fails", dashProblems(dashDiff).length === 1);
t("a hyphen in an added script line passes", dashProblems(cleanDiff).length === 0);

function runRepo(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "review-guards-"));
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", env });
  git(["init", "-b", "main"]);
  mkdirSync(join(dir, "scripts/tests/fixtures"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts/tests/fixtures/sample-limits.json"), "{\"note\":\"Fake limits for tests.\",\"minReads\":7}\n");
  writeFileSync(join(dir, "scripts/example.mjs"), "export const label = \"ok\";\n");
  git(["add", "."]);
  git(["commit", "-m", "base"]);
  const base = git(["rev-parse", "HEAD"]).trim();
  mutate(dir);
  git(["add", "."]);
  git(["commit", "-m", "change"]);
  const child = execFileSync;
  try {
    const out = child(process.execPath, [join(dir, "scripts/review-guards.mjs")], {
      cwd: dir,
      encoding: "utf8",
      env: { ...env, BASE_SHA: base, REVIEW_GUARDS_ROOT: dir, PRIVATE_DATA_TOKEN: "" },
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status || 1, out: `${err.stdout || ""}${err.stderr || ""}` };
  }
}

// The script file has to live inside the fixture repo. Copy it after the
// pure checks, from the real tree, by importing nothing else.
import { readFileSync, cpSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(join(HERE, "../review-guards.mjs"), "utf8");
const LIB = readFileSync(join(HERE, "../lib/review-guards.mjs"), "utf8");
const SOURCES = readFileSync(join(HERE, "../lib/public-sources.mjs"), "utf8");

function seed(dir) {
  mkdirSync(join(dir, "scripts/lib"), { recursive: true });
  writeFileSync(join(dir, "scripts/review-guards.mjs"), SCRIPT);
  writeFileSync(join(dir, "scripts/lib/review-guards.mjs"), LIB);
  writeFileSync(join(dir, "scripts/lib/public-sources.mjs"), SOURCES);
}

const passed = runRepo((dir) => {
  seed(dir);
  writeFileSync(join(dir, "scripts/example.mjs"), "export const label = \"wait - now\";\n");
});
t("the script passes a clean diff and prints the skip notice", passed.code === 0 && /NOTICE: PRIVATE_DATA_TOKEN is not set/.test(passed.out) && /fake marker/.test(passed.out));

const dashed = runRepo((dir) => {
  seed(dir);
  writeFileSync(join(dir, "scripts/example.mjs"), "export const label = \"wait \u2014 now\";\n");
});
t("the script fails an added em dash", dashed.code === 1 && /em or en dash/.test(dashed.out));

if (fail) {
  console.error(`review guards: ${fail} failed`);
  process.exit(1);
}
console.log("review guards: fixtures ok");
