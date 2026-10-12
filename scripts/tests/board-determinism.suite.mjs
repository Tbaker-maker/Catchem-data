// board-determinism.suite.mjs: the published board must be identical for identical inputs.
//
// Root cause (2026-10-11): writeExtra appended tonight's picks to feed/rotation.json,
// and cooledSet treated any row with on === asOf as "already shown". A second
// rebuild of the same asOf then cooled its own picks and the board shrank
// (3 rows, then 2, then 0). Only earlier nights may cool a card now, and
// rememberShown replaces tonight's rows instead of appending.
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cooledSet, rememberShown, pickNight } from "../lib/night-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run() {
  let fail = 0;
  const t = (name, ok, detail = "") => {
    if (ok) console.log(`  ✓ ${name}`);
    else { fail++; console.error(`  ✗ ${name}${detail ? " : " + detail : ""}`); }
  };

  // ── unit: same-day rows never cool ──
  const asOf = "2026-10-11";
  const state = { shown: [{ id: "a", on: asOf, kind: "askmove" }, { id: "b", on: "2026-10-09", kind: "askmove" }] };
  const cooled = cooledSet(state, asOf);
  t("tonight's own picks do not cool tonight", !cooled.has("a"));
  t("an earlier night still cools", cooled.has("b"));
  const reads = [{ sku: "a", readKind: "askmove" }, { sku: "c", readKind: "spread" }];
  const once = rememberShown(state, reads, asOf);
  const twice = rememberShown(once, reads, asOf);
  t("rememberShown is idempotent for one asOf", JSON.stringify(once) === JSON.stringify(twice));
  const cand = ["x", "y", "z", "w"].map((s) => ({ id: `askmove-${s}`, sku: s, readKind: "askmove" }));
  const p1 = pickNight(cand, once, asOf).reads.map((r) => r.id).join();
  const p2 = pickNight(cand, rememberShown(once, cand, asOf), asOf).reads.map((r) => r.id).join();
  t("pickNight is the same after its picks are remembered", p1 === p2, `${p1} vs ${p2}`);

  // ── integration: run the nightly board build twice on a copy, compare ──
  if (process.env.SKIP_BOARD_REBUILD === "1") return fail;
  const dir = await mkdtemp(join(tmpdir(), "board-det-"));
  try {
    await cp(ROOT, dir, { recursive: true, filter: (src) => !src.includes(`${ROOT}/.git`) && !src.startsWith(join(ROOT, "node_modules")) });
    await cp(join(ROOT, "node_modules"), join(dir, "node_modules"), { recursive: true }).catch(() => {});
    const files = ["research/assets/public/reads.json", "research/assets/public/feed/read-library.json", "research/assets/public/feed/rotation.json", "research/assets/public/feed/extra-reads.json"];
    const beforeReads = await readFile(join(dir, files[0]), "utf8");
    const flag = JSON.parse(await readFile(join(dir, "data/flags.json"), "utf8"));
    t("fixture reads.library is a boolean", typeof flag.flags["reads.library"].value === "boolean");
    const snaps = [];
    for (let i = 0; i < 3; i += 1) {
      const r = spawnSync(process.execPath, [join(dir, "scripts/build-feed.mjs")], { cwd: dir, encoding: "utf8", env: { ...process.env, LEARNING_LOG: "" } });
      if (r.status !== 0) { t(`build-feed run ${i + 1} exits 0`, false, (r.stderr || "").slice(-400)); return fail; }
      snaps.push(await Promise.all(files.map((f) => readFile(join(dir, f), "utf8"))));
    }
    t("build-feed run 1 exits 0", true);
    // Run 1 may differ from the committed files (it is a fresh build); runs 2 and 3 must match run 1.
    files.forEach((f, k) => t(`${f} identical across rebuilds`, snaps[0][k] === snaps[1][k] && snaps[1][k] === snaps[2][k]));
    t("reads.json is unchanged across rebuilds", snaps[0][0] === snaps[1][0] && snaps[1][0] === snaps[2][0]);
    t("reads.json is unchanged from the fixture", snaps[0][0] === beforeReads);
    const board = JSON.parse(snaps[0][0]).reads || [];
    t("board count field matches the array", JSON.parse(snaps[0][0]).count === board.length || JSON.parse(snaps[0][0]).count == null);
    for (const row of board.filter((r) => r.readKind === "askmove")) {
      const rc = row.receipt || {};
      t(`${row.id} says ask and shows two dated asks`, /\bask\b/.test(row.path) && rc.from && rc.to && rc.from < rc.to && rc.askFrom > 0 && rc.askTo > 0);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("board-determinism.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
