// Blocks eBay during a dress rehearsal, for fetch and for node:http(s).
// Other requests stay real. Loaded through NODE_OPTIONS by absolute path.
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const EBAY = /(^|\.)ebay\.com$/i;
const blocked = (where) => new Error("dress rehearsal blocked an eBay API call: " + where);

function hostOf(input) {
  try {
    if (typeof input === "string") return new URL(input).hostname;
    if (input instanceof URL) return input.hostname;
    if (input && typeof input.url === "string") return new URL(input.url).hostname;
    if (input && (input.hostname || input.host)) return String(input.hostname || input.host).replace(/:\d+$/, "");
  } catch { /* not a URL */ }
  return "";
}

const isEbayApi = (host) => EBAY.test(host) && /^(api|apiz|svcs)\./i.test(host);

if (!globalThis.__catchemDressFetch) {
  globalThis.__catchemDressFetch = true;
  const orig = globalThis.fetch;
  if (typeof orig === "function") {
    globalThis.fetch = async function dressFetch(input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || String(input || "");
      if (isEbayApi(hostOf(input)) || String(url).includes("api.ebay.com")) throw blocked(url);
      return orig(input, init);
    };
  }
  for (const mod of [http, https]) {
    for (const name of ["request", "get"]) {
      const fn = mod[name];
      mod[name] = function dressRequest(input, ...rest) {
        const host = hostOf(input) || hostOf(rest[0]);
        if (isEbayApi(host)) throw blocked(host);
        return fn.call(this, input, ...rest);
      };
    }
  }
  syncBuiltinESMExports();
}
