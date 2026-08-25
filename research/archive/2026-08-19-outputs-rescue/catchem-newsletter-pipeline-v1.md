# Catch'Em News — Newsletter Pipeline V1 Spec

**Status:** Locked May 14, 2026
**Cadence:** 2x/week (Tuesday + Friday)
**Goal:** Operational reference Tyler can use to draft + ship issues without re-deciding structure every time.

---

## 1. The two issue types

### 🟢 Warm Issue (Tuesday)
**Audience:** Collectors and sealed-product investors
**Tone:** Cultural, observational, story-driven
**Length:** 600-900 words
**Color accent:** Catch'em amber (gold)

**Sections (in order):**

1. **Cold Open** (50-80 words)
   - One paragraph framing the week's collector story
   - Hook → context → "here's why it matters"
   - Voice: observational, not breathless

2. **🔥 Squeeze Watch** (150-200 words)
   - 3 sealed SKUs in Squeeze state
   - For each: SKU name, week's $ volume + WoW%, supply + WoW%, one-sentence flavor
   - Heat scoring is manual until volume tracker ships (~30 min computation per issue)

3. **Set in Focus** (200-300 words)
   - One Pokemon TCG set getting cultural attention this week
   - Chase cards moving, story behind the movement
   - Connection to broader collector culture (lineage, history, archetype)

4. **The Long Hold** (100-150 words)
   - One Stagnation-state SKU worth attention
   - "Accumulation phase" framing — quiet, but watch
   - Counter-balances the Squeeze Watch hype with patience

5. **Closer** (50-80 words)
   - Looking ahead to Friday's Cold Issue
   - Question/teaser to drive open rates
   - Tagline: "Catch'em. Catch Feels."

---

### 🔴 Cold Issue (Friday)
**Audience:** Flippers, graders, market-cycle readers
**Tone:** Data-driven, market commentary, sharper edge
**Length:** 500-800 words
**Color accent:** Cool slate

**Sections (in order):**

1. **The Read** (80-120 words)
   - What the week's market data is saying
   - One-paragraph thesis with confidence calibration ("the data suggests" not "guaranteed to")

2. **❄️ Cooling Off** (150-200 words)
   - 3 sealed SKUs in Capitulation state
   - For each: SKU, $ volume + WoW%, supply + WoW%, "what it means" sentence
   - Counter-cyclical thinking — what's getting cheap might be smart

3. **📈 Distribution Roundup** (100-150 words)
   - 2-3 sealed products in healthy Distribution phase
   - For people who want stable buys, not speculation

4. **Grader's Corner** (150-200 words)
   - PSA 10 population reports, pop-bottlenecks, grading service news
   - Specific card example with current pop count + price spread
   - When relevant: callout on bulk submission grading queue times

5. **Closer** (40-60 words)
   - Tee up Tuesday's Warm Issue
   - One question or signal to watch for over the weekend

---

## 2. Heat scoring integration

### Phase 1 (V1 — manual, ~30 min per issue)

**Tyler's workflow:**
1. Open Catchem-data bot dashboard
2. Pull current week's data: volume + supply for ~30 tracked SKUs
3. Manually compute WoW deltas vs. prior week
4. Assign state per the Wyckoff framework (Squeeze / Distribution / Capitulation / Stagnation)
5. Pick top 3 Squeeze for Warm Issue, top 3 Capitulation for Cold Issue
6. Write the flavor sentences

**Time budget:** 30 min per issue × 2 issues/week = 1 hour/week manual scoring.

### Phase 2 (V1.5 — automated, when volume tracker ships)

- Heat-map page generates state assignments automatically
- Newsletter section pulls top 3 of each state programmatically
- Tyler writes flavor copy only (10 min per issue)
- Frees up 50 min/week for higher-value writing

### Phase 3 (V2 — auto-draft)

- Section templates auto-populate with SKU + data + Catch'em-voice flavor
- Tyler reviews and edits, ships
- Time budget: 15-20 min per issue total

---

## 3. Recurring conventions

### Subject lines

**Warm issue formula:** `Catch'Em News — [evocative 3-5 word phrase]`
- "Catch'Em News — Sunbreon Watches the Door"
- "Catch'Em News — Charizard X is Back"
- "Catch'Em News — The Quiet Hold on Crown Zenith"

**Cold issue formula:** `Catch'Em News — [market-state phrase]`
- "Catch'Em News — Three Sets Entered Markdown"
- "Catch'Em News — Pop Reports Are Lying to You"
- "Catch'Em News — Distribution Phase, Healthy Tape"

**Rule:** No emoji in subject lines. The state emojis (🔥 ❄️ 📈 😴) live in the body, not the inbox.

### Footer

Every issue ends with:
```
Catch'em. Catch Feels.

Catch'Em News — written by Tyler Baker.
Newsletter delivered Tuesdays and Fridays.
Forward to a friend who collects.
[Unsubscribe] | [catchemtcg.com]
```

### Image policy

- Set logos (from pokemontcg.io) — OK, free use
- Card images (from pokemontcg.io) — OK with attribution in alt text
- Generated Catch'em meme cards — OK once art exists
- Real Pokemon Company marketing images — AVOID (IP risk until attorney clears)
- Photos of physical sealed product — OK if Tyler took them or has permission

### Voice rules (locked from earlier work)

- **Observational, not prescriptive.** "Possible breakout imminent" not "buy now."
- **Wyckoff phases for credibility.** Squeeze = Markup phase. Stagnation = Accumulation phase.
- **Collector-native abbreviations.** SWSH, SV, SM — not S&S, S&V, S&M.
- **Slang where it's how collectors talk.** Moonbreon, Zard, Sunbreon, Chonkachu.
- **Hedge predictions.** Use "possible," "likely," "data suggests" — never guarantees.
- **Cite sources for prices.** Catchem-data bot OR PokemonPriceTracker OR Tyler-verified.

---

## 4. Content rules

### What goes in vs. what doesn't

**✅ Goes in:**
- Heat states with WoW% data
- Set cultural context (collector stories, archetype connections)
- Pop reports + grading commentary
- News that affects sealed/singles markets (Pokemon Company announcements, retailer policy changes, scalping incidents)
- Creator intel (Alex/Nostalgianomics, PokeOz, Collectrics theses)
- Specific verified prices

**❌ Stays out:**
- "Buy this now" calls to action
- Affiliate links to retailers (V1 — revisit when monetization starts)
- Unverified price claims
- Speculation about future Pokemon Company roadmap (too uncertain)
- Personal attacks on creators or LGS owners
- Card singles below $50 unless culturally significant

### When data is uncertain

Use confidence hedges:
- ⚠️ "Data still settling on this — early reads suggest..."
- ⚠️ "Volume inferred from listing turnover, not measured directly. Treat as directional."
- ⚠️ "Single-source price citation. Confirm before transacting."

Better to flag uncertainty than ship overclaim.

---

## 5. Automation triggers

### V1 (manual, but rules locked)

| Trigger | Action |
|---|---|
| Sunday 6:00 PM | Bot snapshot of week's data captured |
| Monday 8:00 AM | Heat states assigned (manual) |
| Monday evening | Warm issue drafted |
| Tuesday 7:00 AM | Warm issue ships |
| Thursday evening | Cold issue drafted |
| Friday 7:00 AM | Cold issue ships |

### Send infrastructure

**V1:** Buttondown or Substack. Both handle 2x/week schedule, both free at < 1,000 subscribers, both export-friendly if you migrate later.

**Recommendation:** Buttondown.
- Cleaner editor than Substack
- Better analytics
- Lower friction at low subscriber counts
- Migrate to ConvertKit or Beehiiv at 1,000+ subs if needed

### Waitlist activation

- Current waitlist: Formspree at `formspree.io/f/[REDACTED-FORM-ID]`
- Migration step: Export waitlist → import to Buttondown
- Pre-launch email to waitlist: "Catch'Em News starts shipping [date]. You're in."

---

## 6. Newsletter name — LOCKED: Catch'Em News

**Decision:** Newsletter is named "Catch'Em News" (with capital E in "Em").

**Rationale:**
1. Simpler than "Signals" — universal, no finance-coded baggage
2. "Catch'Em" brand mark does the work; "News" lets it
3. Broader scope: cultural stories, market reads, set previews all fit
4. Better newsletter naming convention (compare: The Hustle, Morning Brew, Stratechery)
5. Closes the Hobbiest naming debate cleanly

**Brand styling:**
- Always capitalize the E: **Catch'Em News** (not "Catch'em News")
- Apostrophe stays
- No subtitle/tagline appended in subject lines

**Migration note:**
- If "Catch'em Signals" appears anywhere in existing artifacts (mockups, drafts, social previews), update to Catch'Em News
- Newsletter 001's masthead needs updating before shipping if it currently says "Signals"

---

## 7. First six issues content plan

Pre-planning the first six issues unblocks shipping. Tyler can fill in heat-score data closer to publish date.

### Issue 001 (Warm) — ALREADY DRAFTED, needs to ship
- Status: Written, not sent
- Action: Send to waitlist this week, with or without bot heat data

### Issue 002 (Cold) — Three Creators One Signal
- Material: Research already done on Alex/Nostalgianomics, PokeOz, Collectrics
- Angle: All three creators converging on a "cooling phase" thesis
- Section spotlight: Grader's Corner on Ascended Heroes pop reports

### Issue 003 (Warm) — Mega Evolution Era Year One
- Cultural anchor: Phantasmal Flames + Ascended Heroes + Perfect Order
- Set in Focus: Ascended Heroes Mega Gengar grail story
- Long Hold: Mega Evolution Base Set (settled distribution phase)

### Issue 004 (Cold) — Markdown Phase, Surging Sparks
- Cooling Off: Surging Sparks ETB ($28 WoW drop per intel)
- Distribution Roundup: 151 Booster Box, Evolving Skies sealed
- Grader's Corner: Sunbreon PSA 10 pop count

### Issue 005 (Warm) — Moonbreon at Five Years
- Cultural anchor: Evolving Skies' 5-year anniversary energy
- Set in Focus: Evolving Skies Eeveelution roster lineage to Prismatic Evolutions
- Long Hold: Lost Origin Giratina V Alt

### Issue 006 (Cold) — Pre-Launch Market Read
- The Read: Where the market sits before Mega Evolution Chaos Rising (May 22 release)
- Cooling Off: Twilight Masquerade, Brilliant Stars ETB
- Grader's Corner: Pop-report changes ahead of new set release

**Buffer rule:** Keep 2 issues drafted ahead at all times. Issue 005-006 drafted by the time 003 ships.

---

## 8. Definition of done

The newsletter pipeline is "shipped" when:

- [ ] Buttondown account created and waitlist migrated
- [ ] Newsletter 001 sent to waitlist
- [ ] Newsletter 002 drafted and queued
- [ ] First six issue topics locked (above)
- [ ] Subject line / footer / image conventions enforced
- [ ] Sunday → Tuesday → Thursday → Friday cadence established
- [ ] Heat scoring workflow proven (even if manual)

After that, V1 newsletter is "running" — every Tuesday + Friday delivers.

---

## 9. Decision log

- **May 14, 2026:** Newsletter pipeline V1 spec locked. 2x/week, two pillars (Warm Tue / Cold Fri), section structure defined, manual heat scoring for V1, Buttondown for send infrastructure, "Catch'Em News" name retained (recommended), first 6 issue topics drafted.
- **Pending:** Tyler decision on Hobbiest rebrand (recommended: kill).
- **Pending:** Buttondown account setup + waitlist migration.
- **Pending:** Newsletter 001 send to waitlist.
