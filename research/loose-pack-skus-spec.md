# Loose Booster-Pack SKUs — spec (CC import block, post-report)
WHY: sealed premium = productPerPack vs LOOSE pack price. Engine + Pulse
display already live and null-graceful; this feed lights it.
IMPORT (~15, subtype "booster-pack", packs semantics = 1):
swsh5, swsh6, swsh7, swsh8, sv1, sv3pt5, sv4, sv8, sv8pt5, sv9, sv10,
me1, me2, me2pt5, me3 — searchQuery "<Set Name> booster pack",
excludeTitleWords += ["weighed","resealed","opened","empty","lot","x2",
"x3","packs","bundle","box","custom","art"], bounds floor $2.50 /
ceiling $75 (vintage stays out). Validate 4 live (incl swsh7 — expect
~$20-30 — and one ME ~$4-6), audit, commit. They auto-appear in Pack
Math as their own rows AND power sealedPremiumPct on every product.
