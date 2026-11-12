// PR tests compared with the base commit (scripts/lib/test-baseline.mjs).
import { compareToBase } from "../lib/test-baseline.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };
  const log = (...suites) => [
    "── feature suites ──",
    ...suites.flatMap(([suite, inner]) => [...inner.map((n) => `  FAIL ${n}`), `  ✗ ${suite} — ${inner.length || 1} failed`]),
    "",
    `10 passed · ${suites.length} failed`,
  ].join("\n");
  const stale = ["rip-roi.suite.mjs", ["published Evolving Skies box uses the catalog mean"]];
  const base = log(stale);

  let r = compareToBase(log(stale), base);
  t("a failure main already has does not block", r.fresh.length === 0 && r.known.length === 1);

  r = compareToBase(log(stale, ["price-trust.suite.mjs", ["a held price never ships"]]), base);
  t("a new failing test blocks", r.fresh.length === 1 && /a held price never ships/.test(r.fresh[0]));

  r = compareToBase(log(["rip-roi.suite.mjs", ["published Evolving Skies box uses the catalog mean", "rip value is never negative"]]), base);
  t("a new test in an already red suite still blocks", r.fresh.length === 1 && /never negative/.test(r.fresh[0]) && r.known.length === 1);

  r = compareToBase(log(stale), "── x ──\n  FAIL published Evolving Skies box uses the catalog mean\n");
  t("an unfinished base log is no baseline", r.baseFinished === false && r.fresh.length === 1);

  r = compareToBase("── x ──\n  ✓ a\n", base);
  t("an unfinished PR log blocks", r.prFinished === false && r.fresh.length === 1);

  r = compareToBase(log(["health-status.suite.mjs", ["reader files are within 2 days of the nightly date on counts.json"]]), "── x ──\n\n10 passed · 0 failed");
  t("freshness only failures never block a PR", r.fresh.length === 0 && r.known.length === 0);

  r = compareToBase(log(["copy.suite.mjs", ["copy check blocks an em dash"]]), log(["copy.suite.mjs", ["copy check blocks an em dash"]]));
  t("a safety test red on main is still only known, named in the summary", r.fresh.length === 0 && r.known.length === 1);

  r = compareToBase("── a ──\n  ✗ price trust suite — 3 failed\n\n9 passed · 1 failed", "── a ──\n  ✗ price trust suite — 1 failed\n\n9 passed · 1 failed");
  t("a suite with no inner names matches on the suite name", r.fresh.length === 0 && r.known.length === 1);
  return fail;
}
