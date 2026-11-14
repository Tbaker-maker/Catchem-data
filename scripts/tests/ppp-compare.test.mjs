import { pathToFileURL } from "node:url";
import { comparePulls, normalizeVariant, pppCardMarket, pppSealedMarket, publicAgreement } from "../lib/ppp-compare.mjs";

export async function runPppCompareTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };
  t("holo aliases match", normalizeVariant("Reverse Holo") === "Reverse Holofoil" && normalizeVariant("Holo") === "Holofoil");
  t("sealed current price is the Unopened USD TCGPlayer row", pppSealedMarket({
    prices: [
      { source: "cardmarket", currency: "EUR", condition: "Unopened", market_price: 9 },
      { source: "tcgplayer", currency: "USD", condition: "Unopened", variant: "", market_price: 113.61, created_at: "2026-11-12T00:13:31.272884+00:00" },
    ],
  }).price === 113.61);
  t("a Near Mint Holofoil is the singles comparison row", pppCardMarket({
    prices: [
      { source: "tcgplayer", currency: "USD", condition: "Lightly Played", variant: "Holofoil", market_price: 1 },
      { source: "tcgplayer", currency: "USD", condition: "Near Mint", variant: "Holofoil", market_price: 8 },
    ],
  }, "Holo").price === 8);

  const report = comparePulls({
    pppSealed: [{
      tcgPlayerId: "593355",
      body: { name: "Prismatic Evolutions Elite Trainer Box", prices: [{ source: "tcgplayer", currency: "USD", condition: "Unopened", market_price: 100 }] },
    }],
    pppCards: [{
      tcgPlayerId: "42382",
      body: { name: "Charizard", prices: [{ source: "tcgplayer", currency: "USD", condition: "Near Mint", variant: "Holofoil", market_price: 100 }] },
    }],
    tcgcsvByTid: new Map([
      ["593355", { kind: "sealed", price: 100 }],
      ["42382", { kind: "single", printings: [{ name: "Holofoil", price: 110 }] }],
    ]),
    pptSealedByTid: new Map([
      ["593355", { data: [{ unopenedPrice: 100 }] }],
    ]),
    pptCardBodies: [{ data: [{ tcgPlayerId: "42382", tcgMarket: 100 }] }],
  });
  t("exact sealed agreement is counted", report.sealedVsTcgcsv.nCompared === 1 && report.sealedVsTcgcsv.nExact === 1 && report.sealedVsPpt.nExact === 1);
  t("a 9.09% singles gap is inside 10% and not an outlier", report.singlesVsTcgcsv.nCompared === 1 && report.singlesVsTcgcsv.within10 === 1 && report.singlesVsTcgcsv.nOutliersOver10 === 0);
  const pub = JSON.stringify(report.public);
  t("the public summary has no product prices or names", !pub.includes("market_price") && !pub.includes("Charizard") && !pub.includes("113.61") && !("outliers" in (report.public.singles.vsTcgcsv || {})) && report.public.singles.vsTcgcsv.nCompared === 1);
  t("publicAgreement drops outlier rows", publicAgreement(report.singlesVsTcgcsv).nOutliersOver10 === 0 && !("outliers" in publicAgreement(report.singlesVsTcgcsv)));

  // The committed 2026-11-14 compare was 0/0 against PPT. The fixture above uses a
  // flat tcgMarket the live set raws do not send. This is the live join shape.
  const live = comparePulls({
    pppSealed: [{
      tcgPlayerId: "98562",
      body: { name: "Deoxys Booster Pack", prices: [{ source: "tcgplayer", currency: "USD", condition: "Unopened", market_price: 100 }] },
    }],
    pppCards: [{
      tcgPlayerId: "84856",
      body: { name: "Dodrio", prices: [{ source: "tcgplayer", currency: "USD", condition: "Near Mint", variant: "Normal", market_price: 0.4 }] },
    }],
    tcgcsvByTid: new Map([
      ["98562", { kind: "sealed", price: 100 }],
      ["84856", { kind: "single", printings: [{ name: "Normal", price: 0.32 }] }],
    ]),
    pptSealedByTid: new Map([
      ["98562", { data: [{ tcgPlayerId: 98562, name: "Deoxys Booster Pack", unopenedPrice: 110 }] }],
    ]),
    pptCardBodies: [{
      data: [{
        tcgPlayerId: 84856,
        name: "Dodrio",
        prices: {
          market: 0.32,
          primaryPrinting: "Normal",
          variants: { Normal: { "Near Mint": { price: 0.32, listings: null } }, "Reverse Holofoil": { "Near Mint": { price: 0.69 } } },
          conditions: { "Near Mint": { price: 0.32 } },
        },
        variants: {
          Normal: { printing: "Normal", marketPrice: 0.32, conditionUsed: "Near Mint" },
          "Reverse Holofoil": { printing: "Reverse Holofoil", marketPrice: 0.69, conditionUsed: "Near Mint Reverse Holofoil" },
        },
      }],
    }],
  });
  t("a real PPT body is not a 0 row compare", live.singlesVsPpt.nCompared > 0 && live.sealedVsPpt.nCompared > 0, `singles ${live.singlesVsPpt.nCompared} sealed ${live.sealedVsPpt.nCompared}`);
  t("the real card join uses the Near Mint printing, not the flat market", live.singlesVsPpt.nExact === 0 && Math.abs(live.singlesVsPpt.medianAbsUsd - 0.08) < 0.001);
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPppCompareTests();
  if (fail) process.exit(1);
}
