import { detectTrend } from "../common.mjs";

export const id = "sealed-slow-climb";
export const privateOnly = false;

// Slow climb on sealed only, graded separately by printStatus (in-print vs out-of-print).
export function detect(series, params) {
  if (series?.kind !== "sealed") return null;
  const printStatus = series.printStatus;
  if (printStatus !== "in-print" && printStatus !== "out-of-print") return null;
  const hit = detectTrend(series, { ...params, windowDays: params?.windowDays || 60 }, 1, id);
  if (!hit) return null;
  return {
    ...hit,
    metrics: { ...hit.metrics, printStatus },
  };
}
