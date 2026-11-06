import test from "node:test";
import assert from "node:assert/strict";
import { foldReceipts } from "../lib/private-receipts-store.mjs";
import { gradeRead } from "../lib/receipts.mjs";

const prior = {
  asOf: "2026-10-30",
  scored: 20,
  hits: 1,
  misses: 19,
  hitRate: 5,
  rows: [{ id: "receipt-2026-09-26-sealed-cel25-upc", result: "miss", name: "Celebrations Ultra Premium Collection" }],
};
const next = {
  asOf: "2026-11-06",
  scored: 21,
  hits: 2,
  misses: 19,
  hitRate: 9.5,
  rows: [...prior.rows, { id: "receipt-2026-11-06-sealed-pgo-etb", result: "hit", name: "Pokemon GO Elite Trainer Box" }],
};

test("an empty log copies the public history, then appends the new run", () => {
  const folded = foldReceipts("", next, prior);
  const lines = folded.text.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), prior);
  assert.deepEqual(JSON.parse(lines[1]), next);
  assert.equal(folded.appended, true);
});

test("a second write does not drop or rewrite the first line", () => {
  const first = foldReceipts("", next, prior);
  const again = foldReceipts(first.text, next, prior);
  const lines = again.text.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], first.text.trim().split("\n")[0]);
  assert.equal(again.appended, false);
});

test("a public stub with no rows is not treated as history", () => {
  const stub = { asOf: "2026-11-06", scored: 0, hits: 0, misses: 0, hitRate: null, rows: [] };
  const folded = foldReceipts("", next, stub);
  const lines = folded.text.trim().split("\n");
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), next);
});

test("accuracy history appends on its own log and does not rewrite the receipts line", () => {
  const receipts = foldReceipts("", next, prior);
  const accuracyPrior = {
    asOf: "2026-10-30",
    scored: 20,
    hits: 1,
    misses: 19,
    hitRate: 5,
    rows: [{ name: "Celebrations Ultra Premium Collection", result: "miss", date: "2026-09-27" }],
  };
  const accuracyNext = {
    ...accuracyPrior,
    asOf: "2026-11-06",
    rows: [...accuracyPrior.rows, { name: "Pokemon GO Elite Trainer Box", result: "hit", date: "2026-11-06" }],
  };
  const acc = foldReceipts("", accuracyNext, accuracyPrior);
  const again = foldReceipts(acc.text, accuracyNext, accuracyPrior);
  assert.equal(receipts.text.trim().split("\n")[0], JSON.stringify(prior));
  assert.equal(acc.text.trim().split("\n").length, 2);
  assert.deepEqual(JSON.parse(acc.text.trim().split("\n")[0]), accuracyPrior);
  assert.equal(again.text.trim().split("\n")[0], acc.text.trim().split("\n")[0]);
  assert.equal(again.appended, false);
});

test("grading is unchanged: same way is a hit, the other way is a miss, a flat print is a miss", () => {
  assert.equal(gradeRead({ start: 10, later: 12, direction: "up" }), "hit");
  assert.equal(gradeRead({ start: 10, later: 8, direction: "up" }), "miss");
  assert.equal(gradeRead({ start: 10, later: 10, direction: "down" }), "miss");
  assert.equal(gradeRead({ start: 10, later: 12, direction: "flat" }), "open");
});
