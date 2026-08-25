# Catch'em Status Audit — May 14, 2026

**Purpose:** Honest inventory of all Catch'em functionalities across product surfaces. Not a highlight reel — a real status report with blockers, gaps, and critical path.

**Legend:**
- 🟢 = Working / Shipped
- 🟡 = Built but not deployed
- 🟠 = Designed/specced, not built
- 🔴 = Broken / blocking

---

## 1. Catchem-data Bot (backend foundation)

| Functionality | Status | Notes |
|---|---|---|
| eBay Browse API integration | 🟢 | Already working, pulls active listings |
| Sealed product tracking (general) | 🟢 | Bot runs, returns prices |
| Journey Together Booster Box pricing | 🔴 | **BROKEN — $18 reported, real ~$200+**. Blocks newsletter publication. Fix module exists, not deployed. |
| Per-SKU searchQuery tuning | 🟡 | `generate-queries.js` module built. Not yet run against actual bot data. |
| Price floor/ceiling validation | 🟡 | Added to module. Not deployed. |
| Per-SKU price ceiling overrides (151 PC-ETB etc.) | 🟡 | Module supports it. Not deployed. |
| Daily snapshot infrastructure (for volume tracking) | 🟠 | Specced in detail, no code yet |
| Inferred-sales calculation | 🟠 | Specced, no code |
| Weekly aggregation cron | 🟠 | Specced, no code |
| PC-ETB SKU coverage (28 new SKUs) | 🟡 | JSON file ready. Not added to bot. |
| Validation against real eBay results | 🔴 | **Critical gap. No tests have been run.** |

**Blockers:** Journey Together fix needs to be applied + verified on actual bot. This unblocks newsletter, then everything else.

---

## 2. Catch'em Intelligence (the data product / website)

| Functionality | Status | Notes |
|---|---|---|
| Strategic positioning | 🟢 | Locked: "all-in-one community approach", Catch'em Intelligence framing |
| Domain architecture | 🟢 | Locked: `intelligence.catchemtcg.com` canonical, `app.` reserved for future |
| Curated chase card database | 🟡 | 71 sets, ~800 cards documented in markdown. Not in production database. |
| pokemontcg.io API integration | 🟠 | Specced. Not built. Needs bulk-pull script. |
| Three-tier curation (chases / promos >$2 / trainers >$5) | 🟠 | Architecture decided. Not implemented. |
| Card browsing UI | 🟠 | Not built |
| Sealed Heat-Map (volume tracker) | 🟡 | Full HTML mockup built. Pure design, no real data. |
| Wyckoff phase framework (4 states) | 🟢 | Designed, vocabulary locked |
| Hosting infrastructure | 🟢 | Cloudflare Pages + DNS, domain via Porkbun |
| Auth + database | 🟠 | Not built. Supabase planned. |

**Blockers:** Need pokemontcg.io API bulk pull running before any Intelligence frontend has real data.

---

## 3. Catch'em Signals (newsletter)

| Functionality | Status | Notes |
|---|---|---|
| Newsletter 001 (April 21, 2026 template) | 🟡 | Written, designed, NOT SENT to waitlist |
| 3-pillar structure (Collector/Flipper/Grader) | 🟢 | Locked, color-coded |
| 2x/week cadence decision (Tue + Fri) | 🟢 | Locked. Pillars consolidated to Warm/Cold. |
| "The Hobbiest" rebrand | 🟠 | Naming/spelling undecided |
| Formspree waitlist | 🟢 | Live at `formspree.io/f/[REDACTED-FORM-ID]` |
| Three Creators One Signal issue (Alex+PokeOz+Collectrics) | 🟠 | Research done, not drafted |
| Auto-generated heat scoring (manual for V1) | 🟠 | Spec calls for ~30 min/issue manual computation |
| Sealed price citations | 🔴 | **Blocked by bot bug** — can't cite prices until Journey Together-class bugs fixed |

**Blockers:** Newsletter 001 still hasn't shipped to waitlist. Bot bug blocks any issue that cites sealed prices.

---

## 4. Catch'em App (gameified V2 product)

| Functionality | Status | Notes |
|---|---|---|
| "Feels" pack name | 🟢 | Locked, single name across all pack types |
| Daily pack mockup | 🟢 | Designed at `/outputs/daily-pack-mockup.html` |
| Feels pull ritual UI | 🟢 | Full interactive mockup built |
| Backpack → Binders → Pages → Slots hierarchy | 🟢 | Vocabulary locked, mockup built |
| Trading marketplace UI | 🟢 | Full interactive mockup with dual-handle float slider |
| Condition/float (Score) system | 🟢 | 6-tier spec locked (Gem Mint → Damaged). Voice per tier written. |
| Score visibility (visible by default) | 🟢 | Locked decision |
| Pro tier (Supporter Variants) | 🟢 | Locked: alt-art of existing characters, 2-month cadence |
| Streak system | 🟢 | Designed, multiplier ceiling 1.50x at Day 365 |
| Berry economy (closed marketplace currency) | 🟢 | Spec written |
| Free vs Pro pack limits | 🟢 | 1/day free, 3/day Pro locked |
| Catch'em-original characters/archetypes | 🟡 | 11 meme cards locked. 73 more in pipeline. Cultural authenticity push needed. |
| Catch'em-original season names | 🟠 | Tyler designing names. "[Name TBD]" placeholders. |
| Real card art | 🔴 | None exists. Tyler creating meme art himself. |
| Auth + database | 🟠 | Not built. Supabase planned. |
| Live deployment | 🔴 | `catchem-app` prototype undeployed |

**Blockers:** This whole product is V2 territory. Don't let it distract from Intelligence V1.

---

## 5. Strategic / Business

| Functionality | Status | Notes |
|---|---|---|
| Competitor identification | 🟢 | Collectrics = PRIMARY competitor, intel doc complete |
| X handle strategy (rebrand 20K existing) | 🟢 | Locked decision. 2-week pivot campaign drafted (not executed). |
| Launch timeline (6-10 weeks → late June/early July 2026) | 🟢 | Documented in launch plan |
| Newsletter pipeline spec | 🟢 | 2x/week, Warm/Cold structure |
| Tagline ("Catch'em. Catch Feels.") | 🟢 | Locked |
| IP attorney consult (slang names legal review) | 🔴 | **Not done. Required before V1 launch.** |
| YouTube channel | 🟠 | Doesn't exist yet. Month 2+ build. |
| Cultural specificity for archetypes | 🟡 | Mining underway, 11 of ~84 locked |
| Wyckoff phase positioning | 🟢 | New as of today — "we read the market cycle" |

---

## 6. Documentation / Working Files

| Asset | Status | Notes |
|---|---|---|
| `catchem-knowledge-base.md` | 🟢 | Canonical source of truth |
| `catchem-roadmap.md` | 🟢 | Master roadmap |
| `catchem-curated-chase-list-DRAFT.md` | 🟢 | 71 sets, ~800 cards documented |
| `catchem-sealed-volume-tracker-spec.md` | 🟢 | V2 with daily-snapshot architecture |
| `catchem-generate-queries.js` | 🟢 | Production-ready module |
| `catchem-bot-searchquery-tuning.md` | 🟢 | Reference doc |
| `catchem-pc-etb-skus.js` | 🟢 | 28 PC-ETB SKUs |
| `catchem-sealed-heatmap-mockup.html` | 🟢 | Interactive mockup |
| **Local backup to GitHub** | 🔴 | **Not done.** Files only exist in `/outputs`. |

---

# The Honest Big Picture

## What's actually shipping at V1 launch

**Bare minimum V1 = three things:**

1. **Catch'em Intelligence website** at `intelligence.catchemtcg.com` with the curated chase database browsable (~700-1,000 cards across modern eras)
2. **Newsletter** publishing 2x/week with heat signals (manual scoring at first)
3. **Catchem-data bot** running clean (no Journey Together-class bugs)

Everything else is V1.5 / V2 / future polish.

## The critical path right now

```
1. Fix Journey Together bug (deploy generate-queries.js)
   ↓
2. Validate 5-10 high-value SKUs against eBay
   ↓
3. Add 28 PC-ETB SKUs
   ↓
4. Send Newsletter 001 to existing waitlist
   ↓
5. Build pokemontcg.io bulk-pull script
   ↓
6. Wire chase database into Intelligence frontend
   ↓
7. Soft launch Intelligence to X audience
```

That's the 6-10 week path. Steps 1-2 are this week's work. Everything else cascades from there.

## What I'd flag as concerning

**🔴 Newsletter 001 still hasn't shipped.** It's been built since April 21. That's almost a month sitting in `/outputs`. Even with the bot bug blocking sealed price citations, you could publish an issue WITHOUT sealed prices. Cultural content, set previews, market commentary — all of that works without the bot fix.

**🔴 No GitHub backup.** Three+ weeks of substantial work product lives only in `/outputs`. Files persist within sessions but the risk of losing them grows the longer this goes.

**🔴 IP attorney consult.** Catch'em uses Pokemon slang names, depicts Pokemon-adjacent content commercially. Slang reduces but doesn't eliminate legal risk. This needs to happen before V1 launch, and lead time on getting an attorney appointment is real.

**🟡 Bot fix has been "designed" for two weeks.** We've been productive specifying the fix, but the actual bot is still broken. Until `generate-queries.js` runs against real bot data and Journey Together starts reporting $200+, the fix is theoretical.

**🟡 Scope creep risk.** This session alone we've added: sealed volume tracker, heat-map UI, chart component, expand-discovery UX, time toggles. All good ideas. None of them ship V1.

## What's going well

**🟢 Strategic clarity is high.** Positioning ("all-in-one community"), competitor known (Collectrics), pricing (free at V1), distribution (existing 20K X audience), domain architecture, tagline — all locked. Most startups would kill for this much certainty.

**🟢 Curation work is real and differentiating.** 71 sets × ~10-15 chase cards × cultural context per set is genuinely unique product. Collectrics has data; Catch'em has data + cultural framing. That's a moat.

**🟢 Voice is locked.** Catch'em-voice (collector-native, observational not prescriptive, Wyckoff-as-credibility-layer) is consistent across all the work. That doesn't happen by accident.

**🟢 Specs are buildable.** When we get to building, the specs hand off cleanly. Daily-snapshot architecture, generate-queries module, PC-ETB SKU file — these aren't theoretical, they're production-ready code/docs.

---

# My honest take

You're in better shape than you think on strategy and worse shape than you think on execution. The work happening here is high-quality but it's been heavy on **designing the launch** and light on **doing the launch**.

The next 2-3 sessions should ruthlessly prioritize: **fix the bot, ship the newsletter, back up to GitHub, get the attorney appointment scheduled**. Everything else is noise until those four things are done.

Sustainable velocity over heroic sprints — Tyler's principle. So this isn't "work harder." It's "next time you sit down with 60 minutes on PC, spend 50 of them on the unshipped foundation work, not 50 on a new feature."

---

# Action items by priority

## This week (highest priority)
- [ ] Deploy `generate-queries.js` to Catchem-data bot
- [ ] Run migration on `sv9` (Journey Together) with `--dry-run` first
- [ ] Manually validate generated query against eBay search
- [ ] Confirm Journey Together Booster Box now reports ~$200 not $18
- [ ] Ship Newsletter 001 to waitlist (even without sealed prices if needed)
- [ ] Schedule IP attorney consultation

## Next 2 weeks
- [ ] Validate top 10-15 highest-traffic SKUs against eBay
- [ ] Add 28 PC-ETB SKUs from `catchem-pc-etb-skus.js`
- [ ] Set up `catchem-docs` or `catchem-data/docs/` GitHub repo
- [ ] Commit all `/outputs` files locally + push to GitHub
- [ ] Draft Newsletter 002 (Three Creators One Signal: Alex + PokeOz + Collectrics)
- [ ] Lock "The Hobbiest" naming decision

## Next month
- [ ] Build pokemontcg.io API bulk-pull script
- [ ] Stand up Supabase database
- [ ] Wire chase database into Intelligence frontend
- [ ] 2-week X rebrand campaign (drafted, not executed)
- [ ] Phase 2 of sealed volume tracker (heat-map page MVP)

## Deferred (V2)
- All Catch'em App features (Feels, Backpack, Marketplace, Score)
- Pro tier launch
- Daily pack ritual
- Card art creation
- YouTube channel

---

**Generated:** May 14, 2026
**Next review:** Recommend re-running this audit after Journey Together fix ships and Newsletter 001 publishes — those two events change the landscape significantly.
