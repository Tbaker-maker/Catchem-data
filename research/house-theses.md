# House Theses — numbered, falsifiable, READ-class always
*These are Catch'em's standing market reads. They are context, never commands.
Every thesis carries its falsifier. UI/newsletter surface these with READ
chips and the standard disclosure. We never tell anyone to buy or sell.*

## RT-1 · The Reprint Cycle Thesis (Tyler, Aug 18 2026)
**Statement:** Reprint waves are long-term bullish. The moment of maximum
product on shelves is historically the cyclical price floor — reprints get
eaten, supply dries, and the cycle resumes from a wider ownership base.
**Mechanism:** reprints expand the collector base faster than they expand
permanent supply; sealed product exits circulation continuously (rips,
storage, loss) while demand compounds on the franchise.
**House posture:** we treat reprint announcements as short-term supply
events and long-term demand events. We never frame selling into a reprint
as the move — the exception is redeploying funds to something more
important, which is a personal-finance call, not a market call.
**Falsifier:** if a tracked reprint-era product class remains below its
pre-reprint trajectory 24–36 months after shelf sell-through, RT-1 is
wrong for that class and gets amended in public.
**Evidence base (building):** Celebrations print-volume case (error #5
context) · Evolving Skies post-reprint arcs · 151 restock waves. The
tracker now records these cycles as they happen.

## RT-2 · Supply Injection Absorb-or-Stall (existing doctrine, formalized)
Product injections (tins, bundles) into hot sets vent secondary-market
pressure. Absorption within the window = demand confirmation; stall =
distribution warning. Read per-event via listing deltas. Falsifier per
event, stated in the event coverage.

## RT-3 · Depth-Liquidity Matrix (Tyler, Aug 18 2026)
**Statement:** deep markets read differently by flow. High supply with
BUILDING listings = pile-up — supply outpacing estimated demand;
historically precedes softness. High supply with DRAINING listings =
churn — depth that's moving; historically reversal-prone / temporary.
Low supply + draining = thinning fast (scarcity forming). Low + building
= restock or interest fade — context decides.
**Inputs:** Active Listings (measured) × Buy Pressure est. (listing
deltas — not reported sales, per standing disclosure).
**House posture:** published as state reads on Deepest Markets, never
buy/sell imperatives. Per-product reads unlock at 3+ clean snapshot days.
**Falsifier:** if pile-up states precede 14-day price softness in <55%
of resolved cases (rolling log), thresholds get recalibrated in public.

## Lifecycle Doctrine (definitions, not a thesis — precision matters here)
Three clocks, three meanings — never conflate in copy:
- **Rotation** = ANNUAL, each April (next: in-person ~Apr 2027). Demand-side
  event for competitive staples; collector chases largely unaffected.
- **Legality window** = ~2-3 years per set via regulation mark. The "3-year"
  figure people quote is THIS, not print or rotation frequency.
- **Print window** = TPCi's active-production span (typically ~2-3yr, varies).
  SUPPLY-side. EOL = supply fixed forever = RT-1's cycle formally begins.
Print phases (EST, date-derived until better data): 0-12mo "active print" ·
12-30mo "late print — reprint waves typical" · 30mo+ "likely EOL — supply
fixed (est.)". Always labeled est.; exact EOL dates are rarely announced.

## RT-4 · The Photo Premium (Tyler, Aug 18 2026)
**Statement:** eBay structurally carries a modest premium over TCGplayer
on sealed because eBay listings show the actual item — seal condition,
corners, authenticity cues — while TCG sealed listings rarely have photos.
Buyers pay for certainty; they hesitate at high prices they cannot see.
**Implications:** (1) the +5-15% baseline gap is STRUCTURAL, not signal —
the mechanism behind the ≥15% flag threshold. (2) NEGATIVE gaps carry
extra weight: pricing eBay under photo-less TCG fights the trust premium —
reads as genuinely motivated selling. (3) Calibration note: with enough
resolved cases, consider an asymmetric (lower) negative threshold. Not
changed yet.
**Falsifier:** if the resting cross-market baseline measures ≤0% over a
rolling 60 clean days, the premium claim is wrong and gets amended in
public.

## RT-5 · The PSA-9 Tax / Fresh-Set Exception (first Premium table, Aug 18 2026)
**Statement:** on established SWSH/SV chases, a PSA 9 returns LESS than
raw minus fees — grading is a tax unless you hit the 10. Mega-era chases
invert this: scarce graded supply on fresh sets pays even at 9.
**Evidence (internal, PPT-derived, licensing-gated):** 12/12 chase table —
every SWSH/SV GP·9 negative (−$35 to −$345); all Mega-era GP·9 positive
(+$24 to +$104).
**Falsifier:** if fresh-set 9-premiums persist 12+ months post-release
instead of decaying toward the tax as graded supply builds, the mechanism
is wrong — recheck in public.
**Surface rule:** publishes only after PPT licensing clears; then it IS
the Grader's Corner franchise.

## RT-4a · Venue Boundary (Tyler, Aug 18 2026 — amends RT-4)
Cross-market gap reads are only valid where BOTH venues actually trade
the class. Sun & Moon and older sealed rarely moves on TCGplayer — that
market lives on eBay, card shows, and FB/IG groups. For those eras a
TCG comparison measures venue death, not demand. RULE: gap signals are
gated OFF for the off-TCG era class; vintage reads use eBay-native
stats only (median, clean floor, range, listings, Δ). The +26.9% S&M
"squeeze" of Aug 18 was the case study — half real scarcity, half
artifact. Falsifier: if TCG vintage-sealed volume ever becomes material
(sustained listings depth comparable to modern), re-open the gate.

## RT-4b · Commodity-Pack Venue Rule (Tyler, Aug 20 — corollary to RT-4)
The photo premium exists because photos show THE SPECIFIC ITEM. A sealed
booster pack is a commodity — any copy equals any copy — so the premium
has no justification in the pack class, and eBay pack asks carry
scalp-spread noise instead. RULE: per-pack anchors (the sealed-premium
basis) source from TCGplayer wherever mapped; eBay only as a flagged
fallback. Case study: EvSkies loose at $54.95 eBay looked rich — the
TCG basis will reset it and sealed premiums will read MORE honest (and
likely higher). Falsifier: if mapped TCG pack prices persistently sit
ABOVE eBay asks for the same SKU, the commodity assumption fails here.

## SLOP DEFENSE (Tyler, Aug 21 — doctrine, not a thesis)
"AI slop is an easy tag to get and a hard one to remove." A confidently
published wrong number is the fastest route to that tag, and no amount of
good writing survives it. THEREFORE: we publish slower than we compute.
THREE LAYERS, all automatic:
1. FILTERS (fetch) — scam vocabulary, damage words, language, bounds,
   currency, and the multi-item guard (lots/cases/x2/bundles).
2. THE GATE (scripts/qa-gate.mjs) — runs before ANY publishing step.
   BLOCKS a product from Daily Three, social posts, cards, and the
   newsletter when its number looks corrupted: >30% overnight median
   move (filter drift, not market), >60% from TCGplayer on a
   both-venues product, or fewer than 5 listings. WARNS (visible, not
   blocking) on shape anomalies like a high 3× the median.
3. THE TRAIL — every product stores its three priciest kept listings, so
   any suspicious median is auditable in seconds rather than guessed at.
BLOCKED ≠ HIDDEN: the number stays in the data and on the Board, labeled.
It just doesn't get a megaphone until it passes. Transparency and
restraint are the same policy here.
FOUNDER-QA LAW: when Tyler flags a number from lived market experience,
that flag outranks the pipeline. Quarantine first, investigate second,
fix the CLASS of bug, then re-verify at the next run.

## RT-6 · Scheduled-Event Anticlimax (Tyler, Aug 21)
CLAIM: scheduled, calendar-known events in this hobby — annual Standard
rotation, print-window closes, announced reprints — generate their
market and attention effects in ANTICIPATION, not on the day. The date
itself typically passes as a non-event. Tyler's analogy: the Bitcoin
halving — heavily discussed as it approaches, then the day arrives and
almost nobody marks it, because nothing visibly happens.
WHY IT MATTERS: it corrects a framing error we made — describing a
rotation as having passed "quietly," which implies a norm of loudness
that does not exist. Rotation is quiet EVERY year. The correct framing
for countdown content is that the anticipation window is where behavior
changes; the date is administrative.
IMPLICATION FOR OUR CONTENT: countdowns should describe what typically
happens in the RUN-UP, and explicitly note that the day itself usually
passes without a visible move. Never frame a scheduled date as a shock.
FALSIFIER: if a rotation date or print-window close produces a
measurable, same-week move across the affected cohort in our own index
(beyond normal breadth), the anticlimax framing is wrong for that class
and we amend in public.
STATUS: READ — based on Tyler's market experience plus the structural
logic of pre-announced events; not yet measured in our own tape. First
real test: the 2027-04 rotation, with cohort data by then.

## THE REFEREE DOCTRINE (Tyler, Aug 22 2026)
"Non-biased tools that help both of them — not a them-versus-them."
We publish the SAME numbers to buyers and vendors, and we never frame one
as the other's opponent. Rules:
- No adversarial verbs. Nobody "outsmarts", "beats", "wins against", or
  "gets one over on" anyone. The instruments show what each side's
  alternative is worth; the humans negotiate.
- No implication that a vendor is hiding something. Vendors price against
  their own costs and risks, and most price honestly. A buyer being
  uninformed is not evidence that anyone is being cheated.
- Symmetry test before publishing any show-floor copy: would a vendor
  reading this feel served, or feel targeted? If targeted, rewrite. The
  same test runs in reverse.
- Our credibility with vendors is a business asset. Vendors run the
  Discords, the shows, the shops, and the streams. A buyer-flattering
  headline buys one day of engagement and costs a permanent channel.
WHY IT HOLDS COMMERCIALLY, not just ethically: the referee is the only
position that both sides link to. A partisan tool gets cited by half a
market and blocked by the other half.

## SKU LAW ADDENDUM — BREAK-OUT PACKS (ruling, Aug 22 2026)
swsh45 is Shining Fates (verified: Bulbapedia, PokeCardex /series/SWSH45,
and Pokemon.com's own checklist file swsh45_web_cardlist_en.pdf). The id
was right; the product NAME was wrong and read "SWSH Promos". Corrected.
THE LARGER FINDING: Pokemon.com states Shining Fates booster packs were
never sold separately — they came only inside special collections. So
loose Shining Fates packs are genuine but were broken out of tins, ETBs
and pin collections. That is a BREAK-OUT market, not a retail one.
RULE: a pack SKU for a set whose packs were never sold separately gets a
sourceNote saying so, and its per-pack figures are read as break-out
supply. Applies to the same family as the SKU LAW (special/mini sets):
Hidden Fates, Shining Fates, Champion's Path, Celebrations, Crown Zenith,
Paldean Fates, Shrouded Fable, Prismatic Evolutions and the Mega
special sets — verify before treating any of their packs as retail.
WHY IT MATTERS: break-out packs price differently from retail packs
(the seller has already banked the collection's other contents), so
using one as a per-pack basis without the label would quietly distort
a sealed premium.
