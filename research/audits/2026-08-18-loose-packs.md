# Loose-Pack Lane Audit — 15 SKUs — 2026-08-18

Catalog: 153 → 168. New subtype booster-pack [2.50–75] with spec scam-vocab
plus a per-subtype UN-exclude mechanism ("single"/"1 pack"/"single pack" are
junk-markers everywhere else, product-definition here).

## Validation (4 live)
| SKU | median | n | vs spec expectation |
|---|---|---|---|
| swsh7-pack | **$55** | 67 | spec said ~$20-30 — LIVE MARKET WINS; coherent with $80.53/pack-in-box (sealed premium +46%) |
| me2-pack | $15 | 27 | spec said ME ~$4-6 — Phantasmal runs hot everywhere; NOT forced to expectation |
| sv8pt5-pack | $16.50 | 24 | — |
| sv9-pack | $8.99 | 24 | sane vs $8.05/pack-in-box (fresh set ≈ parity) |

## Filter leaks caught + fixed (dated in code)
1. "JP Sealed Random Pack x20 Unsearched" $50 passed → bare "jp" added to
   language excludes; x10/x12/x20/x36 + reversed forms added to lot tokens;
   "unsearched" added to pack excludes.
2. "PSA 8 NM-MINT ... SEALED Booster Pack" $49.99 passed → psa/cgc/bgs/
   graded excluded for booster-pack (slabbed packs are a collectible market,
   not street price).
Both re-validated clean (me2 $15 n=27, sv8pt5 $16.50 n=24).

## Effects downstream
sealedPremiumPct lights on the next production run; packs appear in Pack
Math as their own rows. First real read: EvSkies sealed premium ≈ +46%
($80.53 in-box vs $55 loose) — the aging-box premium made visible.
