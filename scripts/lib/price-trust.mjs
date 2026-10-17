// When a single may show a price, and when it may say NM.
// The listing band lives in catchem-data-private (config/price-trust.json).
// This public repo never stores those numbers. Public files get a reason word only.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WOTC_END = "2003-06-01";
export const PRICE_CHECKING = "Price being checked";
export const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function loadPriceTrustConfig(root = ROOT) {
  const candidates = [
    process.env.PRICE_TRUST_FILE,
    join(root, "config/price-trust.json"),
    join(root, "..", "catchem-data-private", "config", "price-trust.json"),
  ].filter(Boolean);
  let raw = "";
  for (const path of candidates) {
    try {
      raw = await readFile(path, "utf8");
      break;
    } catch { /* try the next private location */ }
  }
  if (!raw) throw new Error("price trust config is not on this machine");
  const cfg = JSON.parse(raw);
  const minListings = Number(cfg.minListings);
  const minRatio = Number(cfg.minRatio);
  const maxRatio = Number(cfg.maxRatio);
  if (!(minListings >= 1) || !(minRatio > 0) || !(maxRatio > minRatio)) {
    throw new Error("config/price-trust.json is missing a listing band");
  }
  return { minListings, minRatio, maxRatio };
}

export function isVintageRelease(release) {
  const rel = String(release || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(rel) && rel < WOTC_END;
}

export function knownCondition(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (s === "nm" || s === "near mint" || s === "mint") return "NM";
  if (s === "lp" || s === "lightly played") return "LP";
  if (s === "mp" || s === "moderately played") return "MP";
  if (s === "hp" || s === "heavily played") return "HP";
  if (s === "dmg" || s === "damaged" || s === "damage") return "DMG";
  return "";
}

// The headline has to name one printing. A one-day price move on that same
// printing is not a mix. Two priced printings and no name is a mix.
export function printingOk(item) {
  const price = Number(item?.price);
  if (!(price > 0)) return true;
  const prints = (item.printings || []).filter((p) => p && p.name && Number(p.price) > 0);
  const name = String(item.printing || "").trim();
  if (!name) return prints.length <= 1;
  const hit = prints.filter((p) => p.name === name);
  if (hit.length === 1) return true;
  if (hit.length === 0 && prints.length === 0) return true;
  return false;
}

// 1st Edition below the same card's unlimited price is not a headline.
export function firstBelowUnlimited(item) {
  const prints = item?.printings || [];
  const fe = prints.find((p) => p && p.name === "1st Edition Holofoil" && Number(p.price) > 0);
  const un = prints.find((p) => p && (p.name === "Unlimited Holofoil" || p.name === "Unlimited") && Number(p.price) > 0);
  if (!fe || !un || !(Number(fe.price) < Number(un.price))) return false;
  return /1st Edition/i.test(String(item.printing || ""));
}

// Same printing and condition, listings only. Median of the asks.
export function listingsAgree(market, asks, cfg) {
  const list = (asks || []).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (list.length < cfg.minListings) return false;
  const mid = list.length % 2
    ? list[(list.length - 1) / 2]
    : (list[list.length / 2 - 1] + list[list.length / 2]) / 2;
  const price = Number(market);
  if (!(mid > 0) || !(price > 0)) return false;
  const ratio = price / mid;
  return ratio >= cfg.minRatio && ratio <= cfg.maxRatio;
}

export function decidePrice(input, cfg) {
  const condition = knownCondition(input?.condition);
  if (input?.kind === "sealed") return { status: "publish", reason: "", showNm: false, condition: "" };
  if (input?.unverified || firstBelowUnlimited(input)) {
    return { status: "checking", reason: "unverified", showNm: false, condition: "" };
  }
  if (!printingOk(input)) return { status: "checking", reason: "printing", showNm: false, condition: "" };
  if (input?.vintage || isVintageRelease(input?.release)) {
    if (!listingsAgree(input?.price, input?.ebayAsks || [], cfg)) {
      return { status: "checking", reason: "vintage", showNm: false, condition: "" };
    }
  }
  return {
    status: "publish",
    reason: "",
    showNm: condition === "NM" && Number(input?.price) > 0,
    condition,
  };
}

export function publicHoldDoc(rows, asOf) {
  const ids = {};
  for (const row of rows || []) {
    if (row && row.status === "checking" && row.id) ids[row.id] = row.reason || "checking";
  }
  return {
    asOf: String(asOf || "").slice(0, 10),
    note: "These singles are not a headline price. The page says Price being checked. This file has no thresholds.",
    ids,
  };
}

export const HOLD_NOTE = "These singles are not a headline price. The page says Price being checked. This file has no thresholds.";
