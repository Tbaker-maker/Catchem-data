// These do not read an eBay file. They only name rows the price library already boarded.
// eBay listing rows stay out of new reads.

import { checkDetector } from "./shape.mjs";

function slice(kind) {
  return (lib) => (lib?.board || []).filter((row) => row && row.signal === kind);
}

function det(id, rule, minimums, wrongIf) {
  return checkDetector({
    id,
    inputs: ["feed/extra-reads.json"],
    rule,
    minimums,
    copy: "The sentence already on the boarded row. An ask is a listing price. A listing is not a sale.",
    take: slice(id),
    wrongIf,
    gate: null,
  });
}

export const ASK_DETECTORS = [
  det(
    "spread",
    "At most one. The receipt high ask is at least twice the low ask.",
    { cap: 1, highAtLeast: "2x low" },
    "Wrong if the receipt prices are not the ones on those dates.",
  ),
  det(
    "askmove",
    "At most one. The ask changed by at least $1.00. The market price did not.",
    { cap: 1, minCents: 100 },
    "Wrong if the receipt prices are not the ones on those dates.",
  ),
  det(
    "mktmove",
    "At most one. The market price changed by at least $1.00. The ask did not.",
    { cap: 1, minCents: 100 },
    "Wrong if the receipt prices are not the ones on those dates.",
  ),
];
