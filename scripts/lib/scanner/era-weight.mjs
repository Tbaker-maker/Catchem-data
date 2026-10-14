// Era durability weights. The public gate (train and test both pass) does not
// change. A passing pattern's weight is scaled by how many eras it passed.
// All 3 eras: 1. Some: 0.5 (one era) to 0.9 (two eras). Otherwise 0.25.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const ERA_IDS = ["2024-own", "2025", "2026-current"];

export function factorFromPasses(passCount, eraCount = ERA_IDS.length) {
  const n = Number(passCount) || 0;
  const eras = Number(eraCount) || ERA_IDS.length;
  if (eras > 0 && n >= eras) return 1;
  if (n <= 0) return 0.25;
  const steps = Math.max(1, eras - 1);
  const t = (n - 1) / Math.max(1, steps - 1);
  return Math.round((0.5 + 0.4 * Math.min(1, t)) * 1000) / 1000;
}

export function factorsFromDurable(doc) {
  const out = {};
  const rows = Array.isArray(doc?.all) ? doc.all : Array.isArray(doc?.durable) ? doc.durable : [];
  for (const row of rows) {
    if (!row?.key) continue;
    const passed = ERA_IDS.filter((id) => row.eras?.[id]?.passed === true && (row.eras[id].n || 0) >= 20).length;
    out[row.key] = factorFromPasses(passed, ERA_IDS.length);
  }
  return out;
}

export function loadEraFactors(root = ROOT) {
  const priv = join(root, "data/private/research/scanner-eras/durable.json");
  if (existsSync(priv)) {
    try {
      const factors = factorsFromDurable(JSON.parse(readFileSync(priv, "utf8")));
      if (Object.keys(factors).length) return { factors, source: "data/private/research/scanner-eras/durable.json" };
    } catch { /* fall through to the committed table */ }
  }
  const cfgPath = join(root, "config/scanner-era-weights.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  return { factors: cfg.factors || {}, source: cfg.source || "config/scanner-era-weights.json", asOf: cfg.asOf || "" };
}

let cached = null;
export function eraFactorFor(key, factors = null) {
  const table = factors || (cached ||= loadEraFactors().factors);
  if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  return 0.25;
}

export function resetEraFactorCache() {
  cached = null;
}
