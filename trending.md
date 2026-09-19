---
title: Catch'Em — Trending
---

# Catch'Em — Trending

Live desk. TCG copies **sold**, not eBay listings, not a print run. Tools pick the play. A person does not lock it.

**As of:** 2026-09-19 (TCG solds through 2026-09-18; today is still filling in)  
**Machine copy:** [trending.json](https://tbaker-maker.github.io/Catchem-data/trending.json)

## The instruction (Fill / Watch / Wait)

Catch'Em tells you what to do tonight. Confidence is how sure we are of **that instruction** — not a buy score. 68 is not a buy.

| Instruction | Means | Turns into Fill when |
|---|---|---|
| **Fill** | Buy it tonight if you already wanted it. Copies dried. New lows stopped. The set is a collector product now. Not a promise it pays. | — |
| **Watch the floor** | Mark the low. Do not dump under it. Do not buy the first bounce. | The next dip sits **above** that low and sells **fewer copies** than the wash. Extra boxes look done. |
| **Wait** | Do nothing tonight. New lows are still printing, or the shape is early. | New lows stop for days, copies sold dry up, and the listed price stays quiet above the low. |
| **Don't chase** | The listed price already jumped. Paying tonight is paying after the move. | The listed price comes back in and copies stop running. |
| **Pass** | Walk away. More copies just hit at a high listed price. | New copies stop hitting and the listed price stops falling. |
| **Hold** | Keep what you already own only while copies for sale keep leaving. | Stays Hold while that is true. Turns into Wait if copies stall on the shelf. |

**Rules the tools will not break**

- A reprint dump looks like a selling climax. We never Fill on climax-only. We never buy the climax day.
- Still cutting (new lows in the last 3 days) → **Wait**. A floor is not a floor while it is still dropping.
- Factory can still add boxes (set still in play) → **Watch the floor** at most. Fill only when the set already left play **and** the low held.
- eBay listing count ≠ TCG copies sold ≠ print run. We do not average them.

## Tonight's desk

| Product | Instruction | Tonight | Floor | Why |
|---|---|---|---|---|
| Destined ETB | **Watch the floor** | $113.56 | $106.78 (Aug 27) | Copies spiked, then dried. Second low sat above the first. Set still in play — factory can still add boxes. Do not pay up. |
| Destined box | **Watch the floor** | $426.26 | $399.76 (Aug 28) | Same shape. Best booster box of its era on the shelf — still printable. Watch the floor, do not Fill. |
| Destined bundle | **Wait** | $66.10 | $65.40 | Still cutting. New lows are printing. |
| Prismatic bundle | **Watch the floor** | $90.74 | $74.95 (Aug 22) | Copies dried. Higher low. Price bounced ~21% off the low — that bounce is not Fill. Mark $74.95. |
| Prismatic ETB | **Wait** | $140.56 | $139.53 | Still cutting. Do not call a floor on a one-day tick. |
| Prismatic PC ETB | **Wait** | $412.52 | $411.68 | Still cutting. Promo 10 (Eevee SVP 173) is a fat 10 (~26% gem) — that is not a scarce-10 story. |
| 151 bundle | **Wait** | $161.94 | $161.94 | Still cutting. 36 copies sold on Sep 18 vs ~16/day earlier. A wash is in progress, not a floor. |
| 151 ETB | **Wait** | $510.53 | $510.53 | Still cutting. Thin sold tape. |
| Surging Sparks box | **Wait** | $302.96 | $301.44 | Still cutting. Still in play. |
| Perfect Order box | **Watch the floor** | $176.20 | $170.08 (Aug 27) | Copies dried after a wash. Brand-new set — extra boxes will land. Do not pay up. |
| Perfect Order ETB | **Watch the floor** | $68.62 | $68.62 | Same. New set. Watch, do not Fill. |
| Evolving Skies box | **Wait** | $2,426.48 | $2,426.48 | Still cutting on a thin sold tape. Collector product. Not a floor call. |

Destined is the best booster box of its era. 151 and Prismatic beat it as specialty sets — they do not have a booster box. That ranking does not change the instruction: Destined is still in play, so the instruction is **Watch the floor**, not Fill.

## How the tools call a floor

Verified on TCG sold copies (Pokemon is not stocks — oscillators and order-book delta do not transfer):

1. **Climax** — copies sold ≥ 2× average, at or near the 30-day low.
2. **Exhaust** — after that wash, copies sold drop to ≤ 60% of the first week, and new lows have stopped for ≥ 5 days.
3. **Higher low** — a second low prints **above** the first, on fewer copies (quiet retest).
4. **Still cutting** — a new low in the last 3 days. Veto. Wait.
5. **Clock** — set still in play → long (factory can add boxes). Set left play → near (extra boxes are unlikely, not a lock).

Fill needs: near clock + higher-low/forming + exhaust + within 8% of the low + that low is ≥ 8 days old.

## What this is / is not

- This page is the public desk Catch'Em Bot should read. The scrolling app is the same brain.
- Not financial advice. Fill means "you can actually get one tonight," not "this goes up."
- We never explain an old mistake in a headline. We never call Moonbreon a rainbow. Evolving Skies 215 is Alternate Art.
- Pokémon has almost always stopped printing a set after it leaves play. Almost always — not a guarantee.

## Verify

Open this page. The first heading is **Catch'Em — Trending**. Then open [trending.json](https://tbaker-maker.github.io/Catchem-data/trending.json) and confirm `plays[0].play` is a real instruction (Fill / Watch the floor / Wait / Don't chase / Pass / Hold).
