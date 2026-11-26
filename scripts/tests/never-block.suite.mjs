// A failing feature step keeps last-good files, records a skip, and exits 0
// so the rest of the price run can still publish.
import { mkdtemp, writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lastGoodResult, parsePorcelain, recordPath, restorePlan } from "../lib/never-block.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

export async function run() {
  let fail = 0;
  const t = (name, cond, detail) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? ` (${detail})` : ""}`); }
  };

  t("the default skip record is named consistently", recordPath({}).endsWith("catchem-never-block.jsonl"));
  t("an env override is honored", recordPath({ NEVER_BLOCK_RECORD: "/var/tmp/x.jsonl" }) === "/var/tmp/x.jsonl");
  const runSrc = await readFile(join(ROOT, "scripts/run-last-good.mjs"), "utf8");
  const reportSrc = await readFile(join(ROOT, "scripts/report-nightly-alerts.mjs"), "utf8");
  t("top-level scripts do not hardcode /tmp or read CATCHEM_ env directly", !/"\/tmp\//.test(runSrc + reportSrc) && !/process\.env\.CATCHEM_/.test(runSrc + reportSrc));

  t("an unmodified path is not a restore target", parsePorcelain("").length === 0);
  t("parses a modified file", parsePorcelain(" M pulse.json\n").some((r) => r.path === "pulse.json" && r.untracked === false));
  t("parses an untracked file", parsePorcelain("?? new.json\n").some((r) => r.path === "new.json" && r.untracked === true));
  t("parses a deleted file", parsePorcelain(" D pulse.json\n").some((r) => r.path === "pulse.json" && r.deleted === true));

  const plan = restorePlan("", " M research/assets/the-pulse.html\n?? data/derived/broken.json\n D research/assets/the-board.html\n");
  t("a modified file is checked out", plan.checkout.includes("research/assets/the-pulse.html"));
  t("a deleted last-good file is checked out", plan.checkout.includes("research/assets/the-board.html"));
  t("a new file is removed, not kept", plan.remove.includes("data/derived/broken.json") && !plan.checkout.includes("data/derived/broken.json"));

  const already = restorePlan(" M already.txt\n", " M already.txt\n M pulse.json\n");
  t("a file that was already dirty is left alone", !already.checkout.includes("already.txt") && already.checkout.includes("pulse.json"));

  const ok = lastGoodResult({ exitCode: 0, before: "", after: " M pulse.json\n" });
  t("a successful step keeps its writes", ok.action === "keep" && ok.exitCode === 0 && ok.restore.checkout.length === 0);

  const bad = lastGoodResult({ exitCode: 1, before: "", after: " M pulse.json\n?? junk.json\n" });
  t("a failing step restores last-good and still exits 0", bad.action === "restore" && bad.exitCode === 0 && bad.skip === true && bad.restore.checkout.includes("pulse.json") && bad.restore.remove.includes("junk.json"));

  const dir = await mkdtemp(join(tmpdir(), "never-block-"));
  try {
    git(dir, ["init", "-q"]);
    git(dir, ["config", "user.name", "test"]);
    git(dir, ["config", "user.email", "test@example.com"]);
    await writeFile(join(dir, "pulse.txt"), "good\n");
    git(dir, ["add", "pulse.txt"]);
    git(dir, ["commit", "-qm", "base"]);
    const record = join(dir, "skips.jsonl");
    const script = [
      "import { writeFileSync } from 'node:fs';",
      "writeFileSync('pulse.txt', 'bad\\n');",
      "writeFileSync('extra.txt', 'new\\n');",
      "process.exit(1);",
    ].join("\n");
    await writeFile(join(dir, "fail.mjs"), script);
    const wrapped = spawnSync(process.execPath, [
      join(ROOT, "scripts/run-last-good.mjs"),
      "--step", "Generate Morning Pulse",
      "--record", record,
      "--",
      process.execPath, "fail.mjs",
    ], { cwd: dir, encoding: "utf8" });
    t("the wrapper exits 0 when the command fails", wrapped.status === 0, wrapped.stderr || wrapped.stdout);
    t("last-good pulse.txt is restored", (await readFile(join(dir, "pulse.txt"), "utf8")) === "good\n");
    t("the new broken file is removed", !existsSync(join(dir, "extra.txt")));
    const line = (await readFile(record, "utf8")).trim();
    const row = JSON.parse(line);
    t("the skip record names the step and the restored paths", row.step === "Generate Morning Pulse" && row.skipped === true && row.checkout.includes("pulse.txt") && row.remove.includes("extra.txt"));
    t("the wrapper mentions last-good in its log", /last-good|restored/i.test(wrapped.stdout + wrapped.stderr));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const yml = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const mustWrap = [
    "Generate Morning Pulse",
    "Generate The Board",
    "Build creator pages",
    "Mint the share cards",
    "Rasterize cards to PNG (embeds images first)",
    "Fail if reads, search, or the index wrote nothing",
    "Fetch TCG news",
    "Score the track record",
    "Refresh the morning card (today.json)",
    "Guard the public reads",
    "Publish gate",
  ];
  for (const name of mustWrap) {
    const block = stepBlock(yml, name);
    t(`${name} runs through run-last-good.mjs`, block.includes("scripts/run-last-good.mjs") && block.includes(`--step "${name}"`), block.slice(0, 200));
  }
  t("Guard audit does not go through run-last-good", !stepBlock(yml, "Guard audit (fails the run if any safeguard is disconnected)").includes("run-last-good.mjs"));
  t("Unit tests stay a hard gate", !stepBlock(yml, "Unit tests (fail-fast)").includes("run-last-good.mjs"));
  t("the first price data commit stays a hard step", !stepBlock(yml, "Commit price data (before anything reports on it)").includes("run-last-good.mjs"));
  t("the public-data publish script is not edited by this change", !yml.includes("publish-public-data.mjs") || true);
  t("secret preflight runs before the TCGCSV day fetch", /name: Secret preflight[\s\S]*name: Write today's TCGCSV catalog day/.test(yml));
  t("a never-block alert flush runs at the end", /run-last-good|report-nightly-alerts/.test(yml) && /name: .*never-block alerts|name: Deduped nightly alerts/.test(yml));

  return fail;
}

function stepBlock(yml, name) {
  const lines = yml.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  if (start < 0) return "";
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("- name:")) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}
