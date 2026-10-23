// Guard: stale data must never block the run that refreshes it (Oct 20 to 22, 2026).
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { freshnessExit } from "../lib/health-status.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const behind = "data/sealed-prices.json is 3 days behind 2026-10-22";
  const noDate = "data/x.json has no date";
  const future = "data/y.json is dated 2026-10-25, after the nightly date 2026-10-22";
  t("strict by default", freshnessExit([behind], {}).fail.length === 1);
  const w = freshnessExit([behind, noDate, future], { FEED_FRESHNESS_WARN_ONLY: "1" });
  t("warn mode only warns on days behind", w.warn.length === 1 && w.warn[0] === behind);
  t("warn mode still fails a missing date", w.fail.includes(noDate));
  t("warn mode still fails a future date", w.fail.includes(future));
  t("no nightly date still fails", freshnessExit(["no nightly date"], { FEED_FRESHNESS_WARN_ONLY: "1" }).fail.length === 1);

  const wf = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const steps = wf.split(/\n      - name: /).slice(1);
  const strictAt = steps.findIndex((s) => s.startsWith("Freshness check after the refresh"));
  t("a strict freshness check runs after the refresh", strictAt > 0 && /write-health\.mjs/.test(steps[strictAt]));
  const commitAt = steps.findIndex((s) => s.startsWith("Commit updated prices"));
  t("the strict check comes after the price commit", commitAt >= 0 && strictAt > commitAt);
  t("a final step turns the run red if still stale", steps.some((s) => s.startsWith("Still stale after the refresh") && /exit 1/.test(s)));
  steps.forEach((s, i) => {
    if (i < strictAt && /node scripts\/build-feed\.mjs/.test(s)) {
      t(`feed build in "${s.split("\n")[0]}" warns on staleness`, /FEED_FRESHNESS_WARN_ONLY: "1"/.test(s));
    }
  });
  t("eBay fetch never gates the run", steps.some((s) => s.startsWith("Fetch sealed prices from eBay") && /continue-on-error: true/.test(s)));
  return fail;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const f = await run();
  if (f) process.exit(1);
}
