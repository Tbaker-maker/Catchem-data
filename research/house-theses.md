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

## MODE HONESTY LAW (Tyler, Aug 22 2026)
Collector / Flipper / Grader / Balanced modes reorder EMPHASIS and never
hide or alter a figure. A mode that filters out inconvenient numbers is
an echo chamber, which is the exact opposite of what the VERIFIED/READ
chips promise. Anything de-emphasised stays one tap away.
TESTABLE: a diff of every value rendered before and after a mode switch
must be empty. Only order and accent colour may change.

MODE ORDERING (Aug 23 2026) — the law is not a ban on relevance, it is a
ban on hiding. Biggest movers is now ordered per mode: collector by dollars
moved rather than percent, flipper weighted by liquidity, grader weighted to
where grading fees could clear. The SET is identical in every mode because
direction is split BEFORE the mode sort — only the order changes, and the
ordering basis is stated on screen. A list that silently reshuffles costs
more clarity than the relevance it buys.
WHY: the same reason the Referee Doctrine holds — one set of numbers,
many readers. The moment the numbers bend to the audience, they stop
being numbers.

## IMAGE LAW (Tyler, Aug 22 2026)
A MISSING photo beats a MISLEADING one. A bad photo makes every number
beside it look casual, and a photo showing the wrong QUANTITY is worse
than no photo at all — it misrepresents what a buyer receives.
ORDER: reviewed override → TCGplayer catalogue shot (1000px) → seller
photo → nothing.
WHY AN OVERRIDE LAYER EXISTS: no automatic source is reliable for every
product. TCGplayer catalogue shots are usually clean single-unit photos,
but some are CASE or MULTIPACK images — the Evolutions elite trainer box
showed FOUR boxes for a single-box SKU (Tyler caught it within minutes of
the change). Seller photos are single-unit but are phone snapshots.
Neither wins automatically, so data/image-overrides.json records the
per-product ruling with its reason and review date.
NEVER SWAP ONE UNSEEN THING FOR ANOTHER (added 2026-08-22, after the
mistake): when chat cannot see a result, the only safe move is the one
that cannot be wrong — remove it. Chat swapped a bad catalogue image for
an equally unseen seller photo and reported it fixed; Tyler had to report
the same bug twice. A guess presented as a fix is worse than no fix,
because it consumes the reporter's trust as well as their time.
Enforced by scripts/image-override-guard.mjs.
STANDING PROCESS: images cannot be verified by chat — it has no network
access to the CDNs. Every image change needs a human or CC eye pass, and
anything wrong gets an override entry rather than a code patch.

## THE NO-GUESSING LAW (Tyler, Aug 22 2026)
"No guessing. Not acting smarter than you are."

THE LAW: no member of this fleet may present an unverified thing as a
verified one. If you cannot check it, you say you cannot check it, and
you route it to whoever can. Approximating inside your own blind spot is
the single most damaging thing any of us can do, because it produces work
that LOOKS finished — so nobody knows to check it.

WHAT COUNTS AS GUESSING
- Choosing between two options you cannot evaluate (swapping one unseen
  image for another and calling it fixed).
- Stating a URL, price, date, population, or fact from memory rather
  than from a source.
- Reporting "done" on the strength of an edit rather than an artifact.
- Generalising from your own environment ("it fails in my sandbox" is
  evidence about the sandbox, not about production).
- Filling a gap with something plausible because a blank looks unfinished.

WHAT TO DO INSTEAD — in order
1. Verify it yourself if you have the capability.
2. If not, ROUTE IT: "I can't verify this — CC needs to look" / "this
   needs Tyler's eyes." Say it plainly. No hedging, no apology.
3. If it must ship before anyone can verify, choose the option that
   cannot be wrong (remove it, leave it blank, say "unknown") and label
   it as unverified.
4. Never option 4. There is no option 4.

WHY IT OUTRANKS LOOKING CAPABLE
A wrong answer delivered confidently costs more than an admission of
limits, because it spends the other person's trust as well as their
time — and trust is the only thing this company actually sells. An
honest "I don't know, ask CC" takes four seconds. A confident guess cost
Tyler the same bug twice in one night.

ENFORCEMENT: chips and est. labels on published figures · the research
gate's four-part test · publish-assert and the guard audit on the data
side · image-override-guard on images · FLEET-ROUTING.md for handoffs ·
and the standing rule that a guard is not real until breaking it fails
the build. Every one of those exists because someone guessed once.

## PRICE COMPARABILITY LAW (Tyler, Aug 23 2026)
"Always add in shipping on both sides. Never add in tax but indicate tax
is not included, shipping is. If it does not have a shipping price,
assume the cost is baked in already."
RULE: every price we compare is what a buyer actually pays on that venue.
Shipping IN on both sides — eBay delivered totals, TCGplayer market plus
an estimated shipping cost (free over $40, ~$4.99 below; labelled est.).
No stated shipping means the cost is included, because that is what the
seller is saying. Tax OUT on both sides, always, and disclosed — it
varies by state and seller, so any figure would be wrong for most people.
WHAT IT FIXED: comparing eBay delivered against TCGplayer item-only had
inflated every gap, catastrophically on cheap items. Journey Together
packs read +54.9%; corrected they read -12.7%. Destined Rivals +7.5% to
-30%. Boxes barely moved, because both venues ship those free. We were
publishing the wrong SIGN on an entire product class.
FALSIFIER: if TCGplayer changes its free-shipping threshold or typical
rate, the estimate is wrong and the constants must be re-verified.

## PRICING BASIS LAW (Tyler, Aug 23 2026)
"Always add in shipping on both sides. Never add in tax, but indicate tax
is not included and shipping is."

THE STANDARD: every published price is what it costs to get the item to
your door, excluding sales tax. Shipping IN, tax OUT, and both stated so
nobody has to guess which.

WHERE WE STAND TODAY, honestly:
- **eBay**: delivered, always. Item plus shipping where a cost is stated;
  where none is stated the postage is baked into the asking price, which
  is what a free-shipping listing means — so the item price already IS
  the delivered price. Both cases are delivered totals. Compliant.
- **TCGplayer**: ITEM ONLY. Our TCG figures come through
  PokemonPriceTracker as market price, which excludes shipping.
  TCGplayer sellers set shipping by product size — roughly $0.99-$4.99
  for small items and up to $24.99 for the largest — so a sealed box
  carries real postage we currently cannot see. NOT YET COMPLIANT.
CONSEQUENCE, stated rather than hidden: any eBay-vs-TCG comparison is
not like-for-like until we can add TCG shipping. Every surface showing
that comparison must say the TCG figure excludes shipping.
NEVER GUESS A SHIPPING COST (Tyler, Aug 23). Absent shipping data is not
a hole to fill — it usually means postage is baked into the price. We do
not estimate postage on either side, ever, under any framing. Where a
figure genuinely excludes shipping we say so; we do not add a number to
make two sources look comparable.
THE FIX (routed, not guessed): TCGplayer sorts its own listings by price
plus shipping, so the number exists at source. Someone with API access
needs to find whether a shipping-inclusive figure is retrievable. Until
then we label rather than estimate — inventing a postage number would
be guessing, and the No-Guessing Law outranks the wish for a clean
comparison.
TAX: never added, anywhere. Rates vary by state and by whether a seller
collects, so a single figure would be wrong for almost everyone. We say
"tax not included" and leave it to the buyer.

## TCG SOURCE VERIFICATION — the routed API question, answered (CC, Aug 22 2026)
The PRICING BASIS LAW routed one question to API investigation: is a
shipping-inclusive TCGplayer figure retrievable at source? Answer: **not
through our current source.** PokemonPriceTracker's sealed endpoint exposes
a single `unopenedPrice` field and nothing else — no shipping-inclusive
variant, no region/currency/filter parameters, no listing counts. Their EUR
lane is a separate opt-in Cardmarket beta we never request. TCGplayer's own
API is partner-gated. So "label rather than estimate" remains correct for
displays, and the Spread's est. constants stay the only normalization lever.

WHAT THE FIGURE IS, verified three ways:
1. `unopenedPrice` matches tcgplayer.com's displayed **Market Price** to the
   cent (swsh7-bb $2,460.46 exact, swsh5-pack $9.23 exact; swsh7-pack
   42.04→42.15 one refresh apart). PPT scrapes the US site (`lastScrapedAt`,
   `tcgPlayerUrl` → www.tcgplayer.com); docs denominate price filters in USD.
2. TCGplayer's help center defines Market Price as an outlier-trimmed
   average of **actual recent completed sales** — SOLD data, not asks.
   This CORRECTS our Aug-18 note calling PPT sealed prices "ASK-derived":
   base1 flat for 35 days meant NO recent sales freezing the average, not a
   stale ask. Flat TCG lines = illiquidity, not staleness.
3. TCGplayer's own CSV price-point taxonomy carries "TCG Low w/ Shipping" as
   a separately labeled point — the "w/ Shipping" qualifier existing only
   there confirms Market Price (and every unlabeled point) is ITEM-ONLY.

CONSEQUENCE: the Spread's remaining structural asymmetry after the shipping
model is ASK vs SOLD — our eBay side is what listings ask, the TCG side is
what copies actually sold for. Asks resting above solds is definitional.
This makes negative spreads STRONGER than we previously wrote (an ask under
recent solds fights the definition) and it means the TCG side is closer to
"real" prices than the eBay side, not a second ask lane.
NOTE ON RULING TENSION, flagged not resolved: the comparability law
(Aug 23 entry above) added est. shipping to the Spread's math; the pricing
basis law says label-rather-than-estimate for surfaces. Current state:
Spread instrument estimates (and says so), price displays label. If Tyler
wants the Spread de-estimated too, that is a one-constant revert in
compute-divergence.mjs.
FALSIFIER: if PPT ships new fields (listings counts, shipping-inclusive
prices, region parameters) the crosscheck contract should be re-evaluated —
the fetch header documents where to look.

## ONE DECLARATION, MANY USES (Aug 23 2026)
THE FAILURE: chat and CC each added a PPT licensing gate to the same
function. Chat's ran first, CC's ran second and silently overrode it, so
Tyler's ruling appeared not to take effect and neither author knew the
other's gate existed. Two guards for one decision, and the second won.

WHY IT HAPPENED: guards were added inline, wherever they were needed.
That is fine with one author. With two working in parallel it guarantees
collisions, because neither has any reason to look where the other wrote.

THE FIX, and it is structural rather than procedural: anything that
changes what the product DOES or PUBLISHES is now DECLARED once in
scripts/flags.mjs — with its owner, the date it was decided, why, and the
trigger that would change it — and read everywhere else through flag().
Adding a gate means opening that file, which means seeing the gate that
already exists. A duplicate stops being a coordination problem and
becomes impossible.
ENFORCED: guard-audit fails the run if any script outside flags.mjs reads
a CATCHEM_* environment variable. Negative-tested by reintroducing the
exact pattern.
NOT IN SCOPE: secrets stay in the environment and never appear in the
registry; logging conveniences are not behaviour and do not belong.

THE GENERAL LESSON, worth more than the fix: a rule that depends on two
workers remembering each other is not a rule, it is a hope. Where
coordination is required, remove the need for coordination instead.

## ARTIST CLAIM LAW (Tyler, Aug 23 2026)
Illustrator posts are one of the best-performing formats in this hobby and
we are uniquely placed to make them, because we can join the artist to the
market and nobody else does. Art accounts have the taste and none of the
data; price accounts have the data and never look at who drew it.

THE RULE THAT KEEPS THEM SAFE — SCOPE EVERY COUNT.
"She has only ever illustrated three Pokémon cards" is a claim about every
card ever printed, and a reader can disprove it in thirty seconds with one
search. "Three cards in the sets we track" is true, still interesting, and
survives contact with an expert.
An unscoped "ever" claim may only be published when coverage is verifiably
complete for that artist — which our data does not currently support and
may never.

ALSO BINDING
- Artist names and card counts come from a source (pokemontcg.io), never
  from memory. The generator refuses to run without the data file rather
  than filling gaps.
- The artist is a living person in most cases. Write about their work the
  way you would if they were reading it, because they might be.
- Prices in an artist post carry their chip and date like every other
  figure. An art post is not a holiday from the pricing laws.
- Credit the source visibly. Illustrator data is somebody else's work too.

## RT-7 · ARTIST COHORT ATTRIBUTION (Tyler, Aug 23 2026)
When a card moves, the hobby asks why and everybody guesses. There is a
prior question nobody has asked with data: did the illustrator's OTHER
work move too?
- The whole body of work moved together → something happened to the
  ARTIST. A feature, a convention, a set announcement, a community
  moment. The cohort reprices.
- Only this card moved → something happened to the CARD. The Pokémon,
  the set, its status as a chase, a tournament result.
That distinction changes what a collector does next, and it cannot be
answered by anyone holding only art data or only price data.
MEASURED: a card's latest move against the median move of everything else
the same illustrator drew that we can price. Dispersion across the cohort
sets the tolerance — tight dispersion plus a real move is the signature
of artist-wide repricing.
FALSIFIER: if cards by the same illustrator move together no more often
than random cards of similar rarity and era do, the cohort is not real
and this instrument is measuring noise. Testable once we hold a full
catalogue and 30+ days of singles history.
CONSTRAINT, stated honestly: fewer than three priced cards is not a
cohort and produces no verdict. Today most illustrators fail that bar,
which is why the catalogue ingest matters more than the analysis.

## UNIVERSE EXPANSION LAW (Tyler, Aug 23 2026)
"Our database needs to be as large as we can make it without costing a
crazy amount."

THE ECONOMICS, which decide everything else:
- **Card metadata is FREE and unlimited.** pokemontcg.io gives every card
  ever printed — artist, set, number, rarity, release date — at no cost.
  The whole catalogue is roughly 3 MB. There is no reason to hold less
  than all of it, and holding all of it is what turns "three cards in the
  sets we track" into "three cards, total" — a sourced fact rather than a
  hedge.
- **Prices are the constrained resource.** Every tracked single costs an
  API call every day, forever. Coverage there is a budget, not a wish.

THEREFORE: ingest everything, price selectively, and choose what to price
with arithmetic rather than instinct.

WHAT MAKES A CARD WORTH PRICING (scripts/universe-advisor.mjs):
1. **Cohort completion** — an illustrator with 30 catalogue cards and 2
   priced is ONE card away from RT-7 working across their entire body of
   work. That single card buys thirty cards' worth of analysis. Nobody
   would find it by intuition; the advisor scored it 90 against 17 for a
   card that unlocks three.
2. **Era balance** — our index runs 88% modern. Cards from thin eras buy
   coverage we do not have.
3. **Chase status** — a cohort built from bulk commons is technically a
   cohort and practically useless.

THE LINE IT WILL NOT CROSS: the advisor never says "buy this card". It
says "pricing this card makes these instruments work". Those are
different claims and only one of them is ours to make.

## BUILD IT. BREAK IT. REPEAT. (Tyler, Aug 23 2026)
"We are our own biggest critic."

THE PRACTICE, in three parts:
1. **Build it** — ship the instrument.
2. **Break it** — deliberately, on purpose, before anyone else does. A guard
   is not real until breaking it fails the build. A backup is not a backup
   until a restore has been tested. A fact is not verified until we have
   written down what would prove it wrong.
3. **Repeat** — every incident becomes a guard, every guard gets a negative
   test, and `scripts/breaker.mjs` hunts for the assumptions nobody has
   tested yet, so we stop being permanently one incident behind.

THE COMPOUNDING ASSET (data/knowledge.json)
Instruments can be rebuilt in a weekend. A decade of verified, sourced,
dated knowledge cannot. Every fact enters with its claim, its sources, the
date, the verifier, a confidence tier, and its falsifier — and carries a
recheck date, because facts rot. A knowledge base nobody rechecks is a
museum. `knowledge-guard.mjs` enforces the entry law and, on its very first
run, downgraded one of our own entries from VERIFIED to SINGLE-SOURCE.
That is the system working on its authors, which is the only kind of
system worth having.

## AGENT SAFEGUARD LAWS (Tyler, Aug 23 2026)
"Make sure they never cause problems or farm. It is about making the
system better, safer, more enjoyable — not worse."

We built agents to watch the system and nothing watched them. An agent's
natural failure is not crashing — a crash announces itself. It is FARMING:
producing volume that looks like work, costs attention, and changes
nothing. That gets read for a week and skimmed forever after, and the day
it finds something real, nobody is looking.

THE MEASURE: an agent is judged on whether its output is ACTED ON, never
on how much it produces.

THE LAWS
1. **Advisory, never blocking.** Guards block; agents advise. A crashing
   agent must never stop a run — proven by simulating one.
   **process.exit() IS NOT ADVISORY.** It cannot be caught by the try/catch
   that wraps agent imports, so an agent calling it halts every guard
   downstream while still describing itself as advisory. Our own supervisor
   did this within minutes of the law being written, and killed
   publish-assert. Agents may set process.exitCode; only a standalone run
   may exit.
2. **Budgeted.** Every agent declares a findings ceiling. An unreadable
   list is an unread list.
3. **No farming.** Findings climbing across runs with nothing resolved
   trips the supervisor. Volume is not work.
4. **No broken records.** The same finding three runs running means it is
   either unactionable or being ignored. The agent must say WHY instead
   of repeating itself.
5. **No crying wolf.** A false alarm costs more than silence, because it
   teaches people to skim. We hit this twice building the negative tests
   and both were our own fault.
6. **No cascades without intent.** An agent reading another agent's output
   turns one wrong finding into two. Allowed only when deliberate.
7. **Scoped to the reader.** An agent must not report what its reader
   cannot act on. The Breaker was listing hosts chat cannot reach; those
   moved to a handoff file.
8. **Silence is a failure.** An agent that stops producing is caught by
   the supervisor, not discovered months later.
10. **THE SUPERVISOR PLANS THE WORKFORCE, NOT JUST POLICES IT** (Tyler,
   Aug 23). Warning the existing agents manages a fixed team forever. The
   supervisor also proposes HIREs (what nothing watches), REVIEWs (an agent
   silent for a week is either broken or unnecessary, and both deserve a
   decision rather than drift), and MERGEs (two quiet agents reading the same
   inputs are one agent and a habit). Its standing ambition: today every agent
   watches US. A workforce aimed at the best community, app, tools and database
   in this hobby needs agents watching the MARKET, the COMMUNITY, and the
   FIELD. Two of those three need the bot; one needs only research — that is
   the order to hire in.

9. **AN AGENT THAT REACHES NOBODY HAS NOT DONE WORK.** It has made a file.
   The Improver's first finding was that every agent we had written that day
   produced JSON nothing read — eight files a day, generated faithfully,
   consumed by no script, no surface and no person. The fix is one digest a
   human actually opens, not eight dashboards. If a section of that digest
   never leads to an action, delete the section rather than tolerate it.
Enforced by scripts/agent-supervisor.mjs, which is itself advisory —
a watchdog that can halt the run is a hazard, not a safeguard.

## THE IMPROVER — asking what could be better (Tyler, Aug 23 2026)
"Focus on retention, app design, information, likability, new tool ideas —
anything that could make us better we should at least be exploring. Not
everything will work but we should verify, not trust."

Every other agent asks WHAT IS BROKEN. Broken things announce themselves
eventually; mediocre things never do. This one asks what could be better,
measured against OUR OWN doctrine rather than generic best practice —
"add more tests" is not insight.

WHAT IT LOOKS FOR
- **Unsurfaced data** — the cheapest features in existence are the ones
  where we already hold the data and never showed it.
- **Retention** — is there a reason to come back tomorrow? A market page
  that looks the same twice is a page nobody opens twice.
- **Likability** — numbers earn trust, voice earns affection. The ELI5
  lines and the facts are the parts people quote.
- **Tool ideas** — combinations of data we already compute, labelled
  HYPOTHESIS every time, because dressing a guess as a finding is the
  thing we least want to do.
- **Doctrine gaps** — laws written and never enforced.

RANKED BY VALUE, NOT DISCOVERY ORDER. Five housekeeping notices crowding
out one tool idea is a list optimising for the wrong thing, and a reader
who meets housekeeping first stops before the useful part. Repeated areas
collapse to two so no single class can fill the page.

## TWO LANES, ONE FILE (Tyler, Aug 23 2026)
"Make sure we aren't doing that. Put safeguards so it doesn't break anything."

WHAT HAPPENED: chat and CC independently built the same three things inside
ten minutes — the rip/sell/trade tool, the era ELI5s, and a recruiter for the
supervisor. Nothing broke, because each was read before being overwritten.
Earlier the same day the identical pattern DID break something: two licensing
gates added to one function, where the second silently overrode the first and
a ruling from Tyler stopped taking effect.

THE FINDING UNDERNEATH: both lanes commit under the same git identity, so we
could not tell our own two workers apart. CC signs with a Co-Authored-By
trailer; chat does not. That trailer is the only honest signal we have, and
discovering we needed it was the real lesson — the collisions were invisible
rather than rare.

THE RULE
1. Before building anything named in a recent Improver or Breaker finding,
   run `node scripts/collision-guard.mjs <file>`. Both lanes read those
   reports, so both lanes will reach for the same idea on the same morning.
2. If a file already exists, EXTEND it. Never replace another lane's work
   without reading it — twice today the other lane's version was better,
   and both times the right move was to delete mine.
3. Generated artifacts are touched by both lanes constantly and are excluded.
   A warning that fires on normal behaviour stops being read, and then it
   fails on the day it matters.
4. It never blocks. The failure here is not malice or carelessness — it is
   two workers moving fast on the same thing with no cheap way to notice.

## CADENCE LAW — how often an agent should run (Tyler, Aug 23 2026)
"How often would you recommend they run if the cost basis is zero?"

COST IS NOT THE CONSTRAINT. Six of seven agents are free and finish in under
half a second; hourly would cost nothing measurable. ATTENTION is the
constraint. An agent running hourly produces twenty-four times the output for
a person who reads once a day, and by our own law that is farming.

THE PRINCIPLE: match cadence to the RATE OF CHANGE of the thing being
watched, not to the clock.
- **Watching market data → daily.** The data lands once a day; more often
  reproduces the same answer.
- **Watching our own code → on change.** Running the Breaker on a day nobody
  committed produces yesterday's list — which is precisely the BROKEN RECORD
  failure the supervisor exists to catch. We would be manufacturing our own
  false alarms, then investigating them.
- **Anything that costs money → only when its input changed, never on a
  timer.** A schedule spends money whether or not there is anything to look
  at. review-agents is the only paid agent and it is on-change only.
- **Weekly for slow-moving questions** (what to price next). A recommendation
  nobody has acted on does not improve by being repeated tomorrow.

MEASURED, so nobody has to guess: 7 agents, ~1.1 seconds a day combined,
zero external API calls. The paid one does not run.

## THE SUPERVISOR IS A MANAGER, NOT A NIGHT WATCHMAN (Tyler, Aug 23 2026)
"These are the things the supervisor should be picking up on. Exactly like a
job. His goal is to make it as efficient and successful as possible, always
with the utmost professionalism — what the best hire at the top of the class
would be."

A supervisor that only polices behaviour is a night watchman. The standard is
higher: find the waste before being asked, and be able to say which of your
people are earning their seat.

WHAT IT NOW DOES WITHOUT BEING ASKED
- **Cadence waste** — an agent returning the same count four runs running is
  producing the same answer twice and calling it work. A human caught this by
  hand on 2026-08-23; the supervisor should have seen it first, and now does.
- **Yield** — findings nobody acts on are not findings, they are a list.
  Either hand them to someone who can act, or the reporting bar is too low.
- **Cost against yield** — the only paid agent on the team should be the
  easiest to justify. If it cannot be, switch it off until it can.
- **Redundancy** — two agents on one beat is a MANAGEMENT failure, not theirs.

THE PROFESSIONALISM PART, and it is the hardest:
**ZERO IS NOT ONE THING.** The falsifier finding nothing means no thesis
failed — that is the outcome we want. review-agents finding nothing means it
never ran. Same number, opposite meanings. A supervisor that flags both as
problems is a bad manager: it treats success as a warning, and then nobody
reads it. Every agent now declares what its empty result MEANS, and the
supervisor says "clean run — nothing failed, which is the point of it"
rather than raising an alarm about good news.

## RT-8 · REPRINT PRESSURE (Aug 23 2026)
Crossing a set PRINT WINDOW against what its shelves are doing answers three
different people from one computation — which is why the creator agent found
the same gap from three directions in one run.
- late print + shelves FILLING → stock is arriving, often a reprint.
  Buyer: wait. Vendor: leave it home. Creator: the reprint conversation,
  before anyone announces anything.
- late print + shelves DRAINING → the window is closing while stock leaves.
  Buyer: this is what people mean by a hidden gem. Vendor: bring it, you
  will be one of fewer tables carrying it. Creator: the nobody-is-talking-
  about-this video.
- early print → normal. Say nothing rather than invent a story.
READ, never VERIFIED: a print window is an estimate off a 30-month model and
shelf counts are listings, not sales. Two soft signals crossed are still soft,
and the copy says so.
FALSIFIER: if late-print sets with filling shelves are no more likely to see a
reprint announced within 90 days than late-print sets generally, the crossing
adds nothing and this retires.
WHY IT MATTERS BEYOND THE SIGNAL: it is the first instrument built to serve
buyers, vendors and creators simultaneously — the Referee Doctrine expressed
as a computation rather than a promise.

## THE RATING LAW — nothing reaches a person unreviewed (Tyler, Aug 23 2026)
Thirteen agents produce findings all day and every one used to arrive with
equal weight. A guess about TikTok formats and a measured pricing error looked
identical in a list, so a reader either treated everything as urgent or
treated nothing as urgent — and the second one always wins.

THE SCORE, 0-100, from four components:
- **Evidence** (40 max) — MEASURED, OBSERVED, DERIVED, REASONED, HYPOTHESIS.
- **Impact** (30 max) — CRITICAL, HIGH, MEDIUM, LOW.
- **Actionable** (20 max) — NOW, SOON, BLOCKED, UNCLEAR.
- **Track record** (10 max) — starts at UNPROVEN, worth nothing. An agent
  earns credibility by being right where somebody checked, not by existing.

THE VETO: anything nobody can act on is capped at NOTE ONLY however certain
it is. Without that, a certain, critical, unactionable finding rates ACT NOW
and sends somebody to do nothing — which loses the reader in a week.

THE BANDS are named for what to DO, not for how the number feels:
ACT NOW (75+) · QUEUE (55+) · WATCH (35+) · NOTE ONLY · CONFIRMED.

THE FOUR LAYERS
1. SELF — the agent declares evidence, impact, actionability.
2. SCORE — computed mechanically, so an agent cannot flatter itself upward.
3. MANAGER — the supervisor applies judgment a score cannot: is this a repeat,
   is this agent noisy, is the band plausible. **It may DEMOTE, never
   PROMOTE.** Allowing promotion would let the supervisor manufacture urgency,
   which is the failure mode of every alerting system ever built.
4. DISPATCH — only what survives reaches a named person, banded.

NOT EVERY FINDING IS A PROBLEM. Agents report confirmations too, and
dispatching those as work is the same crying-wolf failure as flagging a clean
run. Confirmations are recorded and surfaced to nobody.

THE HONEST PART: we have NO outcome history, so a success rate today would be
invented. Track record reports UNPROVEN until five findings have been judged.
data/finding-outcomes.json records CONFIRMED when acting on a finding changed
something and DISMISSED when somebody looked and it was fine. Both are useful;
only silence is useless. The rating gets better by being used, which is the
only honest way for a rating to get better.

## ADJACENCY IS A CLAIM (Tyler, Aug 23 2026)
"Why is this random grading quote with the index? That has nothing to do
with a sealed index. Looks sloppy."
He was right, and every number on the page was correct. A grading-premium
strip sat flush under the Sealed Index, and proximity is how a reader
decides what belongs to what — so it read as a caption on an index that
does not measure graded singles at all.
THE RULE: two instruments measuring DIFFERENT markets may not sit adjacent
without a line naming the boundary. Sealed products and graded singles are
the obvious pair; there will be others.
WHY IT IS EASY TO MISS FROM INSIDE: whoever placed it already knows they
are different things, so the ambiguity is invisible to them and obvious to
everyone else. This is the cheapest class of design bug to create and the
hardest to catch without fresh eyes — which is why it is now a check in
the experience agent rather than a thing we hope to notice.
