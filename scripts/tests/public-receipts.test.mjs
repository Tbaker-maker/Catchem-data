import test from "node:test";
import assert from "node:assert/strict";
import { publicReceipts, scoreWatch } from "../lib/public-receipts.mjs";

const heat = [
  { id: "pgo-etb", date: "2026-08-19", price: 200 },
  { id: "pgo-etb", date: "2026-08-20", price: 239.22 },
  { id: "pgo-etb", date: "2026-08-21", price: 240 },
  { id: "sm11-booster-box", date: "2026-08-21", price: 4000 },
  { id: "sm11-booster-box", date: "2026-08-22", price: 4450 },
  { id: "sm11-booster-box", date: "2026-08-26", price: 4014.95 },
];

test("a rising print that keeps rising is a hit, and the reverse is a miss", () => {
  const rows = scoreWatch({
    entries: [
      { date: "2026-08-20", sealed: { name: "Pokemon GO Elite Trainer Box", price: 239.22, id: "pgo-etb" } },
      { date: "2026-08-22", sealed: { name: "Unified Minds Booster Box", price: 4450, id: "sm11-booster-box" } },
      { date: "2026-08-19", raw: { name: "Umbreon VMAX", price: 2244.47, id: "swsh7-215" } },
    ],
    heat,
  });
  const pub = publicReceipts(rows);
  assert.equal(pub.hits, 1);
  assert.equal(pub.misses, 1);
  assert.equal(pub.hitRate, null);
  assert.equal(pub.rows.find((r) => r.name.startsWith("Pokemon GO")).result, "hit");
  assert.match(pub.rows.find((r) => r.name.startsWith("Unified")).why, /The other way/);
  assert.equal(pub.rows.find((r) => r.name.startsWith("Umbreon")).result, "open");
  assert.doesNotMatch(JSON.stringify(pub.rows), /TCGplayer market|worth buying|asks/);
});
