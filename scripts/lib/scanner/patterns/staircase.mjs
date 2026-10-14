import { detectStaircase } from "../common.mjs";

export const id = "staircase";
export const privateOnly = false;
export function detect(series, params) {
  return detectStaircase(series, params, id);
}
