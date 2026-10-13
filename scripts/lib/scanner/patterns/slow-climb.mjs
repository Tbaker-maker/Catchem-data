import { detectTrend } from "../common.mjs";

export const id = "slow-climb";
export const privateOnly = false;
export function detect(series, params) {
  return detectTrend(series, params, 1, id);
}
