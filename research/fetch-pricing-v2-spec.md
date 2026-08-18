# Fetch Pricing v2 — spec (Tyler-caught, Aug 18: "cheaper on eBay than we say")

## Findings (proven in code+data)
1. No `buyingOptions` filter → AUCTIONS pollute an ASK median (sv8pt5-sc
   priceLow $7 = live-bid or junk).
2. Item price only — shipping ignored → free-ship vs +ship listings
   incomparable; median ≠ landed cost.
3. `special-collection` subtype has NO price bounds (failPrice: 0).
4. Median presented alone invites "found it cheaper" gotchas (median≠floor).

## Patch (CC validates + deploys)
a) Browse API: add `filter=buyingOptions:{FIXED_PRICE}` — ask median = BINs only.
b) deliveredPrice = price.value + min(shippingOptions[].shippingCost.value);
   missing shipping data → use item price, count in new field
   `shipUnknownCount` (transparency, not silent).
c) Bounds for special-collection class: sv8pt5-sc floor $50 / ceiling $250
   (junk-kill; evidence: real BIN cluster $85–120).
d) Store `priceFloorClean` = cheapest kept BIN → user-facing pairs:
   "median $X · cheapest clean $Y". Board/Pulse adopt the pair.

## Expected effects — say them BEFORE the rerun
Auction-removal ↑ median · shipping-inclusion ↑ · junk-floor-kill ↑ ·
BUT cheap-BIN reality may ↓ it. Net direction UNKNOWN → the +44.5%
Surprise Box signal is UNDER REVIEW until the patched run; do not post
that angle. All spread history restarts clean post-patch (same rule as
the Aug 17 fix — no mixing regimes).
