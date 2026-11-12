// Rehearsal of "Publish the public-data branch": same commit build, same guard,
// same pre-publish smoke. Reads the live public-data tip. Pushes nothing.
// Never prints the private limits.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { buildPublicCommit, assertPublicData, treeFiles, readBlob } from "../../scripts/publish-public-data.mjs";
import { checkBuild, loadChecks, ROTATING } from "../../scripts/lib/publish-checks.mjs";

const cwd = process.cwd();
const cfg = await loadChecks(cwd);
const sha = buildPublicCommit(cwd);
assertPublicData(cwd, sha);
const files = treeFiles(cwd, sha);
for (const name of ["reads.json", "counts.json", "today.json", "movers.json"]) {
  const f = files.get(name);
  if (f && f.size > 0) f.text = readBlob(cwd, f.blob);
}
execFileSync("git", ["fetch", "-q", "origin", "+refs/heads/public-data:refs/remotes/origin/public-data"], { cwd });
const backup = execFileSync("git", ["rev-parse", "refs/remotes/origin/public-data"], { cwd, encoding: "utf8" }).trim();
const before = [...treeFiles(cwd, backup).keys()];
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const problems = checkBuild({ files, before, cfg, today });
const gone = before.filter((n) => !files.has(n) && !ROTATING.some((d) => n.startsWith(d)));
const added = [...files.keys()].filter((n) => !before.includes(n));
const at25 = cfg ? checkBuild({ files, before, cfg: { ...cfg, maxDroppedFiles: 25 }, today }) : ["no cfg"];
const atTomorrow = cfg ? checkBuild({ files, before, cfg, today: tomorrow }) : ["no cfg"];
const dates = {};
for (const name of ["reads.json", "counts.json", "today.json", "movers.json"]) {
  try { const d = JSON.parse(files.get(name)?.text || "{}"); dates[name] = d.asOf || null; if (name === "reads.json") dates.readsCount = (d.reads || []).length; } catch (e) { dates[name] = `bad json ${e.message}`; }
}
let smoke = "";
try { execFileSync("node", ["scripts/smoke-test.mjs"], { cwd, stdio: "inherit", env: { ...process.env, SMOKE_PREPUBLISH: "1" } }); } catch { smoke = "smoke test failed"; }
if (smoke) problems.push(smoke);
const report = { at: new Date().toISOString(), sha, backup, cfgLoaded: Boolean(cfg), today, dates, goneCounted: gone.length, gone, addedCount: added.length, problems, problemsIfLimit25: at25, problemsIfRunTomorrowUTC: atTomorrow };
mkdirSync("/tmp/reh", { recursive: true });
writeFileSync("/tmp/reh/publish-dry.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
if (problems.length) { console.error(`public-data WOULD NOT be pushed:\n- ${problems.join("\n- ")}`); process.exit(1); }
console.log("public-data WOULD be pushed (rehearsal: nothing pushed)");
