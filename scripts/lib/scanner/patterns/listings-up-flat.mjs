import { detectListings } from "../common.mjs";

export const id = "listings-up-flat";
export const privateOnly = false;
export function detect(series, params) {
  return detectListings(series, params, "up-flat", id);
}
