import { publishScores, scoreRead } from "../lib/read-scorer.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const small = scoreRead({ id: "spike|7", hits: 4, n: 5 });
  t("a sample under 20 is scored and not published", small.hitRate === 0.8 && small.published === false);
  const ready = scoreRead({ id: "climb|30", hits: 12, n: 20 });
  t("hit rate is hits over the sample", ready.hitRate === 0.6 && ready.published === true);
  const bad = scoreRead({ id: "x", hits: 8, n: 3 });
  t("more hits than the sample is not a rate", bad.hitRate == null && bad.published === false);
  const published = publishScores([small, ready, { id: "", hits: 0, n: 0 }]);
  t("only the large sample is published", published.length === 1 && published[0].id === "climb|30" && published[0].n === 20);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-scorer.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
