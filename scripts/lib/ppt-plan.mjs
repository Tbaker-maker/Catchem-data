// Credit plan for PokemonPriceTracker. No network. No prices. No key.
export const DAILY_CREDITS = 20000;
export const MAIN_BUDGET = 16000;
export const RESERVE_BUDGET = 4000;
export const CROSSCHECK_CREDITS = 137;
export const SEALED_TARGET = 1000;
export const SLAB_TARGET = 1000;
export const HISTORY_DAYS = 180;

const TIER_RANK = ["sir", "ir", "gallery", "hyper", "alt", "rare-over-5", "other"];

export function tierOf(card) {
  const rarity = String(card?.rarity || "");
  const blob = `${rarity} ${card?.setName || ""} ${card?.name || ""}`.toLowerCase();
  if (rarity === "Special Illustration Rare") return "sir";
  if (rarity === "Illustration Rare") return "ir";
  if (/trainer gallery|galarian gallery/.test(blob)) return "gallery";
  if (rarity === "Hyper Rare" || /\bgold\b/.test(blob)) return "hyper";
  if (rarity === "Rare Ultra" || rarity === "Rare Rainbow" || /full art|alternate art|alt art/.test(blob)) return "alt";
  if (/rare/i.test(rarity) && Number(card?.price) > 5) return "rare-over-5";
  return "other";
}

export function creditCost({ hasHistory = false, includeEbay = false } = {}) {
  if (hasHistory && !includeEbay) return 1;
  return 1 + (hasHistory ? 0 : 1) + (includeEbay ? 1 : 0);
}

export function minuteUnits(cards) {
  const n = Math.max(1, cards);
  return Math.min(30, Math.ceil(n / 10));
}

// Whole-set pull when it does not cost more credits than one lookup per wanted card.
export function chooseQuery(want, setSize, perCard = 2) {
  if (!(setSize > 0) || !(want > 0)) return "skip";
  const setCost = setSize * perCard;
  const eachCost = want * perCard;
  if (want >= setSize && setCost <= eachCost) return "fetchAllInSet";
  if (want >= 15 && setCost <= eachCost) return "fetchAllInSet";
  return "byId";
}

export function schedule(buckets, budget = MAIN_BUDGET) {
  let day = 1;
  let left = budget;
  const tiers = [];
  for (const bucket of buckets) {
    let remain = bucket.credits;
    if (!(remain > 0)) {
      tiers.push({ tier: bucket.tier, credits: 0, items: bucket.items || 0, startDay: null, endDay: null, days: 0 });
      continue;
    }
    const start = day;
    while (remain > 0) {
      const take = Math.min(left, remain);
      remain -= take;
      left -= take;
      if (left === 0 && remain > 0) {
        day += 1;
        left = budget;
      }
    }
    const end = day;
    tiers.push({
      tier: bucket.tier,
      credits: bucket.credits,
      items: bucket.items || 0,
      startDay: start,
      endDay: end,
      days: end - start + 1,
    });
    if (left === 0) {
      day += 1;
      left = budget;
    }
  }
  const days = tiers.reduce((m, row) => Math.max(m, row.endDay || 0), 0);
  return { days, tiers };
}

export function intradayPlan(sampleChanged) {
  if (sampleChanged === true) {
    return {
      tested: true,
      pricesChanged: true,
      mode: "every-4-hours",
      runsUtc: [0, 4, 8, 12, 16, 20],
      perRunItems: 650,
      note: "Prices moved in the 50-item sample, so the reserve refreshes top demand about every 4 hours. The last run before 00:00 UTC spends what is left.",
    };
  }
  if (sampleChanged === false) {
    return {
      tested: true,
      pricesChanged: false,
      mode: "one-late-run",
      runsUtc: [22],
      note: "The 50-item sample did not change during the day, so the reserve is one late run.",
    };
  }
  return {
    tested: false,
    pricesChanged: null,
    mode: "untested",
    runsUtc: [],
    note: "No same-day sample yet. The reserve is not spent on a 4-hour loop.",
  };
}

export function createLimiter({ unitsPerMinute = 60, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const window = [];
  return async function reserve(units) {
    for (;;) {
      const t = now();
      while (window.length && t - window[0].at >= 60000) window.shift();
      const used = window.reduce((sum, row) => sum + row.units, 0);
      if (used + units <= unitsPerMinute) {
        window.push({ at: t, units });
        return;
      }
      const wait = 60000 - (t - window[0].at) + 1;
      await sleep(wait);
    }
  };
}

export function buildPlan({ sealed = [], sets = [], slabCandidates = 0, slabExecutable = 0 } = {}) {
  const sealedItems = sealed.length;
  const sealedCredits = sealed.reduce((sum, row) => sum + (row.hasHistory ? 1 : 2), 0);
  const setRows = sets.map((set) => ({
    ...set,
    credits: (set.cardCount || 0) * 2,
    query: "fetchAllInSet",
  }));
  const singlesCredits = setRows.reduce((sum, set) => sum + set.credits, 0);
  const singlesItems = setRows.reduce((sum, set) => sum + (set.cardCount || 0), 0);
  const slabCredits = slabExecutable * 3;
  const buckets = [
    { tier: "sealed", credits: sealedCredits, items: sealedItems },
    ...tierBuckets(setRows),
    { tier: "slabs", credits: slabCredits, items: slabExecutable },
  ];
  // Sealed and singles share the ordered set list. Tier buckets above are a
  // rollup of the same set credits so days are not double counted.
  const ordered = [
    { tier: "sealed", credits: sealedCredits, items: sealedItems },
    { tier: "singles", credits: singlesCredits, items: singlesItems },
    { tier: "slabs", credits: slabCredits, items: slabExecutable },
  ];
  return {
    budgets: {
      daily: DAILY_CREDITS,
      main: MAIN_BUDGET,
      reserve: RESERVE_BUDGET,
      crosscheckInsideReserve: CROSSCHECK_CREDITS,
    },
    sealed: {
      queued: sealedItems,
      target: SEALED_TARGET,
      shortfall: Math.max(0, SEALED_TARGET - sealedItems),
      credits: sealedCredits,
      note: sealedItems < SEALED_TARGET
        ? `Only ${sealedItems} sealed products have a TCGplayer id on file. The other ${SEALED_TARGET - sealedItems} toward the 1,000 target are not queued, because an id was not invented.`
        : "Sealed queue meets the 1,000 target.",
    },
    singles: {
      items: singlesItems,
      credits: singlesCredits,
      sets: setRows.length,
      byTier: countTiers(setRows),
    },
    slabs: {
      candidates: slabCandidates,
      executable: slabExecutable,
      target: SLAB_TARGET,
      credits: slabCredits,
      separateFromSingles: true,
      note: slabExecutable
        ? "Slab pulls use includeEbay and stay out of the singles files."
        : "Top chase cards are counted, but none have a TCGplayer id on this branch, so no slab call is queued.",
    },
    schedule: schedule(ordered),
    tierRollup: buckets,
    intraday: intradayPlan(null),
    tiers: TIER_RANK,
  };
}

function countTiers(sets) {
  const out = Object.fromEntries(TIER_RANK.map((tier) => [tier, 0]));
  for (const set of sets) for (const tier of TIER_RANK) out[tier] += set.tiers?.[tier] || 0;
  return out;
}

function tierBuckets(sets) {
  const totals = Object.fromEntries(TIER_RANK.map((tier) => [tier, { tier, credits: 0, items: 0 }]));
  for (const set of sets) {
    for (const tier of TIER_RANK) {
      const n = set.tiers?.[tier] || 0;
      totals[tier].items += n;
    }
  }
  // Credits for a tier are not separable: fetchAllInSet bills the whole set.
  // Item counts are the priority signal. Credits stay on the singles line.
  return TIER_RANK.map((tier) => totals[tier]);
}

function emptyTiers() {
  return Object.fromEntries(TIER_RANK.map((tier) => [tier, 0]));
}

export function planFromRecords({ sealed = [], cards = [], setMap = {}, slabCandidates = 0, slabExecutable = 0 } = {}) {
  const bySet = new Map();
  let blocked = 0;
  for (const card of cards) {
    const mapped = setMap[card.setId];
    if (!mapped?.pptSetId || !(mapped.cardCount > 0)) {
      blocked += 1;
      continue;
    }
    if (!bySet.has(card.setId)) {
      bySet.set(card.setId, {
        setId: card.setId,
        pptSetId: mapped.pptSetId,
        cardCount: mapped.cardCount,
        tiers: emptyTiers(),
      });
    }
    bySet.get(card.setId).tiers[tierOf(card)] += 1;
  }
  const sets = orderSets([...bySet.values()]);
  const plan = buildPlan({
    sealed,
    sets,
    slabCandidates,
    slabExecutable,
  });
  plan.blockedNoSetId = blocked;
  plan.setOrder = sets;
  return plan;
}

export function orderSets(sets) {
  const weight = { sir: 5, ir: 4, gallery: 3, hyper: 3, alt: 2, "rare-over-5": 1, other: 0 };
  return [...sets].sort((a, b) => score(b, weight) - score(a, weight) || String(a.setId).localeCompare(String(b.setId)));
}

function score(set, weight) {
  let n = 0;
  for (const [tier, w] of Object.entries(weight)) n += (set.tiers?.[tier] || 0) * w;
  return n;
}

export function usageSkeleton(plan, { asOf, status, reason }) {
  return {
    asOf,
    status,
    reason,
    credits: {
      budget: DAILY_CREDITS,
      main: MAIN_BUDGET,
      reserve: RESERVE_BUDGET,
      used: { sealed: 0, singles: 0, slabs: 0, intraday: 0, crosscheck: 0, total: 0 },
      remaining: DAILY_CREDITS,
    },
    items: { sealed: 0, singles: 0, slabs: 0 },
    errors: [],
    estimate: {
      sealedQueued: plan.sealed.queued,
      sealedTarget: plan.sealed.target,
      sealedShortfall: plan.sealed.shortfall,
      singlesItems: plan.singles.items,
      slabsExecutable: plan.slabs.executable,
      days: plan.schedule.days,
      tiers: plan.schedule.tiers,
      singlesByTier: plan.singles.byTier,
    },
    intraday: plan.intraday,
    note: "Public log only. No API key and no raw prices.",
  };
}
