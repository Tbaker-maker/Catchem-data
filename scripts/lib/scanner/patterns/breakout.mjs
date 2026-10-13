import { detectBreakout } from "../common.mjs";

export const id = "breakout";
export const privateOnly = false;
export function detect(series, params) {
  return detectBreakout(series, params, id);
}
