// Slots only. They publish nothing until RD writes KEEP or DROP.
// reads.library stays the one switch, and it is off. These slots do not flip it.

import { checkDetector } from "./shape.mjs";

function slot(id, inputs, rule) {
  return checkDetector({
    id,
    inputs,
    rule,
    minimums: { publish: false },
    copy: "No sentence until RD rules KEEP.",
    take: () => [],
    wrongIf: "A slot that returns a row before RD rules KEEP.",
    gate: "reads.library",
    status: "waiting-rd",
  });
}

export const SLOTS = [
  slot("supply", ["data/supply-watch.json"], "Listing counts. Not sales. Flag supply.leadReads is already off."),
  slot("sealed-vs-singles", ["data/sealed-products.json", "tcgcsv daily series"], "Sealed against the singles in the same set. Needs an RD rule."),
  slot("group-lag", ["feed/extra-reads.json group.reads"], "Group lag already boards inside set when the extra file has a proved row. This slot adds no second row."),
  slot("set-heat", ["data/heat-report.json"], "Set heat from files already saved. No new sentence yet."),
  slot("release", ["data/release-radar.json"], "Release rows already have a function. They board only when reads.library is on."),
];
