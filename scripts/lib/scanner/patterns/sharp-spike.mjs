import { detectSpike } from "../common.mjs";

export const id = "sharp-spike";
export const privateOnly = false;
export function detect(series, params) {
  return detectSpike(series, params, id);
}
