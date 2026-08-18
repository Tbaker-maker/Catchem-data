# Sealed Product Images — fetch patch spec (CC lane, after current mission)
WHY: singles solved (pokemontcg.io deterministic scans, live tonight);
sealed has no free image API — but our eBay Browse responses already
include listing images we're licensed to display in-app.
PATCH fetch-sealed-prices.mjs: after filtering, pick the kept BIN listing
closest to the median → store its image.imageUrl as
`representativeImage` on the product (refresh each run; omit if absent —
consumers fall back to set logo automatically, field already honored).
Prefer higher-res variant if the API offers one. No extra API calls —
the data is in responses we already fetch. Attribution: footer line
"product photos via eBay listings" on Board/Pulse when field is live.

# ADDENDUM: Regulation-mark map (same CC pass or next)
pokemontcg.io cards carry `regulationMark`. One pass: for each tracked
setId, fetch 1 card (?select=regulationMark) → data/set-marks.json
{setId: mark}. Then legality goes EXACT: lifecycle gains
standardLegal:boolean + rotatesOut date from the mark table; Board/Pulse
swap "(est.)" for the real ⚖ tag. ~50 cheap calls, keyless.
