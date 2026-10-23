// Completed sales from eBay Marketplace Insights. Not Browse asks.
// One product per call. Stops on the first auth or quota error.
// Official API only. Does not scrape.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  OAUTH_URL,
  SEARCH_URL,
  classifyInsightsError,
  insightsSearchUrl,
  insightsTokenBody,
  redactSecrets,
  summarizeInsightsResponse,
} from "./lib/ebay-marketplace-insights.mjs";

const FETCH_TIMEOUT_MS = 20000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = join(ROOT, "data", "sealed-products.json");
const OUT = join(ROOT, "data", "ebay-completed-sales.json");

function logProbe(payload) {
  console.log("EBAY_INSIGHTS_PROBE_JSON=" + JSON.stringify(payload));
}

export async function fetchCompletedSales({
  appId,
  certId,
  product,
  limit = 50,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) {
  if (!appId || !certId) {
    return {
      ok: false,
      classified: { status: 0, errorId: null, oauthError: null, message: "Missing EBAY_APP_ID or EBAY_CERT_ID env vars", kind: "other", stop: true },
    };
  }
  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");
  const secrets = [appId, certId, basic];
  const tokenRes = await fetchImpl(OAUTH_URL, {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: insightsTokenBody(),
  });
  const tokenText = await tokenRes.text();
  let tokenBody = {};
  try { tokenBody = JSON.parse(tokenText); } catch { tokenBody = { error_description: tokenText.slice(0, 180) }; }
  if (!tokenRes.ok || !tokenBody.access_token) {
    const classified = classifyInsightsError(tokenRes.status, tokenBody);
    classified.message = redactSecrets(classified.message, secrets);
    return { ok: false, classified };
  }
  secrets.push(tokenBody.access_token);
  const url = insightsSearchUrl({
    query: product.searchQuery || product.name,
    categoryId: "2536",
    limit,
  });
  if (!url.startsWith(SEARCH_URL)) throw new Error("refusing non-insights search url");
  const res = await fetchImpl(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch { body = { error_description: text.slice(0, 180) }; }
  if (!res.ok) {
    const classified = classifyInsightsError(res.status, body);
    classified.message = redactSecrets(classified.message, secrets);
    return { ok: false, classified };
  }
  const summary = summarizeInsightsResponse(body, {
    productId: product.id,
    query: product.searchQuery || product.name,
    pulledAt: now().toISOString(),
    limit,
    categoryId: "2536",
  });
  return { ok: true, summary };
}

export async function runSealedInsightsProbe({
  probe,
  catalog,
  outFile = OUT,
  writeFileImpl = writeFile,
  fetchImpl,
  env = process.env,
  now,
}) {
  const productId = probe?.productId;
  if (typeof productId !== "string" || !productId || productId.includes(",") || Array.isArray(probe?.productIds)) {
    logProbe({ ok: false, kind: "other", status: 0, errorId: null, message: "probe must name exactly one productId" });
    return 1;
  }
  const matches = catalog.filter(p => p && p.id === productId);
  if (matches.length !== 1) {
    logProbe({ ok: false, kind: "other", status: 0, errorId: null, message: "productId is not one tracked sealed product" });
    return 1;
  }
  const result = await fetchCompletedSales({
    appId: env.EBAY_APP_ID,
    certId: env.EBAY_CERT_ID,
    product: matches[0],
    limit: Number.isFinite(probe.limit) ? probe.limit : 50,
    fetchImpl,
    now,
  });
  if (!result.ok) {
    logProbe({ ok: false, ...result.classified });
    return 1;
  }
  await writeFileImpl(outFile, JSON.stringify(result.summary, null, 2) + "\n");
  logProbe({ ok: true, file: "data/ebay-completed-sales.json", ...result.summary });
  return 0;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const arg = process.argv.find(a => a.startsWith("--product="));
  const productId = arg ? arg.slice("--product=".length) : "sv3pt5-etb";
  const code = await runSealedInsightsProbe({
    probe: { productId, limit: 50 },
    catalog,
  });
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    logProbe({ ok: false, kind: "other", status: 0, errorId: null, message: String(err?.message || err).slice(0, 300) });
    process.exit(1);
  });
}
