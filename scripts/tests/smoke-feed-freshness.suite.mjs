import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feedFreshnessVerdict } from "../lib/smoke-feed-freshness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.log("  FAIL", name); }
  };

  const fresh = feedFreshnessVerdict({ ageHours: 3.2 });
  t("a fresh pulse feed passes", fresh.fail === false && fresh.kind === "fresh" && fresh.message === "feed fresh (3.2h)");
  const pre = feedFreshnessVerdict({ ageHours: 301, prepublish: true });
  t("pre-publish skips the freshness fail", pre.fail === false && pre.kind === "prepublish" && /301h old; checked after/.test(pre.message));
  const stale = feedFreshnessVerdict({ ageHours: 301 });
  t("a stale pulse feed fails when published reads are unknown", stale.fail === true && stale.message === "301h old");
  const skipped = feedFreshnessVerdict({ ageHours: 301, publishedReadsAgeHours: 5.5 });
  t("a stale pulse feed passes when published reads are fresh", skipped.fail === false && skipped.kind === "pulse-skipped" && /published reads are 5.5h old/.test(skipped.message));
  const bothStale = feedFreshnessVerdict({ ageHours: 301, publishedReadsAgeHours: 60 });
  t("a stale pulse feed still fails when published reads are also stale", bothStale.fail === true);

  const src = await readFile(join(ROOT, "scripts/smoke-test.mjs"), "utf8");
  t("smoke-test uses the shared verdict", src.includes("feedFreshnessVerdict"));
  t("smoke-test reads published reads when the pulse feed is old", src.includes("readPublishedReadsAge") && src.includes("SMOKE_READS"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("smoke-feed-freshness.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("smoke feed freshness ok");
}
