import { readFileSync } from "node:fs";
import { isClean } from "../lib/copy-rules.mjs";
import { qualifyChips, readSignals, signalsLookSecret } from "../lib/signal-chips.mjs";

// Fixture cutoffs only. The live numbers stay in catchem-data-private.
const RULES = {
  max: 4,
  move: { flatAbs: 10, preferDays: [7, 21], slackDays: 1, minDays: 2 },
  supply: { minAbsPct: 5 },
  gone: { cuts: [3, 10] },
  range: { minDays: 7 },
  momentum: { risingMin: 4, coolingMax: -4, recentDays: 7 },
  confidence: { cuts: [3, 8] },
  era: { vintageBefore: "2011-01-01" },
  boost: [{ kind: "art", badge: "SIR", aheadOf: "range" }],
};

function points() {
  const start = Date.parse("2026-10-01T00:00:00Z");
  const out = [];
  for (let i = 0; i < 17; i++) {
    const iso = new Date(start + i * 86400000).toISOString().slice(0, 10);
    out.push([iso, 100 + i]);
  }
  return out;
}

function rich() {
  return {
    read: {
      id: "fake-all",
      name: "Umbreon ex",
      kind: "single",
      href: "/c/tcgcsv-9001",
      asOf: "2026-10-17",
      price: 116,
      tags: ["Special Illustration Rare"],
    },
    ctx: {
      asOf: "2026-10-17",
      points: points(),
      listings: { n: 82, prev: 100, date: "2026-10-17" },
      release: "2024-01-15",
      rotationMonths: 4,
    },
  };
}

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const open = RULES.max;
  const wide = { ...RULES, max: 9 };
  const { read, ctx } = rich();
  const all = qualifyChips(read, ctx, wide);
  const kinds = all.map((chip) => chip.kind);
  for (const kind of ["move", "supply", "gone", "range", "momentum", "rotation", "art", "era", "confidence"]) {
    t(`qualifies ${kind}`, kinds.includes(kind));
  }
  const full = readSignals(read, ctx, wide);
  t("a wide cap keeps every chip family", full.signals.length === 9);
  t("public kinds use listings, never the word supply", full.signals.some((chip) => chip.kind === "listings") && !JSON.stringify(full).includes("supply"));
  const capped = readSignals(read, ctx, RULES);
  t("the read keeps at most 4", capped.signals.length === open && capped.signals.length === 4);
  t("SIR is kept when it matters for the card", capped.signals.some((chip) => chip.kind === "art" && chip.badge === "SIR"));
  t("no secret fields on the public chips", !signalsLookSecret(capped) && !signalsLookSecret(full));
  t("the blurb is one clean line", capped.blurb && isClean(capped.blurb) && !/[\u2013\u2014]/.test(capped.blurb) && !/\bsold\b|\bsales\b/i.test(capped.blurb));
  for (const chip of full.signals) t(`label clean ${chip.kind}`, isClean(chip.label) && !/[\u2013\u2014]/.test(chip.label));

  const checked = readSignals({ ...read, id: "fake-check", priceStatus: "checking" }, ctx, wide);
  t("a price being checked is a grey dash and not a percent", checked.signals.some((chip) => chip.kind === "move" && chip.dir === "dash" && chip.text === "") && !checked.signals.some((chip) => chip.kind === "range" || chip.kind === "momentum"));
  t("the checked blurb passes", checked.blurb === "Price being checked." && isClean(checked.blurb));

  const sealed = readSignals({
    id: "fake-sealed",
    name: "Temporal Forces Booster Bundle",
    kind: "sealed",
    href: "/p/sv5-bb",
    asOf: "2026-10-17",
    tags: ["Special Illustration Rare"],
  }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17" },
    release: "2024-03-22",
  }, wide);
  const sealedText = JSON.stringify(sealed);
  t("a sealed read has no condition chip and no art badge", !sealed.signals.some((chip) => chip.kind === "art") && !/\bNM\b|Near Mint|condition/i.test(sealedText));
  t("a sealed read can show listings counted", sealed.signals.some((chip) => chip.kind === "listings"));
  t("sealed lines stay clean", (!sealed.blurb || isClean(sealed.blurb)) && sealed.signals.every((chip) => isClean(chip.label)));

  const empty = readSignals({ id: "fake-empty", kind: "news", asOf: "2026-10-17" }, {}, RULES);
  t("an empty row has no chips and no blurb", empty.signals.length === 0 && empty.blurb === "");

  const strength = {
    proven: [],
    weights: {},
    fallback: {
      move: [1, 2, 3, 4],
      listings: [1, 2, 3, 4],
      gone: [1, 2, 3, 4],
      range: [0.1, 0.3, 0.6, 0.9],
      momentum: [1, 2, 3, 4],
      rotation: { invert: true, cuts: [12, 6, 3, 2] },
      art: { FA: 2, IR: 3, SIR: 5 },
      era: { Vintage: 1, Modern: 1 },
      confidence: [0, 1, 2, 3],
    },
  };
  const dotted = readSignals(read, ctx, { ...wide, strength });
  t("every chip family has 1 to 5 dots", dotted.signals.length === 9 && dotted.signals.every((chip) => chip.strength >= 1 && chip.strength <= 5 && chip.strength === Math.round(chip.strength)));
  t("no proven signals means no overall score", dotted.strength == null);
  t("dot output keeps the cutoff words private", !signalsLookSecret(dotted) && !JSON.stringify(dotted).includes("proven") && !JSON.stringify(dotted).includes("weight"));
  for (const chip of dotted.signals) t(`dotted label clean ${chip.kind}`, isClean(chip.label) && isClean(dotted.blurb) && !/[\u2013\u2014]/.test(chip.label + dotted.blurb));

  const dash = readSignals({ ...read, id: "fake-dash", priceStatus: "checking" }, ctx, { ...wide, strength });
  t("a grey dash has no dots", dash.signals.some((chip) => chip.kind === "move" && chip.dir === "dash" && chip.strength == null && !String(chip.text || "").includes("%")));

  const sealedDots = readSignals({
    id: "fake-sealed-dots",
    name: "Temporal Forces Booster Bundle",
    kind: "sealed",
    href: "/p/sv5-bb",
    asOf: "2026-10-17",
  }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17" },
    release: "2024-03-22",
    points: points(),
  }, { ...wide, strength });
  const sealedDotsText = JSON.stringify(sealedDots);
  t("a sealed read with dots never says NM", !/\bNM\b|Near Mint|\bcondition\b/i.test(sealedDotsText) && sealedDots.signals.some((chip) => chip.kind === "listings" && chip.strength >= 1));

  const scored = readSignals(read, ctx, { ...wide, strength: { ...strength, proven: ["move"], weights: { move: 2 } } });
  t("a proven move sets one score from 1 to 5", scored.strength >= 1 && scored.strength <= 5);
  const unmatched = readSignals(read, ctx, { ...wide, strength: { ...strength, proven: ["not-a-kind"] } });
  t("a proven list that matches nothing hides the score", unmatched.strength == null && unmatched.signals.every((chip) => chip.strength >= 1));

  const src = readFileSync(new URL("../lib/signal-chips.mjs", import.meta.url), "utf8");
  t("the public module has no baked cutoff numbers", !/flatAbs\s*:\s*\d/.test(src) && !/cuts\s*:\s*\[/.test(src) && !/fewSellersMax\s*:\s*\d/.test(src) && !/manySellersMin\s*:\s*\d/.test(src));

  const leadRules = {
    ...wide,
    supply: { minAbsPct: 5, windowDays: 7, slackDays: 1, paceMultiple: 1, flatAbs: 3, stageDays: 3, fewSellersMax: 3, fewShareMin: 0.5, manySellersMin: 8 },
  };
  const series = [];
  for (let i = 0; i < 8; i++) {
    const iso = new Date(Date.parse("2026-10-10T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    series.push({ date: iso, n: 100 - i * 3 });
  }
  const lead = readSignals({
    id: "fake-supply",
    name: "Example Box",
    kind: "sealed",
    href: "/p/example-box",
    asOf: "2026-10-17",
  }, {
    asOf: "2026-10-17",
    listings: {
      n: 79,
      prev: 100,
      date: "2026-10-17",
      series,
      sellers: 12,
      topShare: 0.2,
      sellerNames: ["alice-seller", "bob-seller"],
      username: "alice-seller",
    },
    points: points(),
  }, leadRules);
  const leadChip = lead.signals.find((chip) => chip.kind === "listings");
  const leadText = JSON.stringify(lead);
  t("the supply chip leads and names the window", lead.signals[0]?.kind === "listings" && /Listings -\d+% \d+d/.test(leadChip?.text || "") && leadChip.text.includes("Draining") && leadChip.text.includes("Many sellers"));
  t("seller names never reach the public chip", !leadText.includes("alice-seller") && !leadText.includes("bob-seller") && !leadText.includes("username") && !leadText.includes("sellerNames"));
  t("the supply blurb stays clean", isClean(lead.blurb) && !/[\u2013\u2014]/.test(lead.blurb) && !/\bsold\b|\bsales\b|\bsupply\b/i.test(lead.blurb));
  const few = readSignals({
    id: "fake-few",
    name: "Example Box",
    kind: "sealed",
    href: "/p/example-box",
    asOf: "2026-10-17",
  }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17", sellers: 2, topShare: 0.8 },
  }, leadRules);
  t("a concentrated count says few sellers", (few.signals.find((chip) => chip.kind === "listings")?.text || "").includes("Few sellers"));
  return fail;
}
