// A reads board that is not the sealed-prices day is loud.
// It does not stop the price publish. A withheld reads group is the crash
// path: withhold-group records the group, and withhold-artifacts puts yesterday's
// reads back. Either case is an alert.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function dayStamp(value) {
  const day = String(value || "").slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function readsDayAlerts({ readsAsOf = "", sealedUpdatedAt = "", withheld = [] } = {}) {
  const alerts = [];
  const readsDay = dayStamp(readsAsOf);
  const priceDay = dayStamp(sealedUpdatedAt);
  if (readsDay && priceDay && readsDay !== priceDay) {
    alerts.push(`reads.json asOf ${readsDay} is not the sealed-prices day ${priceDay}`);
  }
  const held = (Array.isArray(withheld) ? withheld : []).some((row) => {
    const key = typeof row === "string" ? row : row?.key;
    return key === "reads";
  });
  if (held) alerts.push("reads group was withheld, so yesterday's reads can be what published");
  return alerts;
}

export async function loadReadsDayAlerts(root) {
  const read = async (path) => {
    try { return JSON.parse(await readFile(join(root, path), "utf8")); } catch { return null; }
  };
  const reads = await read("research/assets/public/reads.json");
  const sealed = await read("data/sealed-prices.json");
  const triage = await read("data/derived/test-triage.json");
  return readsDayAlerts({
    readsAsOf: reads?.asOf || "",
    sealedUpdatedAt: sealed?.updatedAt || "",
    withheld: triage?.withheld || [],
  });
}
