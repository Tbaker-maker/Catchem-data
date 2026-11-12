// The PkmnPrices pathways as scanner patterns, so the nightly replay grades
// them against later TCGplayer market moves with the same gate as every other
// pattern: n >= 20 on the earlier and the later part of the year, and the
// lower bound of the 90% range above the base rate on both. Until a pathway
// passes, its weight is 0 and it writes no scanner read.
import { LIMITS } from "./limits.mjs";
import { PATHWAYS, marketNear } from "./pathways.mjs";

let CTX = { L: LIMITS, fx: [], msrp: new Map(), tonight: "" };
export function setPppScannerContext(ctx = {}) {
  CTX = { L: ctx.L || LIMITS, fx: ctx.fx || [], msrp: ctx.msrp || new Map(), tonight: ctx.inputAsOf || "" };
}

// The replay checks a ppp-* pattern once a week (Mondays, UTC day number) and
// on every day in the last 3 days of the input, so a long daily replay stays cheap.
const dayNo = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
function checkDay(asOf) {
  if (CTX.tonight && dayNo(asOf) >= dayNo(CTX.tonight) - 3) return true;
  return dayNo(asOf) % 7 === 4;
}
export function pppScannerContext() { return CTX; }

export const PPP_PREFIX = "ppp-";
export const isPppPattern = (id) => String(id || "").startsWith(PPP_PREFIX);

function asPattern(p) {
  const id = `${PPP_PREFIX}${p.id}`;
  return {
    id,
    privateOnly: false,
    pathway: p.id,
    detect(view) {
      if (!view?.ppp || !view.asOf || !checkDay(view.asOf)) return null;
      const h = p.run(view, view.asOf, CTX.L, CTX);
      if (!h || !h.dir) return null;
      const mkt = marketNear(view, view.asOf, CTX.L);
      if (!mkt) return null;
      return {
        pattern: id,
        stage: h.stage,
        strength: 50,
        dates: { start: h.evidence.from || view.asOf, end: view.asOf },
        metrics: { ...h.metrics, dir: h.dir, pathway: p.id, priceStart: mkt.price, priceEnd: mkt.price, startSrc: "own", endSrc: "own", evidence: h.evidence },
      };
    },
  };
}

export const PPP_PATTERNS = PATHWAYS.map(asPattern);
