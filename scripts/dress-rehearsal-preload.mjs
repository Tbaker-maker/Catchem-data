// Blocks eBay during a dress rehearsal. Other fetches stay real.
const orig = globalThis.fetch;
if (typeof orig === "function" && !globalThis.__catchemDressFetch) {
  globalThis.__catchemDressFetch = true;
  globalThis.fetch = async function dressFetch(input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (String(url).includes("api.ebay.com")) {
      throw new Error("dress rehearsal blocked an eBay API call: " + url);
    }
    return orig(input, init);
  };
}
