// Shell tokens on a git add line are not promised artifacts.
// A missing path is still a promise, so a real gap stays blocking.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectGitAddPaths } from "../lib/git-add-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function pathsIn(src) {
  const out = [];
  for (const match of String(src).matchAll(/git add ([^\n]+)/g)) {
    out.push(...collectGitAddPaths(match[1]));
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const logoLine = "research/assets/img/*/logo.png || true";
  const logoPaths = collectGitAddPaths(logoLine);
  t("|| is not a promised path", !logoPaths.includes("||"));
  t("true is not a promised path", !logoPaths.includes("true"));
  t("the logo glob on that line is still promised", logoPaths.length === 1 && logoPaths[0] === "research/assets/img/*/logo.png");

  const mixed = pathsIn(`
    git add research/assets/img/*/logo.png || true
    git add data/not-written.json || true
    git add data/sealed-prices.json
    git add grades-*.json; fi
  `);
  t("a missing output stays on the promise list", mixed.includes("data/not-written.json"));
  t("a real output stays on the promise list", mixed.includes("data/sealed-prices.json"));
  t("fi after a semicolon is not a path", !mixed.includes("fi"));
  t("shell tokens never enter the mixed list", !mixed.includes("||") && !mixed.includes("true") && !mixed.includes("false"));

  const sealed = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const live = pathsIn(sealed);
  t("the sealed workflow does not promise ||", !live.includes("||"));
  t("the sealed workflow does not promise true", !live.includes("true"));
  t("the sealed workflow still promises sealed-prices.json", live.includes("data/sealed-prices.json"));
  t("the sealed workflow still promises the logo glob", live.includes("research/assets/img/*/logo.png"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("artifact-freshness.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
