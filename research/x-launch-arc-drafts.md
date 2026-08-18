# X Launch Arc — Full Draft Copy (v2.1)

Companion to x-launch-arc.md. Every number below exists in repo data or a
sourced digest as of Aug 18. [EDITOR] = Tyler fills. Voice pass expected —
these are 90% posts, not 100%. No post auto-publishes.

---
## Day 1 — The $24 Lie (THREAD, pin after posting)

**1/** Our price tracker told us Journey Together booster boxes were $23.99.

For three months.

The real market: ~$285.

Here's how a bot lies to you, how we caught it, and why we're telling you
about it instead of quietly fixing it. 🧵

**2/** The bug: our bot pulled the 50 *cheapest* eBay listings matching
"Journey Together Booster Box." Cheapest matches for any box query? Single
packs. Bundles. Empty display boxes. The median of junk is a junk median.

**3/** It got worse. Evolving Skies booster boxes were publishing at $144.
Real market: ~$2,899. The price window we'd set for "booster boxes" sat
entirely BELOW what vintage-adjacent boxes actually trade at. The bot
never even saw a real one.

**4/** The fix: title filtering (a "booster box" listing must actually be
one), price floors per product type, and a quarantine rule — if the data
looks impossible, we publish NOTHING instead of something false.

**5/** Last night's first clean run: JT boxes $285 median across 63 real
listings. Evolving Skies $2,899. Eleven products the system refused to
price because it wasn't sure. We'd rather show you an honest gap than a
confident wrong answer.

**6/** All pre-fix history is flagged, not deleted. We don't silently
rewrite numbers. Ever. If you follow this account, you'll see our
corrections in public — that's the whole point.

We publish our own repair receipts. Get used to it.

---
## Day 2 — Why I'm Here

Spent years reading NFT markets. The skill that mattered was never the
asset — it was seeing supply and demand desync before the price admitted
it. [EDITOR: one line of your real NFT-era specifics.] Same signals exist
in Pokémon sealed. Older market, real cardboard, thirty years of history
to check your work against. So that's what I'm building now.

*Support:* Same chart shapes, different substrate. Capitulation in JPEGs
and capitulation in sealed wax look identical on a tape. One of them comes
with Charizard.

---
## Day 3 — The Trust Standard (manifesto)

We wrote our rules down and made them public.

Every claim we publish is one of three things:
VERIFIED — our tracker or two independent sources.
REPORTED — one named source, attributed inline.
A READ — our interpretation, labeled ours, with what would prove it wrong.

If it's none of those, it doesn't ship. And when we're wrong, the
correction runs louder than the mistake — in a hobby where the biggest
grader silently changed grades, that's not a slogan, it's the product.

Newsletter: [link]. First issue this week.

---
## Day 4 — Four States of Sealed

Every sealed product we track lives in one of four states:

🔥 Markup — money in, supply shrinking. Possible breakout.
📈 Distribution — money and supply both flowing. Healthy tape.
❄️ Markdown — sellers outpacing buyers.
😴 Accumulation — quiet tape, deep hold.

Century-old market framework (Wyckoff), applied to cardboard.

Honesty beat: our state reads are DARK right now — we restarted every
product's history the day the fix shipped, and reads return around Aug 26
when eight clean days exist. Nothing false in the meantime. That's the
deal.

---
## Day 5 — Anatomy of a $2,755 Error

How does a tracker publish $144 for a $2,899 box?

Simple: the price window said "booster boxes live between $80 and $800."
True for modern. Catastrophically false for Evolving Skies. So every real
box got filtered as an "outlier" — and the packs and bundles underneath
became the market.

Lesson we paid for: your assumptions are part of your data pipeline.
Vintage now carries its own floors. [EDITOR optional: screenshot of the
flagged history chart.]

---
## Day 6 — [NEWSLETTER SEND DAY — movable]

Catch'Em News 001 is out.

One month to the 30th Celebration — the first simultaneous worldwide TCG
launch ever. All-foil. Two new rarities. Base Set Charizard back in print.
No loose boosters. Plus: the tin double-drop, the grading structure
problem, and our own bug story told straight.

In your inbox if you were on the waitlist. Link below if you weren't.
[link] — free.

---
## Day 7 — The Agent That Caught What I Missed

Full transparency: part of this operation is AI. Here's why I'm telling
you instead of hiding it.

My research agent's FIRST morning run flagged a product I'd completely
missed — the Mega Forces tins, landing the same day as the Ascended Heroes
tins (pokemon.com confirmed). Six tins, one day, two lines. My newsletter
draft said three. The bot corrected the human before publish.

The edge isn't automation. It's verification with more eyes than I have.
Every claim still gets a human gate before it ships.

---
## Day 8 — The 30th: Format Isn't the Variable

Everyone's calling the 30th "Celebrations 2.0 — printed to oblivion,
cheap forever." They're comparing the wrong variable.

The format IS identical — Celebrations had no loose boosters either; every
pack came gated inside products. Same structure this time. But Celebrations
stayed cheap because of PRINT VOLUME — TPC restocked it relentlessly for a
year.

Format matched. Volume decided the price. And volume for the 30th is the
one number nobody has yet. The tell: restock cadence in October. Watch the
shelves, not the format.

---
## Day 9 — Grading's Structure Problem (Reported)

The week's numbers, per industry reporting: roughly 80% of US grading now
sits under one parent company. Cheapest direct PSA tier: $79.99/card,
40–50 business days. Backlog reported at ~12 million cards.

Now aim an all-foil anniversary set at that queue in September.

Not a prediction — a bottleneck you can see from here. Our read: the
sealed→graded pipeline math changed, and slabs-in-hand carry a scarcity
premium while the queue digests. Possible, not promised.

---
## Day 10 — [TIN DAY — Aug 28]

Today: six $21.99 tins hit shelves at once. Three Ascended Heroes (Mega
Feraligatr / Meganium / Emboar ex), three Mega Forces (Mega Dragonite /
Darkrai / Zeraora ex). Four packs each.

That's the publisher injecting supply into the most supply-constrained set
of the year — the thing no whale seller could do.

Our read: AH has been in markup for months. Tins vent the pressure that
pushes casual buyers to the secondary market. Absorb or stall — that's the
watch through September, and we're watching with clean instruments.

---
## Day 11 — Singles Receipts

The chase watchlist is live. Real numbers, real provenance, no calls:

Moonbreon (Umbreon VMAX alt, Evolving Skies): $2,244 market.
Umbreon ex SIR (Prismatic): $1,491.
Mega Charizard X ex SIR (Phantasmal Flames): $692.
151 Charizard ex SIR: $361.

(TCGplayer market via pokemontcg.io, updated Aug 17.)

We track. You decide. That's the division of labor.

---
## Day 12 — Ask the Room

Collectors: what's the ONE number you wish somebody tracked honestly?

Pull rates by print wave? Restock cadence at big-box? PSA gem rates per
set? Actual sealed supply?

Building the roadmap in public. Best answers get built first.

---
## Day 13 — What's Being Built

[EDITOR: attach heat-map mockup screenshot]

Every sealed product. A state, a price, a supply count. Wyckoff phases on
cardboard, updated daily, quarantine rules for anything suspicious.

In build. Newsletter readers see it first. [link]

---
## Day 14 — Recap + Handoff

Fourteen days ago this account changed lanes. Since then:

— A tracker that publishes its own corrections
— A newsletter that shipped with receipts
— A live chase watchlist
— Four bugs caught and told to you on purpose

Sept 16 is the first worldwide simultaneous TCG launch in history. We'll
be covering it live, with instruments, the whole way. Subscribe and watch
us work: [link]

Catch'em. Catch Feels.
