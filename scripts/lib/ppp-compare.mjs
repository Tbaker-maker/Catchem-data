// Compare PkmnPrices current prices to TCGCSV and, when mounted, PPT.
// The public summary is counts and percent agreement only.

export function normalizeVariant(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "reverse holo" || lower === "reverse holofoil") return "Reverse Holofoil";
  if (lower === "holo" || lower === "holofoil") return "Holofoil";
  return raw;
}

export function usdTcgPrice(row) {
  if (!row || typeof row !== "object") return null;
  const source = String(row.source || "").toLowerCase();
  const currency = String(row.currency || "").toUpperCase();
  if (source && source !== "tcgplayer") return null;
  if (currency && currency !== "USD") return null;
  const n = Number(row.market_price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function pppSealedMarket(body) {
  const rows = Array.isArray(body?.prices) ? body.prices : [];
  const unopened = rows.find((row) => String(row?.condition || "") === "Unopened" && usdTcgPrice(row) != null);
  const any = rows.find((row) => usdTcgPrice(row) != null);
  const hit = unopened || any;
  if (!hit) return null;
  return { price: usdTcgPrice(hit), condition: hit.condition ?? null, variant: hit.variant ?? "", createdAt: hit.created_at || null, source: "pkmnprices" };
}

export function pppCardMarket(body, variant) {
  const want = normalizeVariant(variant);
  const rows = Array.isArray(body?.prices) ? body.prices : [];
  const hit = rows.find((row) => {
    if (String(row?.condition || "") !== "Near Mint") return false;
    if (usdTcgPrice(row) == null) return false;
    return normalizeVariant(row.variant) === want;
  });
  if (!hit) return null;
  return { price: usdTcgPrice(hit), condition: hit.condition, variant: normalizeVariant(hit.variant), createdAt: hit.created_at || null, source: "pkmnprices" };
}

export function tcgcsvSealedPrice(item) {
  const n = Number(item?.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function tcgcsvCardPrintings(item) {
  const rows = [];
  if (Array.isArray(item?.printings)) {
    for (const printing of item.printings) {
      const n = Number(printing?.price);
      if (!(n > 0)) continue;
      rows.push({ variant: normalizeVariant(printing.name || item.printing || ""), price: n });
    }
  }
  if (!rows.length) {
    const n = Number(item?.price);
    if (n > 0) rows.push({ variant: normalizeVariant(item.printing || ""), price: n });
  }
  return rows;
}

// PPT sealed raw is the v2 sealed-products body: { data: [ { tcgMarket|unopenedPrice|... } ] }.
export function pptSealedMarket(body) {
  const row = Array.isArray(body?.data) ? body.data[0] : (body?.data && typeof body.data === "object" ? body.data : body);
  if (!row || typeof row !== "object") return null;
  for (const key of ["unopenedPrice", "tcgMarket", "market", "marketPrice", "price"]) {
    const n = Number(row[key]);
    if (Number.isFinite(n) && n > 0) return { price: n, source: "pokemonpricetracker", key };
  }
  if (Array.isArray(row.prices)) {
    const hit = row.prices.find((p) => Number(p?.market || p?.marketPrice || p?.price) > 0);
    if (hit) return { price: Number(hit.market || hit.marketPrice || hit.price), source: "pokemonpricetracker", key: "prices" };
  }
  return null;
}

export function pptCardMarket(body, tcgPlayerId, variant) {
  const wantId = String(tcgPlayerId);
  const want = normalizeVariant(variant);
  const cards = Array.isArray(body?.data) ? body.data
    : Array.isArray(body?.cards) ? body.cards
    : body && typeof body === "object" && (body.tcgPlayerId || body.tcgplayerProductId) ? [body]
    : [];
  const card = cards.find((row) => String(row?.tcgPlayerId || row?.tcgplayerProductId || row?.productId || "") === wantId);
  if (!card) return null;
  const conditions = card.conditions || card.prices || card.variants || [];
  if (Array.isArray(conditions)) {
    const hit = conditions.find((row) => {
      const cond = String(row?.condition || row?.name || "");
      if (cond && cond !== "Near Mint" && cond !== "NM") return false;
      return normalizeVariant(row.variant || row.printing || row.name) === want || (!want && !normalizeVariant(row.variant || row.printing || ""));
    }) || conditions.find((row) => String(row?.condition || row?.name || "") === "Near Mint" || String(row?.condition || "") === "NM");
    if (hit) {
      const n = Number(hit.tcgMarket || hit.market || hit.marketPrice || hit.price);
      if (n > 0) return { price: n, source: "pokemonpricetracker" };
    }
  }
  const n = Number(card.tcgMarket || card.market || card.marketPrice || card.price);
  return n > 0 ? { price: n, source: "pokemonpricetracker" } : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function agreement(rows) {
  const compared = rows.filter((row) => Number.isFinite(row.ppp) && Number.isFinite(row.baseline) && row.baseline > 0);
  const absPct = compared.map((row) => Math.abs(row.ppp - row.baseline) / row.baseline * 100);
  const absUsd = compared.map((row) => Math.abs(row.ppp - row.baseline));
  const exact = compared.filter((row) => Math.abs(row.ppp - row.baseline) <= 0.005).length;
  const within5 = absPct.filter((n) => n <= 5).length;
  const within10 = absPct.filter((n) => n <= 10).length;
  const outliers = compared
    .map((row, i) => ({ ...row, absPct: absPct[i] }))
    .filter((row) => row.absPct > 10)
    .sort((a, b) => b.absPct - a.absPct);
  return {
    nRows: rows.length,
    nCompared: compared.length,
    nExact: exact,
    exactShare: compared.length ? exact / compared.length : null,
    medianAbsPct: median(absPct),
    medianAbsUsd: median(absUsd),
    within5,
    within5Share: compared.length ? within5 / compared.length : null,
    within10,
    within10Share: compared.length ? within10 / compared.length : null,
    nOutliersOver10: outliers.length,
    outliers,
  };
}

export function publicAgreement(stats) {
  if (!stats) return null;
  return {
    nCompared: stats.nCompared,
    nExact: stats.nExact,
    exactShare: stats.exactShare,
    medianAbsPct: stats.medianAbsPct,
    within5: stats.within5,
    within5Share: stats.within5Share,
    within10: stats.within10,
    within10Share: stats.within10Share,
    nOutliersOver10: stats.nOutliersOver10,
  };
}

export function comparePulls({ pppSealed = [], pppCards = [], tcgcsvByTid = new Map(), pptSealedByTid = new Map(), pptCardBodies = [] }) {
  const sealedTcg = [];
  const sealedPpt = [];
  const cardTcg = [];
  const cardPpt = [];
  for (const item of pppSealed) {
    const tid = String(item.tcgPlayerId);
    const ppp = pppSealedMarket(item.body);
    if (!ppp) continue;
    const tcg = tcgcsvSealedPrice(tcgcsvByTid.get(tid));
    if (tcg != null) sealedTcg.push({ kind: "sealed", tcgPlayerId: tid, name: item.body?.name || tid, ppp: ppp.price, baseline: tcg, baselineSource: "tcgcsv" });
    const ppt = pptSealedMarket(pptSealedByTid.get(tid));
    if (ppt) sealedPpt.push({ kind: "sealed", tcgPlayerId: tid, name: item.body?.name || tid, ppp: ppp.price, baseline: ppt.price, baselineSource: "ppt" });
  }
  for (const item of pppCards) {
    const tid = String(item.tcgPlayerId);
    const tcgItem = tcgcsvByTid.get(tid);
    const printings = tcgcsvCardPrintings(tcgItem);
    const variants = printings.length ? printings : [{ variant: "", price: null }];
    for (const printing of variants) {
      const ppp = pppCardMarket(item.body, printing.variant);
      if (!ppp) continue;
      if (printing.price != null) {
        cardTcg.push({
          kind: "single",
          tcgPlayerId: tid,
          name: item.body?.name || tcgItem?.name || tid,
          variant: printing.variant,
          ppp: ppp.price,
          baseline: printing.price,
          baselineSource: "tcgcsv",
        });
      }
      for (const body of pptCardBodies) {
        const ppt = pptCardMarket(body, tid, printing.variant);
        if (ppt) {
          cardPpt.push({
            kind: "single",
            tcgPlayerId: tid,
            name: item.body?.name || tid,
            variant: printing.variant,
            ppp: ppp.price,
            baseline: ppt.price,
            baselineSource: "ppt",
          });
          break;
        }
      }
    }
  }
  const sealedVsTcgcsv = agreement(sealedTcg);
  const sealedVsPpt = agreement(sealedPpt);
  const singlesVsTcgcsv = agreement(cardTcg);
  const singlesVsPpt = agreement(cardPpt);
  return {
    sealedVsTcgcsv,
    sealedVsPpt,
    singlesVsTcgcsv,
    singlesVsPpt,
    private: {
      sealedVsTcgcsv,
      sealedVsPpt,
      singlesVsTcgcsv,
      singlesVsPpt,
    },
    public: {
      note: "Counts and percent agreement only. Dollar prices stay in the private report.",
      sealed: { vsTcgcsv: publicAgreement(sealedVsTcgcsv), vsPpt: publicAgreement(sealedVsPpt) },
      singles: { vsTcgcsv: publicAgreement(singlesVsTcgcsv), vsPpt: publicAgreement(singlesVsPpt) },
    },
  };
}
