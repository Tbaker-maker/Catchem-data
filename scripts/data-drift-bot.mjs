// Compares the catalogue guard with a fresh guard. With DRIFT_BOT_TOKEN set,
// a real drift is committed on its own branch and opened as a pull request.
// Without a token the plan is written and no pull request is opened.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { catalogueGuard } from "./lib/post-office-catalogue.mjs";
import { driftOf, openFixPr, planFix } from "./lib/data-drift-bot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = "data/derived/post-office-catalogue.json";
const doc = JSON.parse(await readFile(join(ROOT, rel), "utf8"));
const guard = catalogueGuard(doc, { expected: doc.sets || [] });
const drift = driftOf(rel, { ...doc, guard }, doc);

if (!drift) {
  console.log(JSON.stringify({ drift: false, path: rel }));
  process.exit(0);
}

const plan = planFix(drift);
const token = process.env.DRIFT_BOT_TOKEN || "";
const result = openFixPr(plan, {
  token,
  run(kind, row) {
    if (kind === "write") {
      const file = join(ROOT, row.files[0].path);
      writeFileSync(file, row.files[0].contents);
      return { ok: true };
    }
    const branch = row.branch;
    execFileSync("git", ["checkout", "-B", branch], { cwd: ROOT, stdio: "ignore" });
    execFileSync("git", ["add", "--", row.files[0].path], { cwd: ROOT, stdio: "ignore" });
    execFileSync("git", [
      "-c", "user.name=Tbaker-maker",
      "-c", "user.email=tylerrbakerr@gmail.com",
      "commit", "-m", row.title,
    ], { cwd: ROOT, stdio: "ignore" });
    execFileSync("git", ["push", "-u", "origin", branch], { cwd: ROOT, stdio: "ignore" });
    const out = execFileSync("gh", ["pr", "create", "--head", branch, "--base", "main", "--title", row.title, "--body", row.body], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return { ok: true, url: out.trim() };
  },
});

if (!result.opened) {
  await mkdir(join(ROOT, "data/derived"), { recursive: true });
  await writeFile(join(ROOT, "data/derived/drift-plan.json"), JSON.stringify({ plan, result }, null, 2) + "\n");
  console.log(JSON.stringify({ drift: true, opened: false, blocked: result.blocked }));
  process.exit(0);
}
console.log(JSON.stringify({ drift: true, opened: true, url: result.url }));
