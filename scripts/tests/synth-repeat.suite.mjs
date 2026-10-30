// The headline join must not say the same 30 day move twice.
// The why line names the two dates when it has them.
import { compose } from "../lib/read-synthesis.mjs";
import { whyPlain } from "../lib/read-quality.mjs";

const cfg = { minSignals: 2, maxOpeningShare: 1, weights: { kind: 1 } };

function count(hay, needle) {
  let n = 0;
  let i = 0;
  const s = String(hay || "");
  while ((i = s.indexOf(needle, i)) !== -1) {
    n += 1;
    i += needle.length;
  }
  return n;
}

function joined(lead, support) {
  const item = { title: "Delta Reign Booster Bundle", sealed: true };
  return compose(item, [lead, ...support], cfg, null);
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const lead = {
    tag: "trend",
    score: 10,
    text: "Down 12% in a week: Delta Reign Booster Bundle went from $80.00 on Sep 28 to $55.83 on Oct 26, and is down 32% over 30 days.",
    short: "Over time it is down 12% over 7 days and down 32% over 30 days, to $55.83 on Oct 26.",
  };
  const streak = {
    tag: "streak",
    score: 2,
    text: "Lower for 4 weeks running: Delta Reign Booster Bundle moved from $70.00 on Sep 28 to $55.83 on Oct 26.",
    short: "It has closed lower 4 weeks running, from $70.00 on Sep 28.",
  };
  const peers = {
    tag: "peers",
    score: 1,
    text: "Behind its set: Delta Reign Booster Bundle is down 32% over 30 days against a -1.6% median for 40 Mega Evolution items priced $5 or more.",
    short: "Over 30 days it is down 32%, trailing a -1.6% median for 40 Mega Evolution items priced $5 or more.",
  };
  const out = joined(lead, [streak, peers]);
  const text = out?.text || "";
  t("headline keeps one down 32% over 30 days", out && count(text, "down 32% over 30 days") === 1);
  t("headline does not repeat the over 30 days clause", count(text, "Over 30 days it is down 32%") === 0);
  t("headline still names the set comparison", text.endsWith("Trailing a -1.6% median for 40 Mega Evolution items priced $5 or more."));
  t("the week streak stays", text.includes("It has closed lower 4 weeks running, from $70.00 on Sep 28."));

  const wide = {
    tag: "peers",
    score: 1,
    text: "Behind its set: Delta Reign Booster Bundle is down 32% over 30 days against a -1.6% median for 40 items.",
    short: "That trails its set over 30 days: down 32% against a -1.6% median for 40 items.",
  };
  const wideText = joined(lead, [wide])?.text || "";
  t("a wide set gap keeps the comparison once", wideText.endsWith("Trailing a -1.6% median for 40 items.") && count(wideText, "down 32% over 30 days") === 1);

  const upLead = {
    tag: "trend",
    score: 10,
    text: "Up 40% in 30 days: Example went from $10.00 on Sep 26 to $14.00 on Oct 26, and is up 32% over 30 days.",
    short: "Over time it is up 32% over 30 days.",
  };
  const beats = {
    tag: "peers",
    score: 1,
    text: "Ahead of its set: Example is up 32% over 30 days against a -1.6% median for 40 items.",
    short: "That beats its set over 30 days: up 32% against a -1.6% median for 40 items.",
  };
  const beatText = joined(upLead, [beats])?.text || "";
  t("a beat keeps ahead of the set once", beatText.endsWith("Ahead of a -1.6% median for 40 items.") && count(beatText, "up 32% over 30 days") === 1);

  const quietLead = {
    tag: "streak",
    score: 5,
    text: "Lower for 4 weeks running: Delta Reign Booster Bundle moved from $70.00 on Sep 28 to $55.83 on Oct 26.",
    short: "It has closed lower 4 weeks running.",
  };
  const keptText = joined(quietLead, [peers])?.text || "";
  t("a move said only once stays whole", keptText.includes(peers.short));

  t("Delta Reign why names Oct 5 to Oct 26", whyPlain(78.83, 55.83, "2026-10-05", "2026-10-26") === "Down $23.00 from Oct 5 to Oct 26.");
  t("why without dates does not invent them", whyPlain(78.83, 55.83) === "Down $23.00 on those two dates.");
  t("no em or en dash in the headline or why", !/[\u2014\u2013]/.test(`${text} ${wideText} ${beatText} ${keptText}`) && !/\b(?:sold|sales)\b/i.test(text));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("synth-repeat.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
