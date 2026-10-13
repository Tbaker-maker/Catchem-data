import { detectRecovery } from "../common.mjs";

export const id = "recovery";
export const privateOnly = false;
export function detect(series, params) {
  return detectRecovery(series, params, id);
}
