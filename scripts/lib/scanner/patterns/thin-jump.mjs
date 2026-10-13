import { detectThinJump } from "../common.mjs";

// Private only. A sudden listings-counted drop plus a price jump on a thin count.
// Never a public read, even after the gate.
export const id = "thin-jump";
export const privateOnly = true;
export function detect(series, params) {
  return detectThinJump(series, id);
}
