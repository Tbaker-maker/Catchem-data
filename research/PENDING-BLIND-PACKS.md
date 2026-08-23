# Blind packs — a strong idea with a structure that decides everything

Tyler, 2026-08-23: *"We can make them have rarities and even BLIND PACKS! As if
they have to open a pack to see what type of guard they get. Rarity baked in.
Possibility of digital packs that ship out your guard as well. Our version of
Rip and Ship — if they want to keep it sealed they can have the blind pack sent
to them, or ripped digitally for instant gratification with the chance to sell
it back."*

**The idea is good and the mechanic is proven** — it is the same loop that makes
the hobby itself work. The structure is what needs deciding, and it needs
deciding now rather than at launch.

## IT MEETS ALL THREE ELEMENTS OF THE LOTTERY TEST

We wrote this test into `data/knowledge.json` ourselves for the Discord draws:

| element | blind pack |
|---|---|
| **Prize** | a guard whose rarity varies | **yes** |
| **Chance** | you do not know which until it opens | **yes** |
| **Consideration** | you paid for the pack | **yes** |

Three of three. And **the sell-back makes it worse, not better**: random outcome
plus paid entry plus cash-out is precisely the structure regulators describe when
they legislate loot boxes, and several jurisdictions already have — Belgium
banned them outright, others require disclosed odds.

**This is not a no.** It is that the structure is chosen at design time and is
extremely hard to change afterwards.

## FOUR STRUCTURES, EASIEST TO HARDEST

**1 · Every pack is worth what it cost.** Rarity affects the DESIGN, never the
value — a common and a rare guard cost us the same and sell for the same. There
is no prize because nothing is worth more, and the surprise is aesthetic. **This
is the version with no legal question at all, and it keeps almost everything
that makes the mechanic fun.**

**2 · Choose your guard, packs are for surprise only.** Anybody can buy any guard
directly at a fixed price. A pack is a cheaper way to get one and you accept the
randomness. Consideration exists, chance exists, but **no prize is unobtainable
by purchase** — which is the distinction that matters most in practice.

**3 · Rarity affects value, no sell-back.** Now there is a prize. This needs the
odds published, and needs the sweepstakes review that is already on the
compliance register.

**4 · Rarity affects value AND we buy them back.** This is the one that reads as
gambling. It needs counsel before a line of code, not after.

## THE RECOMMENDATION
**Start at 1 or 2.** They keep the ripping, the rarity, the collection and the
"which one did you get" — which is the whole appeal — and neither creates a
prize. If the community loves it, 3 is reachable with the sweepstakes review
already on our list. **4 is a different company.**

## THE DIGITAL RIP IS THE GOOD PART REGARDLESS
Rip now for instant gratification, or keep it sealed and have it shipped — that
is a genuinely lovely mechanic and it carries **no** legal weight on its own. It
is the SELL-BACK that changes the structure, and it can be added later or never.

## ON THE COMPLIANCE REGISTER
`sweepstakes-structure` already triggers on "first non-Tyler draw" and "prize
value over $500". **Add: any paid randomised product.** That trigger fires the
moment structure 3 or 4 is chosen, and it should fire at design rather than at
launch.
