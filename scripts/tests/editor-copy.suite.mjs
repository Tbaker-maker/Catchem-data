// The Post Office editor's generated lines obey the shared copy rules, dashes included.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail += 1; };
  const r = spawnSync(process.execPath, [join(ROOT, "scripts/editor-copy-rules.mjs")], { cwd: ROOT, encoding: "utf8", timeout: 240000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const dashes = out.split("\n").filter((l) => /rule dash matched/.test(l));
  t("the editor check ran", /checked \d+ generated strings/.test(out), out.slice(-300));
  t("no generated Post Office line has an em or en dash", dashes.length === 0, dashes.slice(0, 3).join(" | "));
  const advice = out.split("\n").filter((l) => /rule (?!dash)[\w-]+ matched/.test(l));
  t("no generated Post Office line breaks an advice rule", advice.length === 0, advice.slice(0, 3).join(" | "));
  // Creator names never reach the published editor (build.html and the line engine it ships).
  const { readFileSync } = await import("node:fs");
  const handles = (JSON.parse(readFileSync(join(ROOT, "data/observed-accounts.json"), "utf8")).accounts || []).map((a) => a.handle).filter(Boolean);
  const shipped = readFileSync(join(ROOT, "research/assets/build.html"), "utf8") + readFileSync(join(ROOT, "scripts/line-engine.js"), "utf8");
  const leaked = [...handles, "Crambo"].filter((h) => shipped.toLowerCase().includes(h.toLowerCase()));
  t("no watched creator name is in build.html or line-engine.js", leaked.length === 0, leaked.join(", "));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("editor-copy.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
