// Price detectors do not recompute the board. They read the library buildReadLibrary already made.

import { checkDetector } from "./shape.mjs";

function slice(kind) {
  return (lib) => (lib?.board || []).filter((row) => row && row.signal === kind);
}

function det(id, rule, minimums, copy, wrongIf) {
  return checkDetector({
    id,
    inputs: ["feed/catalogue.json", "tcgcsv daily series", "exact day file set"],
    rule,
    minimums,
    copy,
    take: slice(id),
    wrongIf,
    gate: null,
  });
}

export const PRICE_DETECTORS = [
  det(
    "mover",
    "7-day pair on the exact start file and the asOf file. Move at least $1.00 and at least 8%, and under 200%.",
    { windowDays: 7, minCents: 100, minPct: 8, maxPct: 200, typeCap: 2, oneUp: 1, oneDown: 1 },
    "TCGplayer market: end price, from start price, with the dollar change and the percent.",
    "Wrong if either date has a different market price, or the start file is missing.",
  ),
  det(
    "set",
    "A lag or group row already on the extra file, with both series on the exact start and end dates.",
    { windowDays: 30, typeCap: 2 },
    "The set sentence already on that row.",
    "Wrong if the pack or the box has no price on the start date.",
  ),
  det(
    "high",
    "6-month high only when the series spans at least 150 days and the latest price is the high.",
    { minSpanDays: 150, typeCap: 2 },
    "TCGplayer market on the two dates of the proved window.",
    "Wrong if the latest price is not the high on the dates checked.",
  ),
  det(
    "streak",
    "At least 4 consecutive days in the daily files, each day present, and at least $1.00 from the first day to the last.",
    { minDays: 4, minCents: 100, typeCap: 2 },
    "TCGplayer market on the first day of the run and on asOf.",
    "Wrong if a day in the run is missing or a step went the other way.",
  ),
  det(
    "plain",
    "Counted when a 7-day move is under 8%. Not boarded. boardDrop drops kind plain.",
    { windowDays: 7, maxPct: 8, boarded: 0 },
    "Not published.",
    "A plain price read on the board would be wrong.",
  ),
  det(
    "low",
    "Counted when a 6-month low proves. Boarded stays 0.",
    { boarded: 0 },
    "Not published.",
    "A low on the board would be wrong until a type cap is added on purpose.",
  ),
];
