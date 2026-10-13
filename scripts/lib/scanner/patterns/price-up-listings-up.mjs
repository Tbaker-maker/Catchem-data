import { detectListings } from "../common.mjs";

export const id = "price-up-listings-up";
export const privateOnly = false;
export function detect(series, params) {
  return detectListings(series, params, "both-up", id);
}
