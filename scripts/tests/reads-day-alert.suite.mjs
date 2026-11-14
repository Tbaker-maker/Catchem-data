import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readsDayAlerts } from "../lib/reads-day-alert.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  t("matching days pass", readsDayAlerts({ readsAsOf: "2026-11-14", sealedUpdatedAt: "2026-11-14T12:40:27.302Z", withheld: [] }).length === 0);
  const gap = readsDayAlerts({ readsAsOf: "2026-11-13", sealedUpdatedAt: "2026-11-14T12:40:27.302Z" });
  t("a 1-day gap alerts", gap.length === 1 && gap[0].includes("2026-11-13") && gap[0].includes("2026-11-14"));
  const held = readsDayAlerts({ readsAsOf: "2026-11-14", sealedUpdatedAt: "2026-11-14", withheld: [{ key: "reads", paths: ["research/assets/public/reads.json"] }] });
  t("a withheld reads group alerts", held.length === 1 && /withheld/.test(held[0]));
  const both = readsDayAlerts({ readsAsOf: "2026-11-13", sealedUpdatedAt: "2026-11-14", withheld: [{ key: "reads" }] });
  t("a gap and a withheld group both alert", both.length === 2);
  const guard = await readFile(join(ROOT, "scripts/schema-guard.mjs"), "utf8");
  t("the schema guard prints the reads day alert", /loadReadsDayAlerts/.test(guard) && /READS DAY/.test(guard));
  const exitAt = guard.indexOf("process.exit(1)");
  const alertAt = guard.indexOf("loadReadsDayAlerts");
  const problemsExit = guard.indexOf("if (problems.length)");
  t("the schema guard does not exit on the reads day alert", alertAt > 0 && problemsExit > alertAt && exitAt > problemsExit && !/readsAlerts\.length[\s\S]{0,200}process\.exit\(1\)/.test(guard));
  const wf = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  t("the feed rebuild stays one pass and still withholds on a crash", /node scripts\/build-feed\.mjs \|\| node scripts\/withhold-group\.mjs reads "rebuild: build-feed\.mjs crashed after the price commit"/.test(wf) && !/second pass crashed/.test(wf));
  return fail;
}
