import assert from "node:assert/strict";
import { toReads, guardLines } from "../lib/creator-talk-reads.mjs";
const good = { kind: "talking_about", product: "sv8pt5-etb", name: "Prismatic Evolutions Elite Trainer Box", productKind: "sealed",
  lines: ["Prismatic Evolutions came up on 2 tracked channels this week (2 videos).", "Prismatic Evolutions Elite Trainer Box: $133.25 on Oct 8, $129.49 on Oct 21 (-2.8%)."],
  priceSource: "TCGplayer market via TCGCSV",
  sources: [{ file: "f", row: "sv8pt5-etb", date: "2026-10-08", value: 133.25 }, { file: "f", row: "sv8pt5-etb", date: "2026-10-21", value: 129.49 }] };
const r = toReads({ version: 1, asOf: "2026-10-22", talkingAbout: [good] }, { asOf: "2026-10-22" });
assert.equal(r.reads.length, 1);
assert.deepEqual(guardLines(["buy now, sold out \u2014 NM box"], "sealed").length >= 3, true);
assert.equal(guardLines(["PokeBeard says up"], "sealed", ["PokeBeard"]).length, 1);
const bad = { ...good, lines: [good.lines[0], "Box: $999.00 on Oct 8"] };
assert.equal(toReads({ version: 1, asOf: "2026-10-22", talkingAbout: [bad] }).reads.length, 0);
assert.equal(toReads({ version: 1, asOf: "2026-10-01", talkingAbout: [good] }, { asOf: "2026-10-22" }).reads.length, 0);
console.log("creator-talk-reads ok");
