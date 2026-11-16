import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogueEditionFreshness } from "../lib/catalogue-edition.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function catalogue(n, lastSeen) {
  const products = Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    dataStatus: "live",
    priceMedian: 10 + i,
    lastSeen: typeof lastSeen === "function" ? lastSeen(i) : lastSeen,
  }));
  return { products };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.log("  FAIL", name); }
  };

  const noonOn = (day) => Date.parse(`${day}T12:00:00Z`);
  const rehearsalNow = Date.parse("2026-11-12T02:40:00Z");

  t("all live products seen today are ok", catalogueEditionFreshness(catalogue(20, "2026-11-12"), noonOn("2026-11-12")).status === "ok");
  const stale = catalogueEditionFreshness(catalogue(20, "2026-11-10"), rehearsalNow);
  t("rehearsal case: lastSeen all 2026-11-10 at 2026-11-12T02:40Z is stale", stale.status === "stale" && stale.ageDays === 2 && stale.newest === "2026-11-10");
  t("a catalogue with fewer than 20 live rows is skipped", catalogueEditionFreshness(catalogue(19, "2020-01-01"), rehearsalNow).status === "skip");
  const half = catalogue(20, (i) => (i < 10 ? "2026-11-12" : "2026-11-10"));
  const partial = catalogueEditionFreshness(half, noonOn("2026-11-12"));
  t("only 50% on the newest day is a partial fetch", partial.status === "partial" && partial.pct === 50);
  const mostly = catalogue(20, (i) => (i < 16 ? "2026-11-12" : "2026-11-10"));
  t("80% on the newest day is ok", catalogueEditionFreshness(mostly, noonOn("2026-11-12")).status === "ok");

  const pulse = await readFile(join(ROOT, "scripts/generate-pulse.mjs"), "utf8");
  t("pulse checks catalogue freshness before writing", pulse.includes("catalogueEditionFreshness"));
  t("pulse exits 0 when the catalogue is stale or partial", /edition\.status === "stale"[\s\S]*process\.exit\(0\)/.test(pulse));
  t("a thin catalogue does not get today's date", /edition\.status === "skip"/.test(pulse) && /THIN CATALOGUE/.test(pulse));
  const assertSrc = await readFile(join(ROOT, "scripts/publish-assert.mjs"), "utf8");
  t("publish-assert still names STALE EDITION", /STALE EDITION/.test(assertSrc));
  t("publish-assert still exits 1 on stale or partial", /status === "stale"[\s\S]*process\.exit\(1\)[\s\S]*status === "partial"[\s\S]*process\.exit\(1\)/.test(assertSrc));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("catalogue-edition.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("catalogue edition ok");
}
