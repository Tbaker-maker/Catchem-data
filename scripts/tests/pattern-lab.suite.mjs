import { oneCount, promotePatterns } from "../lib/pattern-lab.mjs";

function rowsFor(pattern, hits, misses, episodeStart = 1) {
  const out = [];
  for (let i = 0; i < hits + misses; i++) {
    out.push({ episode: `e${episodeStart + i}`, cardId: `c${episodeStart + i}`, pattern, hit: i < hits });
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const doubled = oneCount([
    { episode: "e1", cardId: "c1", pattern: "spike", hit: true },
    { episode: "e1", cardId: "c1", pattern: "spike", hit: true },
  ]);
  t("one card in one episode is counted once", doubled.kept.length === 1 && doubled.duplicates === 1);

  const noise = rowsFor("noise", 10, 10);
  const edge = rowsFor("edge", 19, 1, 100);
  const result = promotePatterns([...noise, ...edge]);
  const promoted = result.promoted.map((row) => row.pattern);
  t("a pattern with at least a 5 point edge can be promoted", promoted.includes("edge") && result.promoted.find((row) => row.pattern === "edge").edge >= 5);
  t("a pattern without that edge is not promoted", !promoted.includes("noise"));

  const duped = [
    ...rowsFor("edge", 16, 4, 100),
    { episode: "e100", cardId: "c100", pattern: "edge", hit: true },
  ];
  const again = promotePatterns(duped);
  t("a repeated card does not raise the count", again.duplicates === 1 && again.tested.find((row) => row.pattern === "edge").n === 20);

  const weak = promotePatterns(rowsFor("tiny", 2, 0, 1).concat(rowsFor("rest", 10, 10, 50)));
  t("a tiny lead does not skip the false-discovery check", weak.promoted.every((row) => row.fdr));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("pattern-lab.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
