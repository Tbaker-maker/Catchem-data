// board-determinism.suite.mjs: the published board must be identical for identical inputs.
//
// Root cause (2026-10-11): writeExtra appended tonight's picks to feed/rotation.json,
// and cooledSet treated any row with on === asOf as "already shown". A second
// rebuild of the same asOf then cooled its own picks and the board shrank
// (3 rows, then 2, then 0). Only earlier nights may cool a card now, and
// rememberShown replaces tonight's rows instead of appending.
import { cp, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cooledSet, rememberShown, pickNight, mixRead, MIX_CLAUSE } from "../lib/night-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// data/history is read, not rewritten, by build-feed. Copying it plus
// node_modules pushed this suite over the 30 minute cap.
const LINKED = ["data/history", "node_modules"];

async function copyRepo(dir) {
  await cp(ROOT, dir, {
    recursive: true,
    filter: (src) => {
      if (src === ROOT) return true;
      if (src.startsWith(join(ROOT, ".git"))) return false;
      const rel = src.slice(ROOT.length + 1);
      return !LINKED.some((name) => rel === name || rel.startsWith(`${name}/`));
    },
  });
  for (const name of LINKED) {
    try { await symlink(join(ROOT, name), join(dir, name)); } catch { /* absent in this checkout */ }
  }
}

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

  {
    // Fake card and counts. Every phrasing of the condition mix names its unit.
    const fact = { printing: "Normal", mix: { from: "2026-01-01", to: "2026-01-07", conditions: [{ condition: "Near Mint", sold: 24 }, { condition: "Lightly Played", sold: 14 }, { condition: "Moderately Played", sold: 1 }] } };
    const lines = ["2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-11", "2026-01-12"].map((day) => mixRead(fact, { id: "tcgcsv-1", name: "Fake Card", set: "Fake Set" }, day)).filter(Boolean);
    t("a condition mix headline says listings counted in every phrasing", lines.length === 6 && lines.every((r) => /listings counted/.test(r.headline) && !/\bsold\b/i.test(r.headline) && r.why.endsWith(MIX_CLAUSE)));
  }
  // ── integration: run the nightly board build twice on a copy, compare ──
  if (process.env.SKIP_BOARD_REBUILD === "1") return fail;
  const dir = await mkdtemp(join(tmpdir(), "board-det-"));
  try {
    await copyRepo(dir);
    const files = ["research/assets/public/reads.json", "research/assets/public/feed/read-library.json", "research/assets/public/feed/rotation.json", "research/assets/public/feed/extra-reads.json"];
    const flag = JSON.parse(await readFile(join(dir, "data/flags.json"), "utf8"));
    t("fixture reads.library is a boolean", typeof flag.flags["reads.library"].value === "boolean");
    const snaps = [];
    for (let i = 0; i < 3; i += 1) {
      const started = Date.now();
      const r = spawnSync(process.execPath, [join(dir, "scripts/build-feed.mjs")], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, LEARNING_LOG: "", PPP_READS_NO_NET: "1" },
      });
      if (r.status !== 0) { t(`build-feed run ${i + 1} exits 0`, false, (r.stderr || r.stdout || "").slice(-400)); return fail; }
      console.log(`  build-feed run ${i + 1} ${Math.round((Date.now() - started) / 1000)}s`);
      snaps.push(await Promise.all(files.map((f) => readFile(join(dir, f), "utf8"))));
    }
    t("build-feed run 1 exits 0", true);
    // Run 1 may differ from the committed files (it is a fresh build); runs 2 and 3 must match run 1.
    files.forEach((f, k) => t(`${f} identical across rebuilds`, snaps[0][k] === snaps[1][k] && snaps[1][k] === snaps[2][k]));
    t("reads.json is unchanged across rebuilds", snaps[0][0] === snaps[1][0] && snaps[1][0] === snaps[2][0]);
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
