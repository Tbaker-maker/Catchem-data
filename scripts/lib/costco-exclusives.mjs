// Costco exclusive sealed products. A Costco bundle is its own product.
// A plain Elite Trainer Box title is not a Costco bundle, and a Costco
// title is not the plain box.

export function isCostcoProduct(product) {
  if (!product || typeof product !== "object") return false;
  if (product.exclusive === "Costco") return true;
  return /\bcostco\b/i.test(String(product.name || ""));
}

// True when this listing title belongs with this product.
// Costco products keep only titles that say Costco.
// Every other sealed product drops titles that say Costco.
export function costcoListingOk(product, title) {
  const has = /\bcostco\b/i.test(String(title || ""));
  if (isCostcoProduct(product)) return has;
  if (String(product?.kind || "") === "single") return true;
  return !has;
}
