import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decidePrice, firstBelowUnlimited, isVintageRelease, knownCondition, listingsAgree,
  printingOk, publicHoldDoc, PRICE_CHECKING,
} from "../lib/price-trust.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// A test band, not the live one. The live band stays in catchem-data-private.
const cfg = { minListings: 3, minRatio: 0.5, maxRatio: 2 };

export async function runPriceTrustTests() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.error("  FAIL", name); }
  };
  const espeon = {
    id: "tcgcsv-85316",
    kind: "single",
    name: "Espeon (1)",
    release: "2001-06-01",
    price: 237.5,
    printing: "1st Edition Holofoil",
    printings: [
      { name: "1st Edition Holofoil", price: 237.5 },
      { name: "Unlimited Holofoil", price: 365.17 },
    ],
    ebayAsks: [],
  };
  const held = decidePrice(espeon, cfg);
  t("Espeon 1st Edition is not a headline", held.status === "checking" && held.showNm === false);
  t("Espeon reason is unverified, not a blended printing", held.reason === "unverified" && firstBelowUnlimited(espeon));
  t("vintage with no matching listings is checked", decidePrice({ ...espeon, printing: "Holofoil", printings: [{ name: "Holofoil", price: 237.5 }] }, cfg).reason === "vintage");

  const unlimited = { id: "u1", kind: "single", release: "1999-01-09", price: 40, printing: "Unlimited", printings: [{ name: "Unlimited", price: 40 }, { name: "1st Edition", price: 90 }] };
  const first = { id: "f1", kind: "single", release: "1999-01-09", price: 90, printing: "1st Edition", printings: [{ name: "Unlimited", price: 40 }, { name: "1st Edition", price: 90 }] };
  t("1st Edition and Unlimited stay separate prices", printingOk(unlimited) && printingOk(first) && unlimited.price !== first.price);
  t("two printings and no name are not published", decidePrice({ id: "mix", kind: "single", release: "2024-01-01", price: 50, printing: "", printings: [{ name: "Holofoil", price: 40 }, { name: "Reverse Holofoil", price: 60 }] }, cfg).reason === "printing");
  t("the same printing can move a few cents without being mixed", printingOk({ price: 13.66, printing: "Holofoil", printings: [{ name: "Holofoil", price: 13.63 }] }));

  const mp = decidePrice({ id: "mp", kind: "single", release: "2024-06-01", price: 12, printing: "Holofoil", printings: [{ name: "Holofoil", price: 12 }], condition: "MP" }, cfg);
  t("an MP price is labeled MP and never NM", mp.status === "publish" && mp.showNm === false && mp.condition === "MP");
  t("unknown condition is not called NM", decidePrice({ id: "u", kind: "single", release: "2024-06-01", price: 12, printing: "Normal", printings: [{ name: "Normal", price: 12 }] }, cfg).showNm === false);
  t("NM only when the row says NM", decidePrice({ id: "nm", kind: "single", release: "2024-06-01", price: 12, printing: "Normal", printings: [{ name: "Normal", price: 12 }], condition: "Near Mint" }, cfg).showNm === true);

  const odd = decidePrice({ id: "odd", kind: "single", release: "2024-01-01", price: 400, printing: "Holofoil", printings: [{ name: "Holofoil", price: 400 }], unverified: true, ebayAsks: [400, 410, 390] }, cfg);
  t("an unverified price is not a headline", odd.status === "checking" && odd.reason === "unverified" && odd.showNm === false);

  const vintageOk = decidePrice({ id: "v", kind: "single", release: "1999-01-09", price: 100, printing: "Holofoil", printings: [{ name: "Holofoil", price: 100 }], condition: "NM", ebayAsks: [95, 100, 110] }, cfg);
  t("vintage publishes when the same printing and condition agree", vintageOk.status === "publish" && vintageOk.showNm === true);
  const vintageFar = decidePrice({ id: "v2", kind: "single", release: "1999-01-09", price: 20, printing: "Holofoil", printings: [{ name: "Holofoil", price: 20 }], ebayAsks: [90, 100, 110] }, cfg);
  t("vintage stays checked when listings disagree", vintageFar.status === "checking" && vintageFar.reason === "vintage");
  t("two listings are not enough", listingsAgree(100, [100, 100], cfg) === false);

  t("sealed never gets NM", decidePrice({ id: "box", kind: "sealed", price: 100, condition: "NM" }, cfg).showNm === false);
  t("WOTC era is vintage and a modern set is not", isVintageRelease("2003-05-12") && !isVintageRelease("2003-06-01") && knownCondition("Moderately Played") === "MP");

  const pub = publicHoldDoc([{ id: "tcgcsv-85316", status: "checking", reason: "unverified" }, { id: "ok", status: "publish" }], "2026-10-17");
  const text = JSON.stringify(pub);
  t("the public hold file has no threshold numbers", pub.ids["tcgcsv-85316"] === "unverified" && !text.includes("minRatio") && !text.includes("maxRatio") && !text.includes("minListings"));
  t("the checking phrase is plain", PRICE_CHECKING === "Price being checked" && !/[\u2014\u2013]/.test(PRICE_CHECKING));

  const ignore = await readFile(join(ROOT, ".gitignore"), "utf8");
  t("the live band is not a public file", ignore.includes("config/price-trust.json"));
  return fail;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const n = await runPriceTrustTests();
  if (n) process.exit(1);
}
