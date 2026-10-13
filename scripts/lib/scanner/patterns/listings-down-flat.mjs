import { detectListings } from "../common.mjs";

export const id = "listings-down-flat";
export const privateOnly = false;
export function detect(series, params) {
  return detectListings(series, params, "down-flat", id);
}
