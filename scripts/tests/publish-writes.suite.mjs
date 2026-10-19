import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assessWrites, checkPublishWrites, GAP_DAYS } from "../check-publish-writes.mjs";
import { publishLogo } from "../set-logo-index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };

  const reads = { reads: [{ id: "a" }] };
  const search = { items: [{ id: "a", name: "Pack" }, { id: "b", name: "Unpriced" }] };
  const index = {
    singles: GAP_DAYS.map((d) => ({ d, v: null, n: 0 })).concat([{ d: "2026-10-10", v: 100, n: 8 }]),
    sealed: GAP_DAYS.map((d) => ({ d, v: null, n: 0 })).concat([{ d: "2026-10-10", v: 100, n: 8 }]),
  };
  t("a real write passes", assessWrites({ reads, search, index }).length === 0);
  t("empty reads fails", assessWrites({ reads: { reads: [] }, search, index }).includes("reads wrote nothing"));
  t("empty search fails", assessWrites({ reads, search: { items: [] }, index }).includes("search wrote nothing"));
  t("an empty index fails", assessWrites({ reads, search, index: { singles: [], sealed: index.sealed } }).includes("index singles wrote nothing"));
  t("a filled gap fails", assessWrites({
    reads, search,
    index: { ...index, singles: index.singles.map((p) => p.d === "2026-09-28" ? { ...p, v: 100 } : p) },
  }).some((p) => p.includes("2026-09-28")));
  t("a zero price is not left unpriced", assessWrites({
    reads, index, search: { items: [{ id: "a", price: 0 }] },
  }).includes("unpriced was given a price"));
  t("a missing price key stays unpriced", assessWrites({
    reads, index, search: { items: [{ id: "a" }] },
  }).length === 0);

  t("catalogue logo is the set id path", publishLogo("base1", "https://images.pokemontcg.io/base1/logo.png")?.logo === "/img/base1/logo.png");
  t("a remote logo for another id is left off", publishLogo("base1", "https://images.pokemontcg.io/base2/logo.png") === null);
  t("a non-catalogue logo is left off", publishLogo("mee", "https://images.scrydex.com/pokemon/mee-logo/logo") === null);

  const workflow = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const flags = workflow.split("\n").filter((line) => /^\s*continue-on-error:\s*true\b/.test(line));
  // 31: the IR and SIR watch step (private scoring plus feed/ir-sir.json) is soft.
  t("the price workflow still has 31 continue-on-error flags", flags.length === 31, String(flags.length));
  const gateAt = workflow.indexOf("node scripts/check-publish-writes.mjs");
  const gateHead = workflow.slice(workflow.lastIndexOf("- name:", gateAt), gateAt)
    .split("\n").filter((line) => !line.trim().startsWith("#")).join("\n");
  t("an empty write fails the job", gateAt > 0 && !/continue-on-error/.test(gateHead));
  t("the price commit is still before the empty-write gate", workflow.indexOf("Commit price data") < gateAt);
  t("the gate names reads, search, and the index", workflow.includes("READS_OUTCOME") && workflow.includes("SEARCH_OUTCOME") && workflow.includes("INDEX_OUTCOME"));

  const logos = JSON.parse(await readFile(join(ROOT, "research/assets/public/set-logos.json"), "utf8"));
  const blob = JSON.stringify(logos);
  t("published set logos have no remote logo URL", !blob.includes("images.pokemontcg.io") && !blob.includes("images.scrydex.com"));
  t("set-logos.json has zero images.pokemontcg.io", !blob.includes("images.pokemontcg.io"));
  const rows = Object.values(logos.logos || {});
  t("every published logo is a catalogue path", rows.every((row) => {
    const id = row.logo === `/img/${row.setId}/logo.png` ? row.setId : row.parentSetId;
    return Boolean(id) && row.logo === `/img/${id}/logo.png` && row.src === row.logo;
  }));
  t("no published logo has an empty src", rows.every((row) => row.src));
  const live = await checkPublishWrites(ROOT);
  t("current reads, search, and index wrote", live.length === 0, live.join("; "));
  const empty = spawnSync(process.execPath, ["scripts/check-publish-writes.mjs"], {
    cwd: ROOT,
    env: { ...process.env, READS_OUTCOME: "failure" },
    encoding: "utf8",
  });
  t("an empty write exits non-zero", empty.status !== 0);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("publish-writes.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
