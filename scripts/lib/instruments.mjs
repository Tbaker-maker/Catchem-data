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

// ── Sandbox rule (Voice v6): every instrument ships an ELI5, wired BEFORE
// its debut so the launch arrives pre-translated. Dark until these dates.
export const HEAT_DEBUT = "2026-08-26";   // 8 clean history days
export const DEPTH_DEBUT = "2026-08-21";  // first 3-day flow verdicts

// Heat states in plain words — the four weathers of a Pokémon box (plus a
// calm day). Engine vocab: compute-heat-states.mjs Wyckoff states.
export const heatPlain = {
  markup:       { emoji: "🔥", label: "Heating up", plain: "more people want the box than there are boxes — price climbing while the shelf empties" },
  markdown:     { emoji: "❄️", label: "Cooling off", plain: "fewer hands reaching — price sliding while boxes pile up" },
  accumulation: { emoji: "😴", label: "Quiet gathering", plain: "nobody's shouting, but the shelf keeps emptying — the quiet before a move" },
  distribution: { emoji: "📤", label: "Selling into strength", plain: "price looks strong but sellers keep restocking the shelf into it — strength being sold" },
  ranging:      { emoji: "⏸", label: "A calm day", plain: "price wandering inside its usual room — no weather to report" },
};

// Depth-read flows in plain words (3-day listing-count lens).
export const depthPlain = {
  calibrating: { emoji: "⏳", label: "Still counting", plain: "we need three clean days before we say anything — honesty over speed" },
  draining:    { emoji: "📉", label: "Shelf emptying", plain: "listings disappearing faster than they're replaced — scarcity forming" },
  building:    { emoji: "📦", label: "Shelf filling", plain: "more copies arriving than selling — restocking, or interest fading; context decides" },
};
