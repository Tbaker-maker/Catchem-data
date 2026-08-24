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

## ASSERTING VERSUS INVITING (Tyler, Aug 23 2026)
Amends the slop law below, because my first version of it was wrong in a way
that would have cost us our best post shapes.

I banned the word "cute". Tyler's correction: **"Cute cards aren't slop as long
as it has a good thing. Nine cutest cards for your binder. Then shows nine in
binder format."** And: **"Which generation of the legendary birds did you like
most? Show three rows of three. Start a debate."**

He is right, and the line I drew was in the wrong place. It is not subjective
versus objective. It is whether we **STATE** significance the data cannot
support, or **ASK** the reader for theirs:

- *"The most underrated card in the set"* — slop. States a fact nothing backs.
- *"Which of these do you like most?"* — a question. States nothing at all.
- *"Nine cute cards for your binder"* — openly a selection, not a ranking.

**A question invites disagreement, and disagreement IS the conversation.**
Telling a reader what is best gives them nothing to do; asking gives them a
reason to reply, and replies are the whole game.

TWO SHAPES BUILT FROM THIS:
- **The binder page.** Nine cards, three by three, because a real binder page is
  three by three and a collector recognises the shape before reading a word.
- **Three rows of three.** A trio across three eras — the legendary birds in
  Fossil 1999, Next Destinies 2012 and 2022, nine cards, one question. Derived
  entirely from name, releaseDate and rarity. Nothing asserted.

THE GOAL, in Tyler's words: conversation, debate, healthy engagement,
knowledge. Not a verdict handed down.

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

## SEVEN FORMATS, DECIDED ONCE (Tyler, Aug 23 2026)
"Make formats for 1, 2, 3, 4, 6, 8, 9 cards. All in one image frame, sized
accordingly. Safeguard it so it's simple for users."

Every supported count has a fixed, measured frame in scripts/layouts.mjs, so
nobody - human or machine - makes a layout decision at post time. **Every
visual we got wrong today was a decision made in a hurry**, and a table removes
the hurry.

| count | layout          | frame      | ratio | timeline |
|-------|-----------------|------------|-------|----------|
| 1     | the single      | 818x900    | 1.10  | shows whole |
| 2     | the pairing     | 966x774    | 0.80  | shows whole |
| 3     | the trio        | 1114x635   | 0.57  | shows whole |
| 4     | the row         | 1342x593   | 0.44  | shows whole |
| 6     | the half page   | 1024x1030  | 1.01  | shows whole |
| 8     | the spread      | 1142x890   | 0.78  | shows whole |
| 9     | the binder page | 934x1341   | 1.44  | slightly tall |

WHY THE COLUMN COUNTS ARE WHAT THEY ARE: X crops a single image past roughly
4:5 in the timeline, and a Pokémon card is 1.40:1 on its own. So columns are
chosen for FIT rather than habit — **four cards go in ONE ROW, not a 2x2**,
because a 2x2 of portrait cards lands at 1.45 and gets cut. The exception is
nine: a binder page is three by three, it runs 1.44, and changing that to suit
a timeline would be changing the thing itself.

FIVE AND SEVEN ARE DELIBERATELY UNSUPPORTED. They leave a ragged final row,
which reads as a mistake rather than a choice. An unsupported count fails
loudly and names the nearest workable options — drop to four, or add one to
reach six — rather than producing something lopsided.

## BANK THE KNOWLEDGE, THEN BUILD THEMES FROM IT (Tyler, Aug 23 2026)
"We need to book-bank these to our history and use them to create more themes."

The banned-cards research produced five sourced facts, and one of them was
CORRECTED against our own catalogue before publication: three secondary
sources agree Kadabra vanished for twenty-six years, and our own data shows
English prints in 1999, 2000 and 2002. The real gap is twenty-one years.

That is the whole method in one example. **Research produces claims, our own
data adjudicates them, and only what survives becomes a theme.** A theme built
on a number three sources agree on and our primary data disproves would have
been the most confident wrong thing we ever published.

data/knowledge.json now holds seventeen facts, each with sources, a date, a
verifier, a confidence tier and a falsifier. Every future theme draws from
there rather than from a search.

## ART MODE, AND WHEN NOT TO USE THE CARD (Tyler, Aug 23 2026)
"We can make content like this as well and just use visuals if the post is
better without card format. If it confuses the system and sets us up for AI
slop, forget it and just use the full cards."

THE SIGNAL: his Charmander post did 791 views and 38 likes. The Arita pairing
did 154 and 9. Same account, same week - **five times the reach from cropped
card art and a two-word hook.** No frame, no captions, no data.

WHY IT IS NOT SLOP: the image is a real illustration from a real card,
unmodified in content. The risk here is aesthetic, not factual - a bad crop
looks amateur, it does not mislead. That is a different and lesser danger than
a wrong number.

THE SAFETY RULE THAT KEEPS IT CLEAN: crop ONLY where the art IS the card -
Illustration Rare and Special Illustration Rare, 687 of them. On a classic card
the art sits in a small window whose position moves by era and by rarity, and
cropping those blind produces a mangled frame, half a text box or a border.
That is the aesthetic equivalent of shipping a card back, and we did that once
today already. --art refuses anything it cannot crop safely and says why.

ONE THING TYLER SHOULD KNOW, recorded honestly: a bare crop is a WEAKER
nominative fair use position than a whole card, because nominative use rests on
identifying a product and a crop presents the artwork as artwork. Not a reason
to avoid it - the whole hobby posts card art and the format works. A reason to
CAPTION it: name the card, the set and the illustrator on every crop. That
restores the identifying purpose, credits the person who drew it, and is better
content regardless.

AND THE COPY LESSON, which is the real one: **"who's still awake?" is two words
and it outperformed everything we have written.** Too much text goes over
people's heads. The image earns the attention; the words only have to give
somebody a reason to reply.

## CREDIT THE ARTIST, OR DO NOT POST THE ART (Tyler, Aug 23 2026)
"Yes credit the artist."

Now enforced rather than intended. Every composite renders the illustrator's
name on the image itself, and an art post with no credit **does not ship** - it
fails loudly and names the cards.

THE GAP THAT REVEALED: 1,227 of 16,468 catalogue cards carry no illustrator,
and for some of them - Umbreon ex among them, which was in an option I sent
Tyler - the SOURCE has no artist field either. So this is not a data-cleaning
task with an end; it is a permanent condition, and the honest response is to
pick a credited card rather than to quietly drop a line nobody would notice
was missing.

WHY IT IS THE RIGHT RULE INDEPENDENT OF ANY LEGAL QUESTION: posting somebody's
illustration without their name is plainly discourteous. That is true whether
or not anyone would ever object, and it is the reason to do it - the fact that
it also strengthens our position is a bonus, not the argument.

ON THE LEGAL FRAMING, recorded once and not relitigated: Tyler's position is
that this is homebrewed content from public material and is fine. He is right
about the practical reality - the hobby runs on fan content. The single
distinction worth keeping straight is that publicly VIEWABLE is not public
DOMAIN: card art is copyrighted, and fan use is tolerated rather than licensed.
That costs nothing while we are free and unmonetised, and it is precisely what
the IP consult exists to settle.

## THE AGENTS SEE WHAT I DO NOT (Tyler, Aug 23 2026)
"Get agents working on this as well, don't do it all yourself — they will see
stuff you won't."

He was right within about four minutes of the scout existing.

I had recorded the Uri Geller story as a KADABRA fact: twenty-one years without
a print, ended when Geller relented in 2023. Every article says the same. The
scout searched every print year in our own catalogue and found the gap covers
**ABRA too** — the pre-evolution, which is named in no article about the
lawsuit — and that **ALAKAZAM partially escaped**, appearing in 2009, 2019 and
2020.

So the ban was not line-wide, and the story is more precise than the one
everybody tells. **I would not have found that by remembering harder**, because
I was recalling what a Pokémon fan knows rather than looking at what our data
says.

THE PRINCIPLE: search the DATA, not your memory of the subject. Memory finds
the famous patterns and misses the odd ones, which is exactly backwards —
the famous ones are already posted by everybody else.

WHAT THE SCOUT LOOKS FOR, none of it requiring taste: an illustrator who drew
a Pokémon exactly once out of forty-plus cards · a Pokémon absent from print
for seven years or more · an artist whose output is dominated by one creature ·
a year one illustrator drew a sixth of the good cards.

**IT PROPOSES AND NEVER ADOPTS.** Candidate themes — fifteen Pokémon ending in
"-eon" — are flagged for a human, because deciding a group belongs together is
taste, and taste goes in a file a person signs. A guard fails the build if the
scout ever writes to data/themes.json itself.

ITS DECLARED BLIND SPOT, and the honest one: **it cannot tell whether a pattern
is interesting, only that it is unusual.** It located the Abra gap. A human
supplied Uri Geller.

## A BATTLE ONLY WORKS IF IT IS CLOSE (Tyler, Aug 23 2026)
"Card battle — comparing starts debates, which is good. We need to spark
conversation."

Right, and the mechanism has a precise requirement that is easy to miss: **a
battle only works if it is close.** A $2,000 card against a $12 one is not a
debate, it is a price check with a question mark on it. The reader glances,
agrees, and scrolls.

So candidates are matched: same Pokemon, **within 45% of each other on value**,
different illustrator or different era. Nobody can settle it by pointing at a
number, which forces an actual opinion - and an opinion is a reply.

First run, and the matching holds: Chansey by Ken Sugimori against Ryo Ueda,
3% apart. Blastoise ex, 13%. Charizard, 26%. Every one of them a real choice.

## CONTROVERSY IS CITED OR IT IS NOT PUBLISHED (Aug 23 2026)
The historic and controversial lane - banned art, the Geller lawsuit, the manji
on Koga's Ninja Trick, the Jynx recolour - is the strongest knowledge material
in the hobby and the most dangerous to get wrong.

**Being wrong about a controversy is how you become one.**

So every claim in that lane comes from data/knowledge.json carrying a source, a
date, a verifier, a confidence tier and a falsifier. Nothing is remembered.
The Kadabra correction proved why: three secondary sources agreed on
twenty-six years, our own catalogue said twenty-one, and the theme scout later
showed the gap covers Abra too. Three passes, three corrections, on a story
everyone thinks they know.

## A LINTER ASKS IF THE CSS IS VALID (Tyler, Aug 23 2026)
"Use the designer agent — if we don't have one, hire and make top of its class.
Audit us and all of the photos, formats, everything."

A design lead asks a different question: **was this page DESIGNED?** And the
tells of an undesigned page are countable rather than a matter of taste — a
type scale with fourteen sizes because each was chosen in the moment, nine
greys that are all almost the same grey, an accent used everywhere so it
accents nothing, spacing that was nudged until it looked right.

None of that is invalid CSS. All of it is why a page reads as beta.

WHAT IT FOUND ON THE FIRST RUN, all real:
- Four public pages whose headings would render in **Times** on a slow
  connection: `font:800 30px Syne` with no fallback while the body text had one,
  which looks broken rather than unstyled.
- An accent used **134 times** on one page.
- **Two shipped pages no generator writes.** faq.html was created on 20 August
  and nothing regenerates it, so every fix applied at the source misses it and
  it drifts further from the site daily. **A page nothing owns is worse than a
  page with a bug, because the bug at least has somewhere to be fixed.**

AND FOUR FALSE POSITIVES IT PRODUCED ON ME, each now a declared failure mode:
it read `font-family:` and missed the `font:` shorthand, flagging four healthy
pages; it read CSS custom properties as "no font stack at all" when tokens with
fallbacks baked in are the CORRECT pattern, so it punished better practice; and
I burned three regex attempts on a fixed literal before using a plain replace.

FIX AT THE GENERATOR, NEVER ON GENERATED OUTPUT. Patching a file a script
rewrites every morning is a fix that lasts until 04:00 UTC.

ITS BLIND SPOT, declared and unfixable: **it cannot SEE.** It counts and
measures. It cannot tell you a page is ugly, only that the choices behind it
were not made deliberately. Taste still needs eyes.

## NOBODY SEES MORE THAN HALF (Tyler, Aug 23 2026)
"It'll need to work with CC and you, who can see more than you guys. Feed it
code and vice versa so everyone sees everything in their own way."

The designer counts and cannot see anything rendered. CC sees the rendered page
and cannot reason about what produced it. Chat reads the code and cannot see a
single pixel. Tyler has taste, which none of the three approximates.

**So the handoff is structural rather than hoped for.** research/VISUAL-REVIEW-PROTOCOL.md:
the designer writes two lists every run - what it SETTLED, and what it measured
but cannot judge. CC answers the second from screenshots by writing back into
the same file. Chat fixes at the generator. A question with an answer is never
asked again.

THE PHRASING RULE, which is most of the value: every question carries its
number. An agent that says "the typography feels inconsistent" has handed over
its uncertainty and none of its evidence. One that says "seven corner radii:
6, 9, 10, 11, 13, 14, 16" has done the work and left exactly one judgment to a
human - the only part it was never able to do.

AND THE FIRST THING THE LOOP CAUGHT WAS MINE. Within a minute of existing it
flagged seven corner radii on build.html - the page I had just redesigned while
auditing everyone else for exactly that failure. Collapsed to three steps: 9
for small controls, 13 for panels, 16 for the binder.

That is the loop working on the person who built the loop, which is the only
version worth having.

## UNSHIPPED SCORES ZERO (Tyler, Aug 23 2026)
"A review page from all the agents put into one. What's working, what needs
looking at. Ratings of our tools, products, community, engagement. Make it keep
us accountable."

The daily digest is operational - what happened, what to do today. The review
asks how we are ACTUALLY DOING, and the only version worth having is one that
can say "badly".

THREE RULES:
1. **Every rating is derived from a count we hold, never chosen.** A score
   somebody picked is a mood with a number attached.
2. **Unshipped scores ZERO.** Not "in progress", not "on track". A review that
   rewards work nobody can use is the most comfortable lie a solo founder can be
   told.
3. **The trend matters more than the level.** A 6 that was a 3 is a different
   story from a 6 that was a 9, and the level alone hides which.

FIRST REVIEW: **4.7/10.** The machine scores 10 and community scores 0, which is
the whole picture in two numbers. Engagement is a 2 because one measured post is
an anecdote, and the honest note underneath is that we have been acting on a
five-times performance difference observed exactly once.

AND IT BROKE ITS OWN FIRST RULE ON ITS FIRST RUN. Two areas read fields that do
not exist and quietly fell back to 5 - a middling number where a measurement
should be, which is precisely what rule one forbids. Now an unreadable count
reports UNKNOWN. The trend column caught it immediately: "The machine, up from
5", where the 5 had never been real.

## MEASURE WHAT IS HAPPENING, NOT ONLY WHAT WE BUILT (Tyler, Aug 23 2026)
"Community is low at the moment but very strong for early stages. I have been
creating community around this - engagement keeps growing on @longedeth, and
I am talking about it in my old community. Some are excited, getting others
awoken again."

The review scored Community 0 because Discord, the newsletter and the creators
page have not shipped. All true, and all of it counted only the surfaces WE
BUILD - while Tyler has been building the actual community by hand.

**A founder posting consistently to a growing audience IS community formation.
It simply does not appear in a repository**, and an agent that only measures the
repository will report a real thing as absent.

That is the blind spot the review exists to expose, and on its first run it
reproduced it instead.

NOW SPLIT IN TWO, both honest:
- **Our surfaces: still 0.** Nothing we build has shipped and no amount of
  founder effort changes that.
- **Founder-led: 5, on thin evidence, and it says so.** One post with hard
  numbers; the rest is Tyler's read of his own audience. Recorded as
  FOUNDER-REPORTED, which is the best evidence available at this stage and
  better than discarding a real signal for not being a metric.

THE RISK WORTH NAMING, and it is in the file: the audience is being built on a
personal account. That is the right way to start, and it means the community
currently belongs to a person rather than to the product.

## HONING QUALITY IS A LOGGING PROBLEM (Tyler, Aug 23 2026)
"The editor is alive. If we can hone down great post quality it could be a game
changer."

He is right about the prize and the blocker is not where it looks. We can
generate **84 formulas**. We have outcome data on **two posts**. The
pairing-finder ranked the better one first unprompted, which is genuinely
encouraging and is still a sample of one.

**Nothing connected a post that went out to the formula that produced it**, so
posting more taught the ranker nothing. A hundred posts and we would have known
exactly as much as we did after the first.

scripts/log-outcome.mjs is the cheapest possible fix: one line per post, the
shape and the numbers. **Under twenty entries a difference between shapes is
noise wearing a number**, and the tool says so on every run rather than
flattering a small sample.

WHAT THE FIRST TWO ENTRIES ALREADY SAY, and it is uncomfortable: the **art crop
with a two-word hook did 791 views. The carefully constructed artist pairing did
154.** Five times, same account, same week. We have spent the day building
elaborate multi-card formulas and the best-performing thing we have made is one
cropped card and four words.

That is two data points and it may reverse entirely. **It is also the first
evidence we have ever had, and it points away from the direction we were
building.** Worth eighteen more posts to find out.

## THE CARDS WRITE THEIR OWN JOKES (Tyler, Aug 23 2026)
He posted Slakoth at 2am with "how I feel after coding for 17-18 hours
straight." **Slakoth's attack is called TAKE IT EASY.**

Neither of us knew that. The card wrote the punchline, and **nothing we generate
could have found it** - our catalogue holds name, artist, set, rarity, date and
price, and not one word the card actually says.

**Attack names are on 82% of cards and flavour text on 40%, free, from the same
source we already ingest.** That is the single biggest content gap we have: the
copy is already printed on the cards and we throw it away at import.

WHAT IT UNLOCKS, none of which is possible today: search by what a card SAYS.
Cards whose attack name is a mood. Cards whose flavour text is accidentally
profound. A "late night" theme that finds Take It Easy, Sleep Powder and Slack
Off by reading them rather than by me listing Pokemon I think look tired.

AND THE OTHER HALF OF WHY THE POST WORKED, in Tyler's own words: **"my bot found
me the perfect visual which then sparked natural creativity."** The tool did not
write the post. It put the right thing in front of him and he wrote it. That is
exactly what ANGLES NOT TWEETS was aiming at, and it is the first evidence the
aim was right.

## ELAPSED TIME IS THE WRONG QUESTION (Aug 23 2026)
First morning after wiring the watchdog, and the overnight job had not fetched.
**The heartbeat reported "everything has checked in."**

It allowed 30 hours, deliberately, so a late run would not cry wolf. Sound
reasoning, wrong measurement — because a window built to forgive a LATE run is
exactly the right size to hide a SKIPPED one. Last fetch 22:56, scheduled fire
04:00, elapsed 15.9h against an allowance of 30. Every number fine, the run
never happened.

**The alarm was installed, wired and running, and asking a question whose answer
could not reveal the fault.** That is worse than no alarm, because a green
heartbeat is read as evidence.

THE FIX: the check now knows the job's SCHEDULE. A daily 04:00 stage whose last
check-in predates the most recent 04:00 has missed a run — true at hour one, not
at hour thirty. Three hours of grace so a job still running is not reported as
missed.

AND A SECOND FAULT UNDERNEATH IT: the finding carried a note explaining why, and
the report printed elapsed hours instead — "last seen 16h ago, allowed 30h",
which reads as a threshold that has not been breached. **It computed the right
answer and displayed the wrong one.** A finding that carries a reason must print
the reason.

## THE FILTER IS THE PRODUCT (Tyler, Aug 23 2026)
He saw a creator posting *"Day 89 of posting one Pokémon card I love that costs
under $10"* and wanted us to make that startable by anybody.

**The streak is not the feature. The FILTER is.** A streak counter alone would
have every creator posting from the same pool and looking like each other, which
is the thing Tyler explicitly does not want: *"help keep us more diverse than
the same content everywhere."*

A filter makes the series THEIRS. Two people running "IRs under $10" and "SIRs
from 2024" draw completely different cards from the same 687-card pool, and the
pick is seeded by their start date so even identical filters diverge from day
one.

WHY IT RETAINS BETTER THAN ANYTHING ELSE WE HAVE BUILT: it is the only mechanic
that gives somebody a reason to open the tool on a day they arrived with no
idea. **Day 89 is a commitment nobody wants to break** — and we did not invent
that, a creator did, and it is worth copying because it plainly works.

TWO RULES IN THE ENGINE:
- **No repeats, ever.** A streak that serves the same card twice is a streak
  somebody stops trusting the day they notice.
- **Deterministic per day.** Reloading must not reshuffle the pick, or the
  series is not a series.

Local only, same reasoning as own/want: a streak is a person's posting history,
and on a server that is user data.

AND THE FILE FOUGHT BACK A THIRD TIME. A backslash-quote inside a JS string
inside a Node template collapses and terminates the string — CC hit it twice
last night and documented the fix. I hit it again by not reading their commit
closely enough. **Single-quoted HTML attributes need no escaping at any level**,
and that is now three occurrences of one bug in one file.

## BUILD OUR SLAB, NOT THEIRS (Tyler, Aug 23 2026)
"It would be cool if we could layer in the guards to see what their slab would
look like in certain colours. Could be powerful to then release our own guards
and market it that way."

Right, and the version that works is the one that was never a replica.

TWO RISKS IN COPYING A NAMED GRADER'S SLAB, and the second is the serious one:
1. Their label, logo and colour scheme are trade dress.
2. **A convincing fake slab image is a fraud tool.** Somebody lists a raw card
   with our lookalike render and a buyer pays graded money. That is not us being
   sued — that is a fraud our tool enabled, and it would be entirely our fault.

**So it is a Catch'em slab.** Our frame, our label, unmistakably nobody else's.
Four colourways: green, gold, black, ice.

THAT IS NOT A COMPROMISE, IT IS THE BETTER PRODUCT. A replica markets the
grader. Ours markets us, in every screenshot, on somebody else's timeline. And
it is precisely the thing Tyler wants to sell later, so building it as ours from
the first line costs nothing and saves a rebuild.

ONE DETAIL WORTH KEEPING: our label carries the card, the set, the year AND the
illustrator. That is more than a real slab label holds, and the illustrator is
the part we care about most.

## THE CHECK OUTSIDE THE LIST (Aug 23 2026)
The pre-mortem shipped this morning to make every guard declare what it cannot
catch. Its own negative test then **passed while broken**, which is precisely
the failure it was built to prevent.

The cause: **heartbeat.mjs was not in the guard list.** It runs on the watchdog
workflow rather than the daily pipeline, and the audit enumerates the pipeline —
so the pre-mortem never asked it anything.

**The one check whose blind spot cost us a morning was the one check nobody
interrogated, because it lived outside the list of things we interrogate.**

THE GENERAL SHAPE, and it is worth more than the fix: a list of things to check
is itself a thing that needs checking. Anything running on a different schedule,
a different workflow or a different lane is invisible to a checker that
enumerates one of them — and being off the main path is exactly what makes a
failure quiet.

Guards now carry `offPipeline` so the audit can include them without demanding
they appear in a pipeline they were never part of.

## TIMING CONFOUNDED FORMAT (Aug 23 2026)
The Arita pairing — Base Charizard beside the 151 Blastoise ex, "Twenty-four
years apart. Same illustrator." — did **154 views** on its first outing at a bad
hour.

Reposted at 9:18pm it did **18,800 views, 401 likes, 14 replies, 37 bookmarks.**

**Same cards. Same caption. Same format. 122 times the reach.**

WHAT I GOT WRONG: I logged 154 against the crop's 791 and concluded the crop
shape beat the pairing shape five to one. I had **one data point per shape**,
and I drew a conclusion about FORMAT from numbers that were mostly measuring
HOUR. That is the commonest mistake in small-sample analysis, and I walked into
it in the same session where I told Tyler the log needed twenty entries before
it meant anything. **I said the number and then reasoned as though I had not.**

WHAT IS ACTUALLY TRUE, on the evidence we now have: **the two-card pairing is
the strongest shape we have produced.** It carries a real claim, the images make
the argument without the caption, and the caption is one line that could be read
aloud.

THE RULE: **the hour is not optional metadata.** Any comparison between shapes
that does not hold posting time roughly constant is measuring the time. Until
several posts of the SAME shape exist at DIFFERENT hours, the outcome log ranks
conditions rather than formats, and it now says so in its own file.

AND THE THING WORTH REPEATING: Tyler's reply on the post was *"this visual was
built by our in-house content creator portal."* The tool made the image, he
chose the pairing, and he wrote the words. That division has now produced our
best post twice.

## THE CARD SUPPLIES THE IDEA, TYLER SUPPLIES THE SENTENCE (Aug 23 2026)
Three posts that worked, three times the same division of labour:

- **Slakoth**, attack literally *Take It Easy* → *"how i feel after coding
  17-18 hours straight"*
- **Sunflora**, flavour text *"always looking in the direction of the sun"*,
  attack *Redirected Sunlight* → *"Only Good Vibes. Pass it along & see it
  grow."* — a plant, that grows, and the ask is to make it grow
- **Arita**, where the fact is the post: same hand, twenty-four years

**Not one of these came from a formula we generated.** In every case the CARD
supplied the idea and Tyler supplied the sentence, and the tool's job was to put
the right card in front of him.

WHY THAT MATTERS MORE THAN IT SOUNDS: we have 84 formulas that produce titles
and angles, and the three posts that worked used none of them. The winning
input is not a generated caption — it is **a card whose own printed words are a
setup somebody can land**. That is a search problem, not a writing problem, and
it is exactly what capturing attack names and flavour text unlocks: 82% of cards
carry an attack name, 40% carry flavour text, and we hold neither.

**A tool that hands over a finished caption is competing with Tyler. One that
hands over the right card is arming him.** The second is both more useful and
the only one of the two we are good at.

## AGE IS THE SECOND CONFOUND (Aug 23 2026)
One hour after timing caught me, age did. The Sunflora post was seven hours old
and the Arita twenty-two, and the report lined them up as though the numbers
meant the same thing. A post accumulates views for days.

The log now flags anything under 24 hours as still accumulating, and the shape
table states in its own output that it **controls for nothing** — not hour, not
age, not follower count on the day. **It is a record, not a finding**, and
labelling it as such is cheaper than being corrected by it twice.

## VERIFIED THE NOUN, SKIPPED THE VERB (Aug 23 2026)
I put **"177 sealed products, repriced every single day"** on a landing page
about to take viral traffic. I checked that 177 was correct. **I did not check
"every single day"** — while the heartbeat was, at that exact moment, reporting
the day's 04:00 run as failed and the data as 25.6 hours old.

**I verified the noun and skipped the verb**, and the verb was the part that had
just broken.

TWO KINDS OF PERISHABLE CLAIM, and I shipped both in one sentence:
- **A frequency** is true until a cron fails, and then it is a lie on a public
  page nobody is watching.
- **A count** goes stale in the other direction, the moment coverage grows —
  which Tyler says it already had.

THE FIX IN THE COPY: state what is TRACKED and how we BEHAVE when wrong.
*"Sealed product prices across the whole market, tracked continuously… where we
get one wrong we publish the correction."* **Behaviour does not break when a job
does.**

THE FIX IN THE MACHINE: verify-work now fails on our-data-plus-a-frequency
anywhere on a shipped page. Its first version flagged five pages that were fine
— "post from it daily" is advice to a user, "The Daily Three" is a product name,
"Daily Berry" is a rule. **A check that cries wolf five times out of six gets
muted, and a muted check is worse than none**, so it was narrowed to the exact
pairing and re-tested against the real mistake.

## A FAKE DEPENDENCY PROVES NOTHING (Aug 23 2026)
I told Tyler the card editor was verified working. He opened it: **no images, no
themes, no search results.**

**One cause.** The editor did `fetch("card-index.json")`, and from a `file://`
page Chrome blocks that as cross-origin. INDEX stayed empty, so the showcase had
nothing to render, `canFill()` saw an empty pool and rejected every theme, and
search had nothing to search. **Three symptoms, one line.**

WHY I MISSED IT, and it is the part that matters: **my smoke test supplied a
fake `fetch` that always succeeded.** I tested the code path that cannot fail
and called the result verified. The harness also returned a stub element for
every id, so a missing element looked identical to a present one.

**A test that replaces the dependency most likely to fail is testing the
absence of the bug.**

THE FIXES:
- The index is **embedded**, not fetched. One file, and a single file cannot
  arrive half-configured.
- `offline-smoke.mjs` runs the page with `fetch` **REJECTING**, which is the
  real condition, and with elements returning **null** when absent, like a
  browser. It caught a second bug immediately: removing the fetch removed an
  async gap that had been accidentally sequencing the first render.

AND THE HABIT TO KILL: I have now said "verified" about this file four times and
been wrong three. **The word has to mean the thing was exercised the way it will
actually be used** — opened from disk, no server, no network — or it means
nothing at all.

## A MISSING BRANCH FAILS SILENTLY (Tyler, Aug 23 2026)
"The only thing that works in theme is artist, and the two themes give the same
results. Nothing else works."

Both exactly right. `buildIdeas` switched on theme **id**, so any theme whose id
was not in the list produced **nothing at all** — and `artist-career` and
`first-and-last` shared one branch, which is why two themes returned the same
cards.

**A switch on identity fails silently when a case is missing.** The theme
appeared in the column, accepted a click, and returned an empty list that looked
exactly like "nothing matched".

THE STRUCTURAL FIX: every theme declares a **SHAPE** in `data/themes.json` and
the builder dispatches on that. A theme without a shape now says so on screen
rather than showing an empty box. Eight shapes: list, many-hands, artist-span,
debut, battle, one-set, eras, story.

WHAT THE NEW CHECK FOUND IMMEDIATELY, none of which anything else could see:
- `megas` had one member — the literal string "Mega" — so it collapsed to a
  single distinct match. Expanded to the 26 real forms.
- `late-night` had `bestAt: "late evening"` where a list of CARD COUNTS
  belonged, so every fit test compared characters to numbers and quietly failed.
- `historic` and `controversy` both read the same fact list from the top and
  returned the same cards. They are different questions and now read different
  slices.
- **Two themes were the same theme written twice.** I added "Cards that want you
  to go to bed" without noticing "Pokémon caught napping" already existed.

THE RULE: **no two themes may return an identical set.** That is now a test, and
it is the only thing that would ever have caught the duplicate.

## A WRONG CARD BESIDE A TRUE CLAIM (Tyler, Aug 23 2026)
He generated a story card and got a true fact about **Koga's Ninja Trick**
sitting beside pictures of **The Rocket's Trap** and **Koga**.

The matcher compared the FIRST WORD of each card name against the claim. The
sentence contains the word "The". So "The Rocket's Trap" matched.

**Fourth occurrence of token matching in two days** — "N" inside "ninja", "tin"
inside Dratini, a substring in the sell refusal, now this. And the worst of the
four, because the others failed QUIETLY and this one fails PLAUSIBLY: **a wrong
card beside a true claim reads as researched.** That is the windowless-price
class — an artifact that looks more credible than it is.

THE FIX: full-name matching with normalised apostrophes, because our data uses a
straight quote and the prose uses a curly one. A fact whose card is unavailable
is now **skipped**, never illustrated with a card that merely shares a word.

AND THE SECOND HALF: the story shape filtered by hero rarity, so Koga's Ninja
Trick — an Uncommon — was excluded, and the only card that could illustrate the
fact was the one the pool refused to consider. **A story is about its card,
whatever the rarity.**

THE LABEL BUG UNDERNEATH IT: the frame height was ESTIMATED from character count
at a hardcoded 2535 width while the wrapping was MEASURED at the real width. On a
2056 frame the estimate said two lines and the draw produced four, and the last
fell off the canvas. **Two answers to one question is how text clips**, and the
layout checker has caught this exact class before — five failures in one day from
estimating character count. I wrote the estimator anyway.

## NOTHING GATES, EVERY CONTROL REFINES (Tyler, Aug 23 2026)
"The angle section is very bad. Not even working."

Both true, and the second had a precise cause: `fCount` started at 0 and
`buildIdeas` bailed on `!fCount`, so **clicking an angle before a count cleared
the box and returned — silently, with no explanation.** The angle column is the
last thing on screen and the count is three columns to its left. Anybody who
clicks the interesting-looking control first gets nothing and concludes it is
broken. He did.

**A hidden prerequisite that fails silently is the worst possible failure**: the
feature looks broken AND says nothing.

THE RESEARCH NAMED IT EXACTLY: *"Progressive disclosure is for the rare, never
the necessary. Putting a core action behind more-options is friction dressed as
minimalism. If users cannot find the hidden feature, you did not disclose
progressively — you hid it."* And ChatGPT converts 95%+ of first visits on **one
input with no gates**, while my editor asked four questions before returning
anything.

THE FIXES:
- **A default count of two** — the shape that did 18,800 views — so every
  control REFINES and none of them GATES.
- **The 35 themes are GROUPED, not hidden.** By subject, by artist, by story, by
  era, by set, by argument. At that size the answer is structure; a "more
  options" click would have been the same mistake one level down.

THE RULE: **no control may require another control to have been used first.** If
one genuinely must, it says so on screen at the moment of the click — never
nothing.

## ASKING INVITES DISAGREEMENT, ASSERTING INVITES CORRECTION (Tyler, Aug 23 2026)
"I'd like us to help with the text ideas. I'm stumped myself and shouldn't be
with our tools. Options, not just one. The option should ALWAYS spark
conversation."

THE EVIDENCE, from the only three posts with real numbers, and none of them
asserts anything:
- **18,800** — *"It's wild to think the original Charizard artist is still making
  cards to this day"*: a shared observation with an implicit "right?"
- **791** — *"Late night check-in. Who's still awake?"*: a question answerable
  in one word
- **93** — *"Only Good Vibes. Pass it along & see it grow"*: a call to
  participate

**Every one leaves room for a reply.** And that is our slop law arriving at the
same place from a different direction: **asserting invites correction, asking
invites disagreement, and only one of those is a thread.**

THE RULE, absolute: no generated line may state that something is best, worst,
most underrated or most anything. **A superlative closes a conversation by being
either agreed with or wrong.**

FOUR REGISTERS, so fifty creators do not sound alike: **Ask** (answerable in one
word), **Notice** (the 18,800 shape), **Confess** (relatability outperforms
authority), **Invite** (add to it rather than judge it).

AND THEY ARE OPTIONS, NEVER A FINISHED POST. Fifty people posting an identical
generated sentence is a bot farm. The panel says "tap one, then make it yours"
because the last edit has to be theirs.

MY OWN CHECK MISSED ONE: I generated *"This one doesn't get talked about
enough"* and my assertion test passed it, because I had only looked for
superlatives. **Claiming under-appreciation is an assertion too** — it is a
claim about what other people have failed to notice. Now a question: *"Does this
one get talked about enough?"*

## A LIST IS WRONG THE DAY A SET LANDS (Tyler, Aug 23 2026)
"I feel like we need to fully organize our catalogue with different filters by
art, history and price data. We need to connect each card to categories."

The measurement that answered it: we held **id, name, artist, set, year, rarity,
price** — and **no type, no stage, no dex number, no subtype.** So every type
theme was a name list I typed out by hand.

**Those lists missed up to 141 Pokemon each and contained up to 12 that do not
belong.**

WHY THEY WERE WRONG, and it is not carelessness: **a Pokemon's TCG card type
frequently differs from its video-game type.** Lugia is Psychic/Flying in the
games and **Colorless** on the card. Scizor is Bug/Steel and **Metal**.
Dragonite is Dragon/Flying and **Colorless**. I built the lists from what a
Pokemon fan knows, and the cards do not use it.

THE FIX: 16,531 cards now carry type, subtype, supertype, HP, evolution, dex
number, weakness and regulation mark. **Every type theme is now a QUERY against
a real field**, and nine regions exist as a filter for the first time because a
dex number makes generation derivable.

THE RULE: **anything that can be a query must be a query.** A list is wrong the
day a set lands — and mine was already wrong on the day I wrote it.

AND THE DUPLICATE GUARD CAUGHT THE CONSEQUENCE: with real types, "Colorless"
sorted by value returns exactly the hand-written "box legendaries" list, because
the dearest Colorless cards ARE the cover legendaries. **Two themes returning
one result is one theme wearing two names.** The hand-written one was removed.

## A GUARD THAT PUSHES NOTHING REPORTS SUCCESS (Aug 23 2026)
I added an HP check to the claim-match guard, ran it, and it said clean. It was
not clean — a shell interpolation had eaten the message string, so the line read
`problems.push()` with **no argument**. The check correctly detected every
mismatch and then pushed nothing.

**A guard that finds the fault and reports success is the worst shape a check
can take**, and it is the second one I have shipped today.

I only caught it by trying to BREAK the check and finding I could not — the
negative-test habit doing exactly what it exists for, one level up from where I
normally apply it.

AND THE MOMENT IT WORKED IT FOUND A REAL BUG: at counts above two the
power-creep shape sampled by step and never included the LAST card, so a title
said "120 → 330 HP" while the final card shown had **280**. Two real numbers on
a public image that did not match the pictures beneath them — the Koga failure
with arithmetic. **The ends ARE the claim**, so the shape now anchors on oldest
and newest and fills the middle between them.

## REPLY-TO-LIKE IS THE CONVERSATION METRIC (Aug 24 2026)
Tyler named two accounts to learn from. Both were researched rather than
guessed at.

**@JohnnyCrambo**, on a post at 37.1K views: **68 replies against 73 likes.** A
reply-to-like ratio of **93%**, where a normal post runs nearer 10%. The post
asked whether caring about value makes someone a fake fan — and he replied to
himself: *"Not my opinion. I want to know what people really think."*

**That disclaimer is the entire mechanism.** Ask something the community
genuinely disagrees on, then remove yourself from the answer, and replying
becomes safe because nobody is contradicting the host.

**Views measure an audience watching. Reply-to-like measures a room talking.**

**@shotguncaio**: long-form lore and artist posts at 15-18K views — an Atsuko
Nishida appreciation, a Miki Kudo appreciation, Victini lore. **Paragraphs, not
hooks**, which is the opposite of the short-form assumption. And a single line
about a current release at **1.6M views**.

THE MOVE WE COULD AUTOMATE, and did: **he replies to every post with the exact
card list.** "Cards above: Victini EX Full Art (131/135 – Plasma Storm)…" Those
self-replies pull 1.7K-2K views of their own. It answers the question every card
post gets, before anyone asks — **and the editor already knows the answer**, so
nobody should ever type it by hand.

ALSO TAKEN: a **numbered daily series** ("Day 23 of posting one Pokémon card I
love under $10") gives people a reason to return, which is what our streak
feature exists for. And Crambo's **named recurring segments** in his bio —
FlashPack Friday, Sun Bleacher — turn an account into a schedule.

## AN UNKNOWN ON THE DEVICE THE AUDIENCE USES IS NOT AN UNKNOWN, IT IS A BUG (Aug 24 2026)
Tyler opened the editor on a phone: **no photos, no moods, no angles.**

**Three symptoms, one cause.** A 4.6MB inline script is where mobile Safari and
Chrome start failing, and when that script dies the moods, the angles AND the
images all vanish together — because JS renders all three.

**I had flagged 4.6MB as my top unknown and handed it over anyway.** That was
the wrong call. Every other test I ran was on a simulated desktop DOM, and X
traffic — the audience this entire tool exists to serve — is overwhelmingly
phones. **An unknown on the one device that matters is a thing to fix before
shipping, not a caveat to mention after.**

TWO FIXES, both structural:
- **ONE TABLE INSTEAD OF FIVE.** ATTRS, BIOS, LORE and CARD_TEXT were separate
  objects keyed by the same card ids, so the ids alone repeated roughly 200KB
  per table. They now live on the index row, with Proxy shims so two dozen call
  sites stayed unchanged.
- **POST-WORTHY CARDS ONLY.** The editor makes posts and nobody posts a Common.
  6,658 cards — every hero rarity plus anything over $8 — carry the whole job
  where 16,468 carried the weight.

**4.6MB → 2.2MB.** Every guard still green.

THE RULE: **test on the device the audience actually holds.** A simulated DOM
proves the logic runs; it says nothing about whether the browser can parse the
file at all.

## A CHECK THAT PASSES WHILE DOING NOTHING (Aug 24 2026)
Building the Catch'em Update generator surfaced two failures of the same family
inside ten minutes.

**First:** I wrote the movers logic against `price` and `prevPrice`. **Neither
field exists** — the schema has `priceUsd` and a `priceHistory` array. The
generator would have reported *"nothing moved"* every single day and **looked
completely correct doing it.** I only caught it because I questioned a clean
result instead of accepting one.

**Second, once it worked:** the first draft read *"151 Ultra Premium Collection
is up 7500% this week."* Sealed product does not move 7500% in a week; it barely
moves 50%. The price history still contains figures from the era when the bot
sorted by price and took the fifty cheapest listings, so a 151 UPC reads as $13
a week ago.

**Structurally valid, contextually absurd** — the exact error class in Tyler's
own profile, the one he catches and machines miss. **It would have been the
account's first post**, on an account whose entire premise is being the reliable
source for this data.

THE FIX: a sanity ceiling at 60%, and the generator **refuses and names the
affected products** rather than filtering them out. A quietly filtered anomaly
hides a broken history that still needs repairing.

AND THE BLOCKER THIS EXPOSED: **the account cannot exist before the bot is
reliable.** The data is 50 hours old, four stages are quiet, and 24 products
carry broken-era history. A news account runs on freshness — publishing a market
update on two-day-old prices is the perishable-claim error on the one surface
whose entire value is being current.

## THREE ENGINES, NOT A RANKING (Aug 24 2026)
Three reference accounts, three different mechanics — and they are not better and
worse versions of one thing.

- **@JohnnyCrambo** — 68 replies against 73 likes, on a divisive question plus
  "not my opinion". **Wants you to ARGUE.**
- **@shotguncaio** — long-form artist and lore posts at 15-18K, card list as a
  self-reply. **Wants you to READ.**
- **@Elite_4_J** — "more pokémon fusion", three words and an image: 402,100
  views, 998 reposts, 72 replies. Reposts beat replies **fourteen to one**.
  **Wants you to SEND IT TO SOMEONE.**

THE ONE THAT ANSWERS THE AUTOMATION QUESTION: **the share engine is the one a
machine can run.** Three words carry no voice, so the image does all the work —
and the image is the half already automated. A share-driven post needs a picture
worth forwarding and a caption that gets out of the way, which is a **generator
problem rather than a writing problem**.

The conversation engine is the one that cannot be automated, because the
disclaimer only works when a person means it.

ALSO CHEAP AND WORTH TAKING: **a named obscure specialty.** "Mawile expert" in a
bio costs nothing and makes an account memorable. It is a positioning move, not
a claim to defend.

## THE NUMBER IS THE HOOK, THE CONSTRAINT IS THE CONTENT (Aug 24 2026)
@shotguncaio's signature format is a numbered daily series: **"Day 90 of
posting one Pokémon card I love that costs under $10."** At 43-44k followers.

**That is our streak feature, and he is on day 90 of it.** We built the
mechanism and never generated the sentence — and **without the number it is a
man posting cards; with it, people come back to see what day it is.**

"Under $10" is what makes it a series. That is our own **FILTER IS THE PRODUCT**
law, confirmed by somebody else's numbers rather than our own reasoning.

WHY THE FOLLOWER COUNT MATTERS: 43-44k is a **reachable target**. Serebii's
million was built over a decade and rests on an archive. This is a person on day
90 of a habit, which is a thing Tyler could start tomorrow.

THE NEGATIVE FINDING, and it is the rarest thing in any of these profiles:
**motivational posts without a Pokémon hook underperform.** That is a direct
instruction not to drift off-topic reaching for engagement — most account
write-ups only report what worked.

WHAT WE TOOK: the day counter now generates "Day N of posting one Illustration
Rare under $3" from the streak filter, and it **only fills an empty label** —
overwriting something Tyler wrote would be the tool competing with him, which is
the one thing it must never do.

## PERMISSION IS THE MECHANIC (Aug 24 2026)
Nine accounts reviewed, and one pattern sits under every high-reply post in the
set: **each adds a second sentence that removes a reason not to answer.**

- **@tall_alan**, ~900 replies at 16k followers: *"What's your favourite
  Pokémon? Remember to pick something quirky."*
- **@JohnnyCrambo**, 68 replies against 73 likes: *"Not my opinion. I want to
  know what people really think."*
- **@shotguncaio**, day 90 and counting: *"one card I love that costs under
  $10."*

Without "pick something quirky", people think theirs is boring and someone
already said Charizard. Without "not my opinion", answering means contradicting
the host. Without "under $10", liking a cheap card feels like admitting
something.

**A question is not finished until it has said why answering is safe.** It is
now a register in the line engine.

## THE ACCOUNTS ARE SMALL (Aug 24 2026)
I had been reading these as big accounts doing big-account things. **They are
not big.** knoyhead 3k, xzuyyu 4.9k, CardGameNomad 9.5k, tall_alan 16k, Crambo
17.6k, shotgun 43k.

**Crambo's 37,100-view post came off 17.6k followers — 2.1x his follower count.**

The metric is reach RELATIVE to size, and on that measure Tyler's 18,800 views
off a two-day-old posting habit is **already in this company**. The ceiling is
not follower count. It is whether a post gives somebody a reason to react.

ONE CAVEAT ON THE SOURCE: the cross-account analysis asserts things about "2026
X algorithm realities" — replies weighted over likes, dwell time, the first
30-60 minutes — without citing them. Some match what we have observed directly
(links suppressing reach, media outperforming text). The rest is **received
wisdom held at COMMUNITY confidence**, not verified, and should be treated as a
hypothesis to test rather than a rule to follow.

## A CANVAS CANNOT BE LONG-PRESSED (Tyler, Aug 24 2026)
"It's not downloading easy. ALWAYS make it easy, always have a copy option. If
the user can't find the image they will never use the app ever again and tell
people bad things."

**The cause was structural, not a broken button.** The output was a `<canvas>`,
and the first thing every phone user does with an image is **hold it and pick
Save Image** — a canvas never shows that menu. So the most natural action on the
device **silently did nothing**, and the tool read as broken.

Meanwhile `a.download` on iOS often OPENS the image rather than saving it,
which looks like a second failure of the same button.

THE FIX: after composing, swap in a **real `<img>`** carrying the same data
URL, so press-and-hold works because it genuinely is an image. Then five ways
out, in order of how people actually behave:

1. **Press and hold** — the phone gesture, now functional
2. **Copy image** — fastest on desktop, straight into the compose box
3. **Share** — the native sheet
4. **Download** — the desktop default, and it now says *"if that opened the
   image instead of saving it, press and hold it"*
5. **Open in a tab** — **the one that cannot fail**, because it is just an image
   at a URL: no download attribute, no clipboard permission, no share API

AND EVERY PATH REPORTS WHAT HAPPENED. **A silent success is indistinguishable
from a silent failure**, and that is precisely what makes somebody abandon a
tool and tell people about it.

TWO BUGS SURFACED WHILE FIXING IT: `dl()` was never on window — ninth
occurrence of a button that renders, clicks and does nothing — and my rebuilt
action row dropped the ids the existing code binds to, which killed the script
and took the **Make the image** button with it.

## A TABLE IS ONLY A SOURCE OF TRUTH IF EVERY READER READS IT (Aug 24 2026)
Tyler: "you broke the 4 across rule."

Right, and it is the **fourth** time a downstream reader has ignored the layout
table. In card-composite, line 212 reads the table correctly for the
server-side measurement — and the BROWSER code eleven lines later computed its
own: *"more than four? three across, otherwise one row."*

So four cards drew as a ROW of four while the table said 2x2, and **every
measurement I reported was of a layout the page never rendered.** The log said
2056x2430 and the canvas drew something else.

THE FOUR OCCURRENCES: the editor recomputed the frame width from the column
count; card-composite read field names I had renamed and printed "undefined x
undefined"; the theme table was computed and ignored; and now this.

THE RULE: **when a value lives in a table, every reader must READ it — never
recompute something that usually agrees.** A recomputation that agrees most of
the time is worse than one that never does, because it only diverges in the
cases nobody tested.

TWO OTHER BUGS FIXED IN THE SAME PAGE, both of which had made it unusable:
- **A regex literal survived into the emitted script** and broke the parse, so
  every button on that page was dead. The markup still rendered, so it looked
  completely fine.
- **The composed image only existed after a button press**, so the thing Tyler
  actually wants to post was never something he could press and hold. It now
  composes on load and shows the finished image at the top.
