// Proof windows and held price shapes. Limits in the assertions are the
// measured shape of the fixture, not the private bar.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { headlineFromDate, holdWindow, proofAgrees, resetHoldLimitLog, stampHistReceipt } from "../lib/read-proof.mjs";
import { findings, validSynth } from "../lib/read-synthesis.mjs";
import { speakDates } from "../lib/read-quality.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

const asOf = "2026-10-30";
const dragonite = [];
for (let day = 3; day <= 28; day += 1) dragonite.push([`2026-10-${String(day).padStart(2, "0")}`, 524.89]);
dragonite.push(["2026-10-29", 233.20], ["2026-10-30", 418.55]);

export async function run() {
  t("empty history is not a signal", holdWindow([], "2026-10-23", asOf, { flatDays: 1, jumpPct: 1 }).hold === false && holdWindow([], "2026-10-23", asOf, { flatDays: 1, jumpPct: 1 }).reason === "empty history");
  // Another suite in this process may already have logged the one line.
  holdWindow(dragonite, "2026-10-23", asOf, null);
  resetHoldLimitLog();
  const missed = [];
  const log = console.error;
  console.error = (...args) => { missed.push(args.join(" ")); };
  const heldMissing = holdWindow(dragonite, "2026-10-23", asOf, null);
  const heldAgain = holdWindow(dragonite, "2026-10-23", asOf, {});
  console.error = log;
  t("missing private limits holds the read", heldMissing.hold === true && heldMissing.reason === "no private limits" && heldAgain.hold === true);
  t("missing private limits logs one line", missed.length === 1 && missed[0] === "read hold: private limits were not loaded, so the read is held");

  const seen = holdWindow(dragonite, "2026-10-23", asOf, { flatDays: 1, jumpPct: 0.1 });
  t("Dragonite ex week touches the Oct 3 to 28 freeze and a one-day jump", seen.flatDays >= 26 && seen.jumpPct > 50 && seen.hold === true);
  t("the same week is held at its own measured bar", holdWindow(dragonite, "2026-10-23", asOf, { flatDays: seen.flatDays, jumpPct: seen.jumpPct }).hold === true);
  t("a stricter bar than this series does not fire", holdWindow(dragonite, "2026-10-23", asOf, { flatDays: seen.flatDays + 1, jumpPct: seen.jumpPct + 1 }).hold === false);

  const smooth = [];
  for (let day = 23; day <= 30; day += 1) smooth.push([`2026-10-${String(day).padStart(2, "0")}`, Math.round((400 + (day - 23) * 2) * 100) / 100]);
  t("a smooth week is not held", holdWindow(smooth, "2026-10-23", asOf, { flatDays: seen.flatDays, jumpPct: seen.jumpPct }).hold === false);

  const cfg = validSynth(JSON.parse(readFileSync(new URL("./fixtures/read-synthesis-limits.json", import.meta.url), "utf8")));
  const item = { id: "tcgcsv-84918", title: "Dragonite ex (EX Dragon) 90/97", pts: dragonite, asOf, set: "EX Dragon", release: "2003-11-24", sealed: false, kind: "deep:slump" };
  const openBar = { flatDays: seen.flatDays + 1, jumpPct: seen.jumpPct + 1 };
  const open = findings(item, { peers: new Map() }, cfg, openBar).some((row) => /\bin a week\b/.test(row.text || ""));
  const held = findings(item, { peers: new Map() }, cfg, { flatDays: seen.flatDays, jumpPct: seen.jumpPct }).some((row) => /\bin a week\b/.test(row.text || ""));
  t("Dragonite ex would have said down in a week", open === true);
  t("Dragonite ex week is held once the shape bar is applied", held === false);

  const charizard = {
    name: "M Charizard EX (Evolutions) 13/108",
    headline: "Down 50% on the year: M Charizard EX (Evolutions) 13/108 went from $76.71 on Oct 30, 2025 to $38.25 on Oct 30, and is down 2% over 7 days, down 3% over 30 days and down 13% over 90 days. It is still 64% under its peak of $106.62 on Sep 18, 2025.",
    startDate: "2025-05-22",
    endDate: asOf,
    asOf,
    source: "TCGplayer market (tcgcsv daily archive and our nightly days), 2025-05-22 and 2026-10-30",
    board: "hist",
    kind: "backto",
    readKind: "backto",
  };
  t("the year headline starts Oct 30, 2025", headlineFromDate(charizard.headline, asOf) === "2025-10-30");
  t("M Charizard EX proof does not match the year headline", proofAgrees(charizard) === false);
  const aligned = { ...charizard, startDate: "2025-10-30", source: "TCGplayer market, 2025-10-30 and 2026-10-30" };
  t("M Charizard EX agrees when the proof window is the headline window", proofAgrees(aligned) === true);

  const hist = { board: "hist", readKind: "year", kind: "year", startDate: "2025-10-30", endDate: asOf, asOf, source: "TCGplayer market, 2025-10-30 and 2026-10-30" };
  const spoken = { ...hist, source: speakDates(hist.source, asOf) };
  const boardOk = (row) => row.board === "hist" && row.kind === row.readKind && /^\d{4}-\d{2}-\d{2}$/.test(String(row.startDate || "")) && row.endDate === row.asOf && String(row.source || "").includes(row.startDate);
  t("a spoken receipt fails the board test", boardOk(spoken) === false);
  t("stamping the receipt makes that board test pass", boardOk(stampHistReceipt(spoken)) === true);

  const nightly = await readFile(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
  const pr = await readFile(new URL("../../.github/workflows/pr-tests.yml", import.meta.url), "utf8");
  t("the nightly does not retry a red test", !nightly.includes("retrying to rule out a flake") && nightly.includes("Not retrying and not publishing."));
  t("a red night opens Nightly run failed", nightly.includes("scripts/nightly-issue.mjs") && (await readFile(new URL("../nightly-issue.mjs", import.meta.url), "utf8")).includes("Nightly run failed"));
  const rebuildAt = pr.indexOf("step build-public-bundle.mjs");
  const feedAt = pr.indexOf("step build-feed.mjs");
  const testAt = pr.indexOf("node scripts/tests/run-tests.mjs");
  t("a pull request rebuilds the bundle before the suites", rebuildAt > 0 && feedAt > rebuildAt && testAt > feedAt);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-proof.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
