import { detectListings } from "../common.mjs";

export const id = "price-down-listings-down";
export const privateOnly = false;
export function detect(series, params) {
  return detectListings(series, params, "both-down", id);
}
