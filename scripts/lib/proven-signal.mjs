// Proven-signal check for a published pattern row.
// The case minimum is tracker MIN_N, the same floor as the private
// year-patterns summary. It is not a new cutoff. The move rule stays in
// that study. A row is shown only when the rate is above the base rate.
import { MIN_N } from "./tracker.mjs";

export { MIN_N };

export function patternPasses({ rate, base, n, pass } = {}) {
  if (pass === false) return false;
  const r = Number(rate);
  const b = Number(base);
  const c = Number(n);
  if (!(r > 0) || !(b > 0) || !(c >= MIN_N)) return false;
  return r > b;
}
