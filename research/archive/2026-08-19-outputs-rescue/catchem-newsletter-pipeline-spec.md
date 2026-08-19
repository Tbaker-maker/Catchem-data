# Catch'em Signals — Data Pipeline Spec

**Purpose:** Document how data flows into each Signals newsletter issue. Who does what, when, from where, with what fail-safes.

**Audience:** Tyler (operator), Claude (AI assistant), future team if one exists.

**Created:** April 23, 2026
**Status:** V1 spec. Revise as operational reality teaches us what actually works.

---

## Cadence reality check

**Aspirational:** Every 3 days. ~10 issues/month.

**Realistic for Tyler's current life:** This is the first thing to be honest about.

| Life factor | Impact |
|---|---|
| 2 jobs (own business M-F + 8-9hr shifts W-F) | ~20-60 min weeknight capacity |
| 2 kids (2yr, 4yr) + postpartum wife | Family comes first, always |
| Weeknights | Short spurts, low-ambition work |
| Weekends | Possibly bigger blocks IF family allows |

**Honest cadence recommendation:**
- **Phase 1 (first 4-8 weeks post-launch):** Weekly cadence. Test the workflow. Build the habit. Signal to subscribers this is consistent.
- **Phase 2 (weeks 8-16):** Move to every 5 days if workflow feels sustainable.
- **Phase 3 (post-16 weeks):** Every 3 days only if you have help or a sustainable rhythm.

**Why:** Missing issues damages subscriber trust more than slower cadence. A promised "every 3 days" that becomes "every 7 sometimes every 14" looks unreliable. A promised "weekly" that becomes "every 5 days" looks like you're over-delivering.

---

## Three pillars — data needs per pillar

### Collector pillar (green)

**Audience emotional state:** excitement, nostalgia, love of the hobby, art appreciation

**Typical story types:**
- New set reveals (art, cards, mechanics)
- Pokemon Center exclusives
- Community reactions to releases
- Historical deep-dives (set anniversaries, card stories)
- Creator partnerships and collaborations
- The "wholesome pull" moments (grandkids, birthday stories, 30-year-old sealed boxes)

**Data sources:**
- **Web search:** Pokemon.com announcements, Pokemon Center new products, community subreddits
- **Catchem-data bot:** NOT primary for this pillar
- **Intel notes:** Creator reactions to new sets, partnership announcements
- **Your own collection:** photos of your pulls are genuine content

**How long to research per issue:** 15-30 min typically

---

### Flipper pillar (gold)

**Audience emotional state:** strategic, opportunistic, data-driven, FOMO-adjacent

**Typical story types:**
- Sealed price movements (ETBs, Booster Boxes, Booster Bundles)
- Market thesis pieces (see Ascended Heroes intel for example)
- Release calendar impact analysis
- Creator-thesis cross-references (Alex says X, PokeOz says Y, data shows Z)
- Historical price patterns that suggest current plays
- Production / supply news (new factory, reprints, shortages)

**Data sources:**
- **Catchem-data bot (PRIMARY):** sealed prices, price history, listing counts
- **Web search:** TCGPlayer, StockX, eBay completed sales, PriceCharting
- **Intel notes:** creator transcripts, community discourse on specific products
- **Release calendar:** Pokemon.com official dates + aftermarket price-tracking

**How long to research per issue:** 30-60 min if bot is working, 60-120 min if manual

**CRITICAL:** This is the pillar most vulnerable to bad data. Never publish a price without cross-checking. "The bot said so" is not sufficient per memory #22.

---

### Grader pillar (purple)

**Audience emotional state:** obsessive, detail-oriented, community-scholarly, sometimes paranoid

**Typical story types:**
- PSA population reports and trends
- BGS Black Label discourse (see memory on gatekeeping debate)
- Centering / surface / corner condition coverage
- Grading company news (turnaround times, pricing changes, scandals)
- Crossover submissions (CGC → PSA → BGS cycle)
- Notable grade-ups or grade-downs
- Fake slab identification / fraud reporting

**Data sources:**
- **Web search:** PSA.com population reports, Beckett news, CGC announcements
- **Catchem-data bot:** eventually for graded-card comps, not primary yet
- **Intel notes:** grading-focused creator content
- **Community discourse:** Reddit, Discord, forum discussions on grading trends

**How long to research per issue:** 20-40 min

---

## What's automated vs manual

### Automated (when working)

- **Catchem-data bot:** pulls sealed prices daily via eBay Browse API, writes JSON to jsDelivr CDN
  - **Currently broken** for booster boxes (Journey Together at $18 — see memory #22)
  - **Currently working** for ETBs, booster bundles, surprise boxes

### Manual (always)

- **Web search:** Claude runs searches when prompted. Does not monitor continuously.
- **Intel capture:** Tyler shares creator transcripts. Claude saves as research notes.
- **Newsletter drafting:** Claude drafts. Tyler edits. Tyler fact-checks numbers.
- **Beehiiv send:** Tyler hits the button. No automation.
- **Social cross-posting:** Tyler handles. No automation.

### Desirable automations (future)

- Price-change alerts (day-over-day >30% = flag for review)
- New set release detection (official announcement → create draft stub)
- Community buzz detection (Reddit/Discord mentions spiking on a card)
- Pop report delta tracking (PSA pop changes significantly)

None of these exist yet. They're roadmap, not blockers.

---

## The newsletter production workflow

### Per-issue workflow (target: 60-90 min total for Tyler, ~30-45 min for Claude)

**Step 1: Research phase (Claude, ~20 min)**
- Web search past 3-7 days of Pokemon TCG news
- Check Catchem-data bot output (if reliable for that pillar)
- Read any new intel notes Tyler has shared
- Identify 3-5 potential stories per pillar
- Flag any stale or uncertain data

**Step 2: Story selection (Tyler + Claude, ~10 min)**
- Claude proposes pillar stories based on research
- Tyler picks the strongest 1-2 per pillar (don't cram)
- Tyler kills anything he doesn't vibe with

**Step 3: Draft (Claude, ~20 min)**
- Claude drafts all three pillars in the Signals voice
- Follows Newsletter 001 template
- Cites sources at the end
- Flags all price numbers for Tyler to verify

**Step 4: Fact-check (Tyler, ~15-20 min)**
- Tyler verifies every price against at least one external source
- Tyler reviews for voice / tone
- Tyler checks for any "cultural tourism" — does it feel like a Pokemon collector wrote this?
- Tyler kills anything that doesn't hit

**Step 5: Edit pass (Tyler, ~15 min)**
- Tyler tightens copy
- Adds personal commentary where appropriate
- Adds any photos from his own collection
- Final polish

**Step 6: Send (Tyler, ~5 min)**
- Copy to Beehiiv
- Schedule or send immediately
- Cross-post announcement to any social channels

**Step 7: Archive (Tyler or Claude, ~5 min)**
- Save final version to /outputs/newsletter-NNN-*.html
- Update Catchem's internal knowledge of what's been published
- Note what worked / what didn't for next issue

**Total: ~90 min per issue**

This is realistic for a weekly cadence on a weekend block. Not realistic for every 3 days unless workflow is streamlined significantly.

---

## Fail-safes

### When the Catchem-data bot is broken (NOW)

**Do:**
- Skip Flipper pillar stories that require sealed prices
- Or: cross-check every bot price against TCGPlayer + eBay completed sales manually
- Or: write the Flipper pillar using qualitative narrative (Alex's thesis, PokeOz analysis) without citing specific prices

**Don't:**
- Cite bot numbers directly until fix ships
- Delay the newsletter because data is imperfect — write around it

### When nothing newsworthy happened in past 3-7 days

**Evergreen fallbacks:**
- "Deep dive" piece on a specific card's history
- Creator spotlight (profile an interesting Pokemon YouTuber)
- Storage tips / protection rotation (PokeOz did a good version)
- "State of the hobby" macro piece
- Reader-submitted pulls / stories
- Tyler's own pulls from his personal collection

### When Tyler has no time to fact-check

**Decision rule:** DON'T SEND.
- A delayed newsletter is a rescheduling problem
- A wrong newsletter is a brand problem
- If fact-check can't happen, push to tomorrow or the day after

### When Claude makes a factual error

**Recovery:**
- Correction in next issue (don't hide)
- Add to memory so it doesn't recur
- Cross-check that source type more aggressively going forward

See "Evolving Skies incident" rule — never happen again.

---

## The knowledge-base connection

Every newsletter updates the knowledge base at `/outputs/catchem-knowledge-base.md`:
- Which issue number we're at
- What stories we've told (avoid repetition)
- What themes are overworked vs underworked
- Reader feedback / replies

This prevents repeating stories and lets future sessions know what's already been covered.

---

## What Tyler actually trusts

This is the most important section.

Claude is a tool. Tyler's judgment is the product.

Trust hierarchy for any data point Claude surfaces:
1. **Tyler's own knowledge** — highest trust, no verification needed
2. **Official Pokemon/TPCi announcements** — high trust, still cross-check
3. **PriceCharting / TCGPlayer completed sales** — high trust for prices
4. **Bulbapedia / PokeBeach / Serebii** — high trust for set info
5. **Catchem-data bot** — high trust WHEN fixed, currently suspect
6. **Creator transcripts (Alex/PokeOz)** — medium trust, always flag as opinion
7. **Reddit/Discord/Twitter** — low trust, useful for sentiment not facts
8. **Claude's web search snippets** — low trust, always verify before citing
9. **Claude's training knowledge** — lowest trust for anything post-cutoff

**The rule:** If Claude can't cite a source from tiers 2-4, don't publish the claim.

---

## One honest meta-note

This pipeline works for V1. It won't scale to 10 issues/month without either:
- Hiring a writer or editor
- Automating the research step further (not there yet)
- Tyler having more hours in the day (not happening)

Plan for weekly cadence. Treat anything faster as a stretch goal once the workflow is proven.

---

## Action items from this doc

- [ ] **Fix Catchem-data bot** (see memory #22) — unblocks Flipper pillar
- [ ] **Commit to a cadence** — pick weekly vs every-5-days vs every-3-days and tell subscribers
- [ ] **Send Newsletter 001** — it's written, hasn't shipped
- [ ] **Establish fact-check routine** — what's Tyler's verification workflow?
- [ ] **Test this pipeline on Newsletter 002** — does the 90-min total hold up in practice?
- [ ] **Schedule IP attorney consult** — per memory #28, before V1 launch of character cards
