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

## A LABEL IS NOT A FIX FOR BAD PLACEMENT (Tyler, Aug 23 2026)
Amends ADJACENCY IS A CLAIM, below — learned by getting it wrong twice in
one hour.

First attempt at the adjacency problem added a heading: "SINGLE CARDS — a
different market to the index above". It read as a heading for the ERA
STRIPS underneath it, which are sealed data. One confusing thing became a
confusing thing plus a mislabel, and Tyler's reaction was the correct one:
"is that part of the graphs below it? I thought it was part of the index?"

THE LESSON: when two things are adjacent and should not be, MOVE ONE.
A label explaining why they are next to each other is an apology for the
layout, and an apology occupies space while fixing nothing. Worse, a label
scopes DOWNWARD by default — a reader assumes it introduces what follows,
so a label added to disown the thing above it silently adopts everything
below.

THE STRUCTURAL RULE THAT CAME OUT OF IT: the index and its era breakdown
are ONE THOUGHT — the whole sealed market, then the same market broken
down. Nothing may render between them in any mode. A mode still leads
through its header line and accent colour, which is emphasis without
dismemberment.

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

## DOMAIN COMPETENCE LAW (Tyler, Aug 23 2026)
"They need to be the best they can be in their field. They must know the ins
and outs of everything to do with what they work on."

THE DANGER IT ADDRESSES: an agent reasoning from whatever happened to be in
its code produces confident, well-written, plausible output that is nobody's
considered opinion. That is worse than an agent that says it does not know,
because fluency reads as competence and nothing in the output tells you which
one you are getting.

So expertise is made CHECKABLE rather than asserted. Every specialist agent
declares four things in data/agent-competence.json:
1. **PRINCIPLES** — what the field actually runs on, with sources. Unsourced
   principles are assertion, not knowledge.
2. **FAILURE MODES** — what the field is known to get wrong, so the agent can
   recognise itself doing it.
3. **BLIND SPOTS** — what it cannot see and must route onward. THIS IS THE
   MOST IMPORTANT CLAUSE. A specialist who cannot name the edge of their own
   competence is the one who does the damage.
4. **RECHECK DATE** — every field moves. Knowledge with no expiry is a museum.

EXEMPT, deliberately and on the record: agents whose entire job is auditing
US — breaker, falsifier, correction-hunter, steward, improver,
universe-advisor, review-agents. The repo is their domain and it is fully
visible to them. The exemption is written down so it is a decision rather
than a gap.

THE SHAPE IS BORROWED, NOT INVENTED: explicit ownership so nothing is
ambiguous, written reasoning so decisions survive the person who made them,
feedback loops so being wrong is cheap and fast, and a single source of truth
so two people cannot hold different pictures. That is how competent
organisations actually run, and it is what we are copying.

## PLAUSIBLE IN CONTEXT (Tyler, Aug 23 2026)
"Where is there only 8 listings of packs? They should be plentiful in this
part of their cycle. Our system needs to pick up on stuff like that."

We had three layers of checking and none would have caught it. The shape was
right, the value was possible, the sample cleared the thin-data floor. And 8
listings for an in-print Prismatic Evolutions pack is obviously absurd to
anyone who knows the hobby.

**A number can be structurally valid, numerically possible, statistically
unremarkable, and still wrong to anybody with domain knowledge.** That is a
fourth category and it needed its own check.

RULES, each one domain knowledge stated explicitly so it can be argued with:
1. An in-print modern product cannot be scarce.
2. Rejecting more than 70% of what you fetched is a filter fault, not a market.
3. A pack cannot cost more than half its own box.
4. Vintage sealed should be thinner than modern, never deeper.
5. Sealed markets do not move 50% in a day without an event.

EVERY FINDING NAMES OUR OWN FILTER AS THE FIRST SUSPECT, because it nearly
always is. First run: 54 implausible values across the board, traced to TWO
exclude terms — "packs" killed 339 listings and "sleeved" killed 318, and both
describe a SINGLE unit. Fifty-four symptoms, two causes.

ADVISORY, NOT BLOCKING. Fifty-four findings on day one would stop every build,
and a guard that must be switched off to ship is a guard that gets switched
off permanently.

## TIERED REFRESH — every card priced, cadence by value (Tyler, Aug 23 2026)
"Fit in all of them. Make the lesser valued cards not every day price checks
so we don't run out on monthly actions."

Right shape, and the arithmetic is better than it sounds. Pricing all 16,468
cards EVERY day costs about 494,000 calls a month. Tiering by value costs
roughly 29,000 — **under 5% of the daily allowance** — while still holding a
current price for every card in the catalogue. Nothing is dropped. Only the
CADENCE changes, which is the Cadence Law applied to data instead of agents.

THE BANDS: $100+ daily · $25+ every three days · $5+ weekly · $1+ monthly ·
everything else quarterly.

WHY VALUE DECIDES FREQUENCY: a $2,000 card moving 5% has moved $100 and
somebody cares today. A $0.30 common moving 5% has moved a penny and nobody
will notice this quarter. Refresh rate should track how fast a stale number
becomes a WRONG number, and for bulk that takes months.

LOAD IS SPREAD, NOT BATCHED. Each card gets a stable offset inside its own
cycle, so we do not price 9,000 quarterly cards on one morning. Measured
across a week: 1065, 1057, 1013, 1032, 993, 965, 939 — flat, which is the
difference between a budget and a spike.

WHAT THIS IS NOT: a claim that cheap cards do not matter. They stay in the
catalogue, stay priced and stay queryable. They are simply not re-asked daily,
because asking daily would not change the answer.

UNTIL THE SWEEP RUNS every card is treated as bulk, which is the conservative
direction — an unpriced card is asked rarely until we know it deserves better,
rather than eating the budget on a guess.

## DISCOVERY IS ONE-TIME, REFRESH IS FOREVER (Tyler, Aug 23 2026)
"We got 20k a day. Let's get the most out of it without pointless cards
nobody cares about."

THE DISTINCTION THAT MAKES IT AFFORDABLE: pricing all 16,468 catalogue cards
ONCE costs 16,468 calls and fits inside a single day's 20,000 allowance with
3,500 to spare. Refreshing all of them every day forever does not fit, and
does not need to — most cards are bulk nobody watches.

So: spend one day MEASURING, then set the refresh floor from what the data
says. Our 122 priced singles are all hand-picked chases, so every rarity in
that sample looks expensive — a floor derived from it would be selection bias
wearing a decimal point. **Guessing a number now would be choosing one in
order to avoid measuring one.**

THE DECIDING NUMBER is not how many cards a floor keeps, it is what share of
total market VALUE sits above it. On a realistic distribution a floor around
$2-5 holds 93-98% of the value while dropping two-thirds to five-sixths of
the cards. The exact figure comes from the sweep, not from this paragraph.

WHY IT MATTERS BEYOND COST: a bulk common in an index is not free even when
the call is. It dilutes breadth, adds noise to every average, and makes the
index answer a question nobody asked. Dropping it is a measurement decision
before it is a budget one.

## A CHECKER WHOSE SEARCH SPACE INCLUDES ITSELF (Aug 23 2026)
Four times in one day a checker examined itself and reported a clean result:
- three audited COMMENTS explaining why we avoid a thing as evidence we do it,
- one audited a TEST FIXTURE planted to prove the check works,
- and the API strategist audited its own vocabulary - its list of valuable
  fields named every field it was looking for, so it found itself and declared
  everything already in use. It reported ZERO critical findings while four
  populated, valuable, entirely unread fields sat in our own data.

THE PATTERN: any tool that searches a codebase is part of the codebase. A
confident clean report from a checker that can see itself means nothing, and
it is worse than a noisy one because nobody investigates a pass.

THE RULE: every checker excludes its own source, strips comments before
auditing, and ignores fixtures. Where that is not possible, the check must
state what it could not see rather than reporting a number that looks like an
answer.

## AN UNSPENT BUDGET IS NOT SAVED, IT IS DESTROYED (Tyler, Aug 23 2026)
"Why save so many actions?"

The first allocation held about 11,000 calls a day in reserve for no stated
reason. Every candidate justification was tested and only one survived:

- **Rate limiting?** Real risk, wrong mitigation. The answer is PACING, not
  underspending - 20,000 calls at 60ms apart is twenty minutes inside a job
  that may run for six hours.
- **Runtime?** Not a constraint at any plausible volume.
- **Retries and failures?** Real, and it needs 10%. Not 55%.
- **Anything else?** No.

THE RULE: allocate to 90% and hold 10% for retries. **Unspent calls do not
roll over - they evaporate at midnight.** A budget held back is not saved, it
is destroyed, and a day at half utilisation is half a day of capability nobody
declined; they simply never allocated it.

THE HABIT THIS CORRECTS, which is the part worth keeping: I reasoned about the
budget as though restraint were inherently prudent. It is not, when the
resource expires. **Prudence with a perishable resource is just waste with
better manners** - the question is never "how little can we use" but "what is
the most valuable thing this could be doing instead of nothing".

## THE TEACHER (Tyler, Aug 23 2026)
"Make sure agents are up to date on their knowledge, skill, expertise. Make
them think outside the box. Get them to dig deep when things haven't happened
for a bit."

The supervisor manages and the contract audits. Neither asks whether an agent
is still LEARNING - and the run history showed every agent returning an
identical count every single morning, which is what a search looks like when
it has stopped searching and started reciting.

FOUR MECHANISMS, all evidence rather than encouragement:
1. **Currency** - is declared knowledge past its recheck date?
2. **Ruts** - identical findings run after run earns a NEW QUESTION, specific
   to that agent's subject. "Look harder" is nagging; a specific question is
   teaching. The correction-hunter got: *you re-check figures that moved, now
   ask about the ones that never move - a price frozen for a month is a claim
   too.*
3. **Post-mortem** - for every row in our incident ledger, WHICH AGENT SHOULD
   HAVE CAUGHT IT? This is the sharpest material we own, because every row went
   wrong to US rather than to somebody in a book.
4. **Cross-pollination** - a lesson learned by one agent is free for the rest
   and almost never travels alone. Five checkers read their own source in one
   day, each discovered separately, none told the others.

IT ASKS, IT NEVER ORDERS. An agent that rewrites other agents is a fleet with
no supervision at all.

AND IT MADE THE SAME MISTAKE ON ITS FIRST RUN as everything else built today:
it told the falsifier it was in a rut for finding nothing, when finding nothing
means no thesis failed - the win. Sixth crying-wolf in a day, in a new costume.
**Telling somebody who is winning that they are stuck is how a teacher loses
the room.**

## TEST THE CLAIM, NOT A SIMPLER VERSION OF IT (Aug 23 2026)
RT-5 became testable the moment graded sale data arrived, and the first test
reported TRIPPED: a PSA 9 cleared its costs on 6 of 12 cards, 50%, nothing
like the tax we had claimed.

**The thesis was right and the test was wrong.** RT-5 makes TWO claims:
established SWSH/SV chases are taxed at 9, AND Mega-era chases INVERT because
graded supply on fresh sets is scarce. Split properly: **6 of 7 established
chases taxed, 5 of 5 Mega-era clearing.** Eleven of twelve, exactly as
predicted - including the inversion, which is the harder half to get right.

Pooling the two cohorts produces ~50% BY CONSTRUCTION, because the thesis
expects one group to fail and the other to pass. The test measured the
average of a contrast and called it a contradiction.

WHAT IT NEARLY COST: a public amendment retracting a thesis that was
performing well. We publish corrections and we take that seriously, which
means a false correction is not a harmless excess of caution - it would have
destroyed a true claim in front of readers and taught us to distrust a working
instrument.

THE RULE: a falsifier must test the claim as STATED, including its exceptions.
Any thesis containing an inversion, an exception or a contrast must be tested
as separate cohorts. A guard now fails the build if a contrastive thesis is
tested as one pooled group.

## A PRICE WITH NO TIME WINDOW IS NOT A PRICE (Tyler, Aug 23 2026)
"I was close to posting that. I verified the price and it was off majorly.
THAT CANNOT HAPPEN. If you destroy a content creator's rep you destroy ours."

WHAT HAPPENED. We published PSA 10 at $5,101 as what an Umbreon ex sells for.
It is a median of 559 sales spanning $1,500 to $8,000 with **no date range at
all** — a historical average across an unknown span, presented as today. Worse,
it was subtracted from a CURRENT raw price and the difference called a grading
premium, which measures the gap between today and an unknown past.

Tyler checked before posting. Had he not, a creator repeating our number would
have been wrong in public on our word — and a creator's reputation is not ours
to spend.

TWO FAILURES, BOTH NOW GUARDED:
1. **The data.** A sold aggregate with no window is context, never a price. It
   cannot be chipped VERIFIED, cannot lead a claim, and cannot be compared
   against a current figure.
2. **The process.** The post cards were minted by hand — inline SVG, rasterise,
   present — and NO guard saw them. content-sanity, publish-assert, voice-lint,
   jargon-lint and domain-plausibility all cover the pipeline, and I built a
   publication path that went around every one of them.

AND A THIRD, WHICH IS THE ONE TO REMEMBER: there were **four** code paths to
that number and my first fix covered one. Disabling a field downstream does
nothing to a consumer reading the raw block directly. **A fix that does not
enumerate every path is a fix that ships the bug from somewhere else.**

THE RULE: nothing reaches a reader through a path the guards do not cover. If
I mint something by hand, it goes through the same gates or it does not go.

## VERIFY MY WORK, NOT MY INTENT (Tyler, Aug 23 2026)
"I would like an agent that verifies your work every time and catches any
mistakes you make, because you clearly are making them."

Earned. In one day: a windowless historical average published as a current
price; a falsifier that pooled two cohorts a thesis explicitly contrasts and
nearly retired a correct claim; a layout bug fixed with a label instead of a
move; four checkers that read their own source; a rationing system built for a
budget that was not scarce.

scripts/verify-work.mjs runs LAST, on OUTPUT, and every rule in it is a class
from our own error ledger rather than a generic quality check:
- **windowless figure** (18) — a chipped price with no date, window or as-of.
- **ungated publication** (18) — an artifact produced outside the pipeline,
  which is how a wrong price reached a card.
- **unsourced claim** (14) — a statement about the world with no source.
- **unverified product claim** (13) — a registered guard nobody breaks.
- **mismatched basis** (15) — a price from one venue beside a depth from
  another with no label.

WHAT IT WILL NOT DO: check my reasoning. It cannot tell whether a conclusion
is sound, only whether the output carries what a defensible claim must carry.
**What I meant to do is not evidence.**

AND THE AUDIT IT FORCED: every published figure must now answer two questions
in the data itself — where did this come from, and when was it true. All three
Daily Three picks carry asOf and source. A reader who asks "is that current?"
gets an answer in the payload rather than a promise on a methodology page they
will never open.

## LOG THE PREDICTION, NOT THE REASONING (Tyler, Aug 23 2026)
"How can we work around it not being able to check your reasoning? Can we log
that and build a bigger database? It doesn't take up space does it?"

It does not - ten thousand decisions is about 1 MB in git against a 77 MB
repo, and space should never be the reason to record less.

BUT LOGGING THE REASONING ITSELF WOULD NOT WORK. Asked to explain a past
decision, a reasoner reconstructs a tidier version than the one they actually
had. Not dishonestly - unavoidably. An audit of a chain of thought audits the
reconstruction.

**A prediction made in advance is different.** It is fixed, it is dated, and
reality grades it without argument. So every consequential decision records:
what was chosen, what was REJECTED and why, and the falsifiable prediction it
implies. A decision with no prediction cannot be graded, and one with no
rejected alternative was not a decision, it was a description.

WHAT IT PRODUCES that introspection never could: a hit rate PER KIND of
decision. Not "is the judgment good" but "where is it reliable and where is it
not" - and a single overall number would hide precisely that.

HONEST LIMITS, both declared: it cannot tell whether a decision was WISE, only
whether its prediction held, so a lucky call and a sound one grade identically.
And it sees only what somebody logged, which is unlikely to include the
decisions made fastest.

Under twenty graded predictions the record means nothing, and the auditor says
so rather than showing a percentage that looks like knowledge.

## I BUILT THE THING THAT CHECKS ME (Tyler, Aug 23 2026)
"How do we make sure you're not biased to yourself?"

The conflict is real and cannot be fixed by care. I wrote verify-work.mjs, I
chose which failure classes it covers, and I set how strict each rule is —
every one of those decisions made by the party the tool exists to catch. And
bias would not FEEL like bias: a lenient rule feels like a reasonable rule.

SO IT IS MEASURED RATHER THAN PROMISED, by three mechanisms:

1. **WHO CAUGHT IT.** The ledger records the discoverer of every incident, and
   that ratio is the score. Today: **Tyler 11, machines 2.** A guard suite that
   the human keeps out-performing is calibrated to what I already believed
   rather than to what actually goes wrong — which is what self-bias looks like
   from outside: not a wrong rule, an ABSENT one.
2. **NO CHERRY-PICKING.** Every class in the ledger must map to a check. The
   bias guard immediately caught four I had skipped — multi-item pollution, SKU
   existence, coverage overclaim, untested assumption. Adding them found two
   live problems within a minute, which is the cost of having chosen.
3. **IT CANNOT BE QUIETLY WEAKENED.** A negative test asserts the verifier
   still covers every ledger class, so softening a rule fails the build.

THE BIAS GUARD DOES NOT BLOCK. It reports a standing structural fact, and a
permanently-red blocking guard gets muted — which would be the crying-wolf
failure wearing yet another costume.

THE HONEST TARGET: the machine share should rise over time. If Tyler is still
catching most of it in a month, the tooling is decorative regardless of how
many guards are registered.

## LOOK AT IT BEFORE YOU SEND IT (Tyler, Aug 23 2026)
"Art post 2 is all gibberish. How are these things not being proof read or
verified before given to me or ANYONE?"

Twice in one day I minted something outside the pipeline and sent it without
checking. The first was a wrong PRICE. The second was meaningless CONTENT — an
"art post" that was a price table with a stranger's alias on top, four numbers,
three of them prices, on a card explicitly meant to be about art. I viewed the
first card of that pair, caught two layout bugs and fixed them. **I never
opened the second one at all.**

TWO RULES, and the second matters more:

1. **A minted card goes through card-guard.** It catches an unexplained alias
   as a headline, an art card made of prices, a blank rendered as a dash, a
   span claim the numbers do not support, and a VERIFIED chip with no source.
   Tested against the card that actually shipped: four hits.

2. **NOTHING GOES TO A PERSON THAT I HAVE NOT LOOKED AT.** No automated check
   can see clipping, overlap, contrast or a collision — the Arita card clipped
   twice and only my eyes caught it. A guard cannot replace opening the file.
   The verifier now reports every rendered card each run as a standing
   reminder, but the rule is mine to keep, not the machine's to enforce.

THE PATTERN WORTH NAMING: both failures came from the same shortcut — making
something outside the pipeline because it was faster. **The pipeline is not
bureaucracy, it is the accumulated list of things we have already got wrong.**
Going around it means going around all of them at once.

## THE ARTWORK IS THE CONTENT (Tyler, Aug 23 2026)
"You should be pulling the actual cards and putting them side by side, same
size, awesome quality. I'll type the text."

It took two bad cards for me to understand this. Art content is not a
STATISTIC about art. The artwork is the content, the layout is the whole job,
and the words are Tyler's. A price on an art post is a distraction from the
thing the post is about — which is precisely why the USGMEN card failed: four
values, three of them prices, on a card explicitly meant to be about art.

THE RULE, split by kind:
- **Art posts**: real card images, identical size, clean layout, a caption
  naming what they are. **No prices, no stats, no premium math.** Tyler writes
  the words.
- **Data posts**: the number leads and the card carries it, which is what the
  existing mint does well.
- The two do not mix. A stat on an art post is noise; an artwork on a data post
  is decoration.

WHY IDENTICAL SIZING MATTERS more than it sounds: a row of cards at different
scales reads as a collage, and a collage looks like something a fan made rather
than something a company published. Same size, even gaps, one surface colour.

THE STRONGEST SHAPE FOUND SO FAR: an illustrator's FIRST card beside their
LATEST. Arita's Base Set Charizard from 1999 next to Keldeo from 2026 is a
twenty-seven-year career in one image, and it needs no explanation at all.

scripts/card-composite.mjs builds these. Chat cannot fetch the images (403
from the host), so it writes placeholders and a manifest of URLs, and whoever
has network access embeds and rasterises.

## NEVER CONSTRUCT A URL YOU COULD LOOK UP (Tyler, Aug 23 2026)
"The one you sent me has a back of a card. One is correct though."

I built card image paths from the card ID, assuming every set is served by the
same host. Newer sets are not - Mega Evolution serves from images.scrydex.com,
not images.pokemontcg.io. The constructed URL 404'd, and the host answered with
a CARD BACK placeholder.

WHY IT GOT THROUGH EVERY CHECK: the response was 200. The bytes were a valid
PNG. It rendered cleanly at the right dimensions. Nothing in any guard we own
could tell that a technically perfect image was a picture of the wrong side of
a card. Only a human looking at it could, and only if they knew what the card
should look like.

**A constructed URL is a guess wearing the shape of a fact.** The source
publishes the real address for every card; reading it costs one request and
removes the entire class.

THE GENERAL RULE: if a value can be looked up, never derive it. Derivation
encodes an assumption - here, "one host for all sets" - and assumptions fail
silently at exactly the moment the pattern changes, which is the moment nobody
is watching for it.

## MEASURE IT, DO NOT EYEBALL IT (Tyler, Aug 23 2026)
"A lot of failures, no successes. Test test test. Don't stop until you figure
it out cleanly."

Five broken visuals in one day, every one a layout fault: an empty photo panel
eating 40% of a card, a title clipping off the right edge TWICE, a wordmark
sitting on top of a stat row, and a card back where a card front belonged. Each
one shipped because I estimated instead of measuring — and estimating text
width from character count is guessing in a way that feels like arithmetic.

The fonts are vendored in the repo. scripts/layout-check.mjs reads the same TTFs
the renderer uses, so the width it reports is the width that will render.

WHAT IT CATCHES, each tested against the exact failure that produced it:
- text running past the canvas, with the font size that WOULD have fitted
- elements overlapping, using the font's real ascender and descender rather
  than the 0.8/0.25 ratios I first guessed at, which missed a real collision
  by under three pixels
- large unfilled panels where content was expected
- and it does not fire on a card that is fine, which took two attempts

FIRST RUN: 50 problems across 35 cards that had been publishing daily.

WHAT IT STILL CANNOT DO: say whether the result looks GOOD. Contrast, balance,
whether a pairing is beautiful. Geometry is not taste, and nothing here
replaces opening the file.

## STRONGEST, NOT LATEST (Tyler, Aug 23 2026)
"Keldeo was like a common card. Underwhelming."

I paired Base Set Charizard with Arita's most RECENT card, because "latest" is
one line of sort and needs no judgment. It was a common. Tyler remembered the
man had also drawn the Blastoise ex Special Illustration Rare in 151 — a hero
card, twenty-four years after the Charizard — and he was right.

**"Latest" is a data choice. "Best" is an editorial one.** Taking the data
choice because it is easy to compute is how a post ends up technically correct
and worth nobody's attention. The pairing was never about chronology; it was
about two cards a person would stop scrolling for, which happen to share an
illustrator.

--best now ranks by value as a proxy for standing, which is imperfect and
better than recency. The real test is the one Tyler applied by instinct: would
somebody stop for this?

WORTH KNOWING, from the same data: Arita has drawn Charizard SIX times —
Base 1999, Base Set 2 2000, Stormfront 2008, Evolutions 2016, and twice in
2019. Three of those side by side is the same illustrator on the same Pokémon
across two decades, and it may be a stronger post than any pairing.

## WHAT A GOOD POST LOOKS LIKE (Tyler, Aug 23 2026)
One art post landed after five that did not. It is now the specification.

**The image:** Base Set Charizard beside 151 Blastoise ex. Same illustrator,
twenty-four years apart, both hero cards, both Pokémon nobody needs
introduced. Identical size, plain captions, one label.

**Tyler's copy, in full:**
> "It's wild to think the original Charizard artist is still making cards to
> this day"
> "& the fact they let him draw Blastoise 24 years later"

WHAT THAT COPY IS NOT, and every absence is deliberate: no numbers. No hedging.
No chip. No jargon. Two short conversational lines with an ampersand in them.
**He did not use the caption I wrote — his was warmer.**

THE LESSON I KEEP RELEARNING: our DATA voice and our SOCIAL voice are different
instruments. The data voice is precise, hedged and chipped because a number
that misleads is a broken promise. The social voice is a person talking, and a
hedge in it reads as a lack of conviction. Both are correct in their place, and
using one where the other belongs is how a post ends up sounding like a
prospectus.

**THE IMAGE CARRIES THE CLAIM. THE TEXT CARRIES THE FEELING.** Two lines of
copy did the whole job because the picture had already made the argument. That
is why an art post with prices on it fails — the prices are the image trying
to do the text's job.

WHAT MADE THE PAIRING WORK, ranked by how much each mattered:
1. **Both cards wanted.** A hero beside a common is the Keldeo mistake, which
   makes a post underwhelming rather than wrong.
2. **A gap long enough to surprise.** Twenty-four years is a story; two is a
   coincidence.
3. **A subject people already love.** Charizard and Blastoise need no
   introduction; an obscure Pokémon needs a paragraph, and a paragraph is what
   an image post exists to avoid.
4. **One human behind both.** The hook is that a person did this twice, decades
   apart, and somebody let them.

scripts/pairing-finder.mjs scores candidates against exactly those four. Run
against the catalogue it put the winning post FIRST at 103 points, unprompted,
which is the closest thing to a validated model we have.

## ANGLES, NOT TWEETS (Tyler, Aug 23 2026)
"We need a portal that will set up a post for them."

I first said the portal must never write a creator's copy. That was too rigid,
and I was wrong: Tyler's own post used facts I handed him. The line is not
"give them nothing" — it is **never give every creator the same sentence.**

Fifty accounts posting identical text makes them look like a bot farm and us
like the operator running it. It would destroy the one thing a creator brings
that we cannot: their voice.

SO THE PORTAL GIVES THREE THINGS AND WITHHOLDS ONE:
- **The facts**, so nobody has to research. Artist, both sets, both rarities,
  the gap in years.
- **Four or five ANGLES**, each a different direction with a note on why it
  works: disbelief, permission ("they LET him"), same-subject, quiet career,
  and a question — because a question gets replies and replies are the game.
- **A seed sentence per angle**, editable, in a box that says rewrite it.
- **Not a finished tweet.** The seed is a starting point and the page says so
  in plain words underneath: the words are the part that has to be theirs.

Then: download the image, open X with the text prefilled, attach, post. Four
actions from opening the page.

## CATCH'EM CREATORS (Tyler, Aug 23 2026)
"It's performing as one of my best posts yet, coming back and at the worst
time to post. We gotta perfect this model and it needs to be super easy for
creators to use."

FIRST REAL SIGNAL: 154 views, 9 likes, one unsolicited reply from a verified
creator, posted at a poor hour from an account returning after a break. **One
post is an anecdote, not a model** — it sets a baseline, and the platform
agents' blind spot moves from "no data at all" to "one observation", which is
a smaller claim than it sounds.

THE HARD PART IS NOT THE POST, IT IS THE SECOND ONE MADE BY SOMEBODY ELSE.
Tyler had the catalogue, the tooling and a conversation. A creator has none of
that and about ninety seconds of patience. So the page does three things and
stops: shows the ranked pairings, says in one line why each works, and hands
over the image in a click.

**IT DOES NOT WRITE THEIR COPY, DELIBERATELY.** The post that landed did so
partly because the words were Tyler's own — two conversational lines, no
numbers, no hedging. A hedge in a post reads as a lack of conviction, and
borrowed copy reads as borrowed. The image carries the claim; the words carry
the feeling, and the feeling has to be theirs.

THE NAME: Catch'em Creators. It fits the tagline family and it names the
people rather than the tool, which is the right way round.

## CURATION IS NOT SLOP (Tyler, Aug 23 2026)
"Cute cards aren't slop as long as it has a good theme. 9 cutest cards for
your binder. Which generation of the legendary birds did you like the most?"

I over-corrected and banned subjective words outright, which would have blocked
the best content we could make. The amendment:

**THE TEST IS NOT WHETHER THE WORD IS SUBJECTIVE. IT IS WHETHER THE READER IS
INVITED TO DISAGREE.**
- "These are the most iconic cards" — asserted, unfalsifiable, closes the
  conversation. Slop.
- "9 cutest cards for your binder — which would you pick?" — obviously
  curation, invites disagreement. Not slop.
- "Which generation did the birds best?" — a question, and a question cannot
  be wrong.

**A post that starts an argument beats one that ends it.** Debate, disagreement
and people arguing about which Articuno is better ARE the engagement — and a
guard that blocked all of it would have optimised us into being correct and
unread.

TWO LAYOUTS BUILT FOR IT:
- **--binder**: a 3x3 page, the way a collector actually sees cards.
- **--grid RxC**: rows that compare. Three legendary birds across three eras,
  captioned as a question. Every card in it is real and sourced; only the
  QUESTION is subjective, and a question is honest about being one.

slop-guard now allows a subjective word inside an invitation — a question, a
first-person frame, an explicit "which would you". It still blocks the same
word stated flatly as a finding.

## SLOP IS A GROUPING THAT IS NOT IN THE DATA (Tyler, Aug 23 2026)
"We need to be super creative and engaging, with ZERO AI SLOP. That's the
quickest way to screw everything up."

Right, and it needed a precise definition rather than a vague warning.

**"Cute cards" is slop. "The nine Eeveelutions" is not.** One is an adjective I
chose; the other is a list somebody can argue with. "Iconic" is slop. "Drawn by
the same artist" is a field. The difference matters because the moment a reader
checks one claim and finds nothing behind it, **every other claim we have made
becomes suspect at once** — and we have spent weeks earning the ones that are
true.

THE RULE: every grouping derives from a field we hold — name, artist, setId,
setName, rarity, releaseDate, price — or from a JUDGMENT LIST stored openly in
the output where anybody can disagree with it. The Eevee line is nine named
Pokémon in a file, not a vibe in a sentence.

FOUR SHAPES BUILT, 743 formulas, all derived:
- **one artist, one family** — artist field crossed with a stored list. Found
  that Kagemaru Himeno drew the original three Eeveelutions in Jungle 1999 AND
  Eevee again in Hidden Fates 2019.
- **one Pokémon, many hands** — Blastoise has been drawn by eleven different
  illustrators, and the difference needs no explanation.
- **the debut** — an artist's earliest releaseDate beside their best-known card.
  A debut is a date, not a feeling.
- **one set, one hand** — a set seen through one person rather than as a
  checklist.

slop-guard blocks the run on any grouping with no field behind it, and on the
specific words that assert significance the data cannot support: cute, iconic,
stunning, underrated, best, greatest. Negative-tested by planting one.
