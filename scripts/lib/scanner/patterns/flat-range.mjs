import { detectFlat } from "../common.mjs";

export const id = "flat-range";
export const privateOnly = false;
export function detect(series, params) {
  return detectFlat(series, params, id);
}
