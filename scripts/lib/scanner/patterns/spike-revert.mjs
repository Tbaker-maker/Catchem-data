import { detectRevert } from "../common.mjs";

export const id = "spike-revert";
export const privateOnly = false;
export function detect(series, params) {
  return detectRevert(series, params, id);
}
