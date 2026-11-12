// Public lines for the PkmnPrices pathways. Facts only: each line states the
// numbers and dates the hit carries, and the source. No hit rate is stated
// here; a hit rate appears only on a scanner read after its gate passed.
// A line that fails the shared copy rules leaves the read out and is flagged
// with the rule and the matched phrase. Nothing is rewritten.
import { money } from "../public-bundle.mjs";
import { flagLine } from "../copy-rules.mjs";
import { dateLabel } from "../history-reads.mjs";
import { scannerCopyOk } from "../scanner/reads.mjs";
import { round1 } from "./series.mjs";

export const READ_KINDS = {
  "sold-gap": "sold",
  "sold-pace": "sold",
  "sold-trend": "sold",
  "sell-through": "sold",
  "msrp-sold": "sold",
  "pop-growth": "pop",
  "gem-rate": "pop",
  "low-pop": "pop",
  "graded-spread": "graded",
  "eu-gap": "regional",
  "jp-en": "regional",
  range52: "range",
};

function signed(n) {
  const v = round1(Math.abs(n));
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return n > 0 ? `+${s}%` : n < 0 ? `-${s}%` : "0%";
}
const pts = (n) => `${round1(Math.abs(n))} points`;
const times = (n) => `${Number(n).toFixed(2)}x`;
const euro = (n) => (Number(n) > 0 ? `€${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null);
const int = (n) => Number(n).toLocaleString("en-US");
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

// What the comp filters left out, in one or two plain lines.
function compNotes(m, kind) {
  const out = [];
  out.push(m.dropped ? (m.dropped === 1 ? "1 more comp was left out because it was half or less of another comp." : `${m.dropped} more comps were left out because each was half or less of another comp.`) : "No comp was half or less of another comp.");
  if (m.titleDropped) {
    const what = kind === "sealed" ? "a lot, damage or another language" : "a played, damaged, graded or non-English copy";
    out.push(`${m.titleDropped} more ${m.titleDropped === 1 ? "comp was" : "comps were"} left out because the title named ${what}.`);
  }
  return out;
}

function d(iso, asOf) {
  const label = dateLabel(iso, asOf);
  return label.includes(String(iso).slice(0, 4)) ? label : `${label}, ${iso.slice(0, 4)}`;
}

function copyFor(h, item, asOf) {
  const m = h.metrics;
  const n = item.name;
  const D = (x) => d(x, asOf);
  switch (h.pathway) {
    case "sold-gap": return {
      headline: `${n}: eBay sold median ${money(m.soldMedian)} across ${m.comps} sold comps, ${D(h.evidence.from)} to ${D(h.evidence.to)}, against a TCGplayer market of ${money(m.market)} on ${D(m.marketDate)} (${signed(m.gapPct)}).`,
      lines: [
        `${m.comps} eBay sold comps from ${h.evidence.from} to ${h.evidence.to}. Median ${money(m.soldMedian)}.`,
        ...compNotes(m, item.kind),
        `TCGplayer market ${money(m.market)} on ${m.marketDate}.`,
        `The sold median sits ${signed(m.gapPct)} from the TCGplayer market.`,
      ],
      price: m.market,
    };
    case "sold-pace": return {
      headline: m.move === "spike"
        ? `${n}: ${m.recent} eBay sold comps from ${D(m.recentFrom)} to ${D(m.recentTo)}, against an average of ${m.baseWeekly} a week over the 8 weeks before (${times(m.ratio)}).`
        : `${n}: ${m.recent} eBay sold comps from ${D(m.recentFrom)} to ${D(m.recentTo)}, down from an average of ${m.baseWeekly} a week over the 8 weeks before (${times(m.ratio)}).`,
      lines: [
        `${m.recent} eBay sold comps from ${m.recentFrom} to ${m.recentTo}.`,
        `${m.baseTotal} eBay sold comps from ${m.baseFrom} to ${m.baseTo}, ${m.baseWeekly} a week.`,
        "Raw copies only. Graded slabs are counted apart.",
      ],
    };
    case "sold-trend": return {
      headline: `${n}: eBay sold median ${money(m.soldThen)} in the 14 days to ${D(m.thenTo)}, ${money(m.soldNow)} in the 14 days to ${D(m.nowTo)} (${signed(m.soldPct)}). TCGplayer market ${signed(m.marketPct)} over the same weeks.`,
      lines: [
        `${m.compsThen} eBay sold comps from ${m.thenFrom} to ${m.thenTo}, median ${money(m.soldThen)}.`,
        `${m.compsNow} eBay sold comps from ${m.nowFrom} to ${m.nowTo}, median ${money(m.soldNow)}.`,
        `TCGplayer market ${money(m.market0)} on ${m.market0Date} and ${money(m.market1)} on ${m.market1Date}.`,
        `The two moved ${pts(m.divergencePts)} apart.`,
      ],
      price: m.market1,
    };
    case "sell-through": return {
      headline: `${n}: ${m.soldNow} eBay sold comps in the 14 days to ${D(m.nowTo)} against ${int(m.listingsNow)} listings counted on ${D(m.listingsNowDate)} (${m.ratioNow} per listing). Four weeks earlier it was ${m.soldThen} against ${int(m.listingsThen)} (${m.ratioThen} per listing).`,
      lines: [
        `${m.soldNow} eBay sold comps from ${m.nowFrom} to ${m.nowTo}. ${int(m.listingsNow)} eBay listings counted on ${m.listingsNowDate}.`,
        `${m.soldThen} eBay sold comps from ${m.thenFrom} to ${m.thenTo}. ${int(m.listingsThen)} eBay listings counted on ${m.listingsThenDate}.`,
        "Listings counted is the eBay listing total on that day. Sold comps are completed eBay sales.",
      ],
    };
    case "pop-growth": return {
      headline: `${n}: graded population ${int(m.total0)} on ${D(m.date0)} to ${int(m.total1)} on ${D(m.date1)}, ${int(m.added)} more copies (${signed(m.growthPct)}), PSA, BGS, CGC and SGC combined.`,
      lines: [
        `${int(m.total0)} graded copies on ${m.date0}. ${int(m.total1)} graded copies on ${m.date1}.`,
        `Gem grade or better: ${int(m.gems0)} on ${m.date0}, ${int(m.gems1)} on ${m.date1}.`,
        graderLine(m.graders),
      ].filter(Boolean),
    };
    case "gem-rate": return {
      headline: `${n}: gem rate ${m.rate0}% on ${D(m.date0)} to ${m.rate1}% on ${D(m.date1)} (${m.shiftPts > 0 ? "+" : "-"}${pts(m.shiftPts)}) as ${int(m.added)} more copies were graded.`,
      lines: [
        `${int(m.total0)} graded copies on ${m.date0}, gem rate ${m.rate0}%.`,
        `${int(m.total1)} graded copies on ${m.date1}, gem rate ${m.rate1}%.`,
        "Gem grade means PSA 10, BGS 9.5 and up, and CGC or SGC 10 and up.",
      ],
    };
    case "low-pop": return {
      headline: m.shape === "price-up-pop-flat"
        ? `${n}: ${int(m.gems1)} gem-grade copies graded by ${D(m.date1)}, ${signed(m.gemsPct)} since ${D(m.date0)}, while the TCGplayer market went ${money(m.market0)} to ${money(m.market1)} (${signed(m.pricePct)}).`
        : `${n}: gem-grade copies ${int(m.gems0)} on ${D(m.date0)} to ${int(m.gems1)} on ${D(m.date1)} (${signed(m.gemsPct)}), while the TCGplayer market went ${money(m.market0)} to ${money(m.market1)} (${signed(m.pricePct)}).`,
      lines: [
        `Gem-grade copies: ${int(m.gems0)} on ${m.date0}, ${int(m.gems1)} on ${m.date1}.`,
        `TCGplayer market ${money(m.market0)} on ${m.market0Date} and ${money(m.market1)} on ${m.market1Date}.`,
      ],
      price: m.market1,
    };
    case "graded-spread": return {
      headline: `${n}: ${m.grader} ${m.grade} eBay sold median ${money(m.gradedNow)} against a raw sold median of ${money(m.rawNow)} (${times(m.multipleNow)}) in the 14 days to ${D(m.nowTo)}, from ${times(m.multipleThen)} in the 14 days to ${D(m.thenTo)}.`,
      lines: [
        `${m.gradedNowN} ${m.grader} ${m.grade} eBay sold comps, median ${money(m.gradedNow)}. ${m.rawNowN} raw eBay sold comps, median ${money(m.rawNow)}.`,
        `Four weeks earlier: ${m.grader} ${m.grade} median ${money(m.gradedThen)}, raw median ${money(m.rawThen)}.`,
        `The ${m.grader} ${m.grade} multiple moved ${signed(m.changePct)}.`,
      ],
    };
    case "eu-gap": return {
      headline: `${n}: Cardmarket ${euro(m.eurNow)} on ${D(m.eurDateNow)} (${money(m.usdEqNow)} at the ECB rate for ${D(m.fxDateNow)}) against a TCGplayer market of ${money(m.usdNow)}, a ${signed(m.gapPctNow)} gap, from ${signed(m.gapPctThen)} on ${D(m.eurDateThen)}.`,
      lines: [
        `Cardmarket ${euro(m.eurNow)} on ${m.eurDateNow}. ECB rate ${m.fxNow} US dollars per euro on ${m.fxDateNow}.`,
        `TCGplayer market ${money(m.usdNow)} on ${m.usdDateNow}.`,
        `Four weeks earlier: Cardmarket ${euro(m.eurThen)} on ${m.eurDateThen}, TCGplayer market ${money(m.usdThen)} on ${m.usdDateThen}.`,
      ],
      price: m.usdNow,
    };
    case "jp-en": {
      const jp = (v) => (m.jpCurrency === "USD" ? money(v) : `${Number(v).toLocaleString("en-US")} ${m.jpCurrency}`);
      return {
        headline: `${n}: the Japanese printing went ${jp(m.jp0)} to ${jp(m.jp1)} (${signed(m.jpPct)}) from ${D(m.jp0Date)} to ${D(m.jp1Date)}, while the English card went ${money(m.en0)} to ${money(m.en1)} (${signed(m.enPct)}).`,
        lines: [
          `Japanese printing ${jp(m.jp0)} on ${m.jp0Date} and ${jp(m.jp1)} on ${m.jp1Date}.`,
          `English card, TCGplayer market ${money(m.en0)} on ${m.en0Date} and ${money(m.en1)} on ${m.en1Date}.`,
          `The two moved ${pts(m.divergencePts)} apart.`,
        ],
        price: m.en1,
      };
    }
    case "range52": return {
      headline: m.edge === "high"
        ? `${n}: TCGplayer market ${money(m.price)} on ${D(m.date)}, above every price since ${D(m.coverFrom)}. The earlier high was ${money(m.high)} on ${D(m.highDate)}.`
        : `${n}: TCGplayer market ${money(m.price)} on ${D(m.date)}, under every price since ${D(m.coverFrom)}. The earlier low was ${money(m.low)} on ${D(m.lowDate)}.`,
      lines: [
        `${m.points} dated prices from ${m.coverFrom}, the last 7 days left out.`,
        `High ${money(m.high)} on ${m.highDate}. Low ${money(m.low)} on ${m.lowDate}.`,
        `TCGplayer market ${money(m.price)} on ${m.date}.`,
      ],
      price: m.price,
    };
    case "msrp-sold": {
      const src = host(m.msrpSource);
      return {
        headline: `${n}: eBay sold median ${money(m.soldMedian)} across ${m.comps} sold comps, ${D(h.evidence.from)} to ${D(h.evidence.to)}, ${times(m.ratio)} its ${money(m.msrp)} US MSRP.`,
        lines: [
          `${m.comps} eBay sold comps from ${h.evidence.from} to ${h.evidence.to}. Median ${money(m.soldMedian)}.`,
          ...compNotes(m, "sealed"),
          `US MSRP ${money(m.msrp)}${src ? `, from ${src}` : ""}${m.msrpChecked ? `, checked ${m.msrpChecked}` : ""}.`,
          m.ratioThen ? `Four weeks earlier the sold median was ${times(m.ratioThen)} MSRP.` : "",
        ].filter(Boolean),
      };
    }
    default: return null;
  }
}

function graderLine(graders) {
  const parts = ["PSA", "BGS", "CGC", "SGC"].filter((g) => graders?.[g]?.total > 0).map((g) => `${g} ${int(graders[g].total)}`);
  return parts.length ? `By grader: ${parts.join(", ")}.` : "";
}

export function factRead(h, item, asOf, { flags = [] } = {}) {
  const body = copyFor(h, item, asOf);
  if (!body) return null;
  const source = `${h.evidence.source}, ${h.evidence.from} to ${h.evidence.to}`;
  const why = item.kind === "sealed"
    ? "Dated rows only. Each number on this line is a value in the source file for that date."
    : "Dated rows only. Raw copies unless the line names a grade. eBay comps that do not name this card alone are left out.";
  const texts = [body.headline, source, why, ...body.lines];
  const bad = texts.filter((s) => !scannerCopyOk(s) || /\bnull\b|\bundefined\b|NaN/.test(s));
  if (bad.length) {
    for (const line of bad) {
      const f = flagLine(line, { id: `ppp-${h.pathway}-${item.id}` });
      flags.push({ id: `ppp-${h.pathway}-${item.id}`, pathway: h.pathway, line, rule: f[0]?.rule || "copy-check", phrase: f[0]?.phrase || "", reason: f[0]?.reason || "line failed the scanner copy check or carried a missing number" });
    }
    return null;
  }
  if (item.kind === "single" && texts.some((s) => /\b(sealed|booster|elite trainer box|etb)\b/i.test(s))) return null;
  const readKind = h.pathway;
  const href = item.kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`;
  return {
    id: `ppp-${readKind}-${item.id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90),
    sku: item.id,
    href,
    readKind,
    kind: readKind,
    board: "v3",
    family: READ_KINDS[readKind] || "sold",
    name: item.name,
    set: item.set || "",
    headline: body.headline,
    path: body.headline,
    lines: body.lines.slice(0, 6),
    asOf,
    source,
    why,
    ...(body.price > 0 ? { price: body.price } : {}),
    startDate: h.evidence.from,
    endDate: h.evidence.to,
    strength: 0,
    receipt: { pathway: h.pathway, dir: h.dir || "", metrics: h.metrics, source: "PkmnPrices", fact: true, scored: false },
  };
}

// The scanner's public read for a passed ppp-* gate reuses these lines.
import { setPppFactBuilder } from "../scanner/reads.mjs";
setPppFactBuilder(factRead);
