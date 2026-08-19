// scripts/lib/instruments.mjs — the load-bearing math in ONE place.
// One-equation doctrine: engines import from here; scripts/tests/ import the
// SAME functions — tested code is shipped code, no theater.

// Index level (composite / raw chase / graded when it debuts): equal-weight
// mean of per-product ratios vs each product's own first clean-history price,
// ×100, one decimal. Composition-invariance: a new entrant joins at its own
// baseline (ratio 1.0), so entry/exit never jumps the level.
export const indexLevel = (ratios) =>
  ratios.length ? Math.round(ratios.reduce((a, c) => a + c, 0) / ratios.length * 1000) / 10 : 100.0;

// RT-4a venue gate: eBay-native-era ids (vintage-class venues) never emit
// cross-market signals — the TCG-side comparison is gated, data kept+labeled.
export const offTcgEra = (id) => /^(sm|xy|base|neo|hgss|bw|det|dp)/.test(id);

// Sealed premium vs the loose-pack lane, thin-n aware: a lane with fewer than
// 10 kept listings still computes but carries thin:true (flagged, not hidden).
export const sealedPremium = (perPack, loosePack, looseN) => {
  const pct = loosePack ? Math.round((perPack / loosePack - 1) * 1000) / 10 : null;
  return { pct, thin: pct != null && (looseN ?? 0) < 10 };
};

// Merge-by-date guard (the pathogen rule): today's rows replace TODAY only;
// prior history survives verbatim. The 8-vs-329 class: 8 fresh rows must
// never become the whole file.
export const mergeByDate = (existing, todays, today, keyOf = (e) => e.date) =>
  [...(existing || []).filter((e) => keyOf(e) !== today), ...todays];
