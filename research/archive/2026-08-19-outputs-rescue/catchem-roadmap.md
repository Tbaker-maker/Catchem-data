# Catch'em Master Roadmap

**Snapshot date:** April 23-24, 2026
**Purpose:** One document showing where everything stands. Update at end of each session.

---

## 🎯 Strategic positioning (LOCKED)

**One-line pitch:**
> "Catch'em Intelligence is the home base for Pokemon collectors who want smarter analysis, real community, and tools that help them make better decisions — without losing the joy of collecting."

**Differentiator from Collectrics:** All-in-one community approach. Data is a feature, not the product. Voice/culture/community is the moat.

**Audience priority:** Hobbyist collectors. Not pure investors. Not pure flippers. The people who collect AND want to be smart about it.

---

## 🏗️ Brand architecture

```
catchemtcg.com (LANDING — exists, needs CTA refresh)
  │
  ├── intelligence.catchemtcg.com  ← LAUNCHING NEXT (Week 6-10)
  │     The card database product
  │     ~2,000-3,000 cards >$2 from pokemontcg.io
  │     ~300 with full Catch'em curation at launch
  │
  ├── (newsletter — Beehiiv-hosted, "The Hobbiest" / Signals branding TBD)
  │     2x/week cadence (Tuesday + Friday)
  │     Warm issue (Collecting + Sealed) + Cold issue (Flipping + Grading)
  │
  └── app.catchemtcg.com  ← FUTURE (4-6 months out)
        The gameified app — Backpack, Trading, Feels, daily pack ritual
        Reserved subdomain, do not burn on Intelligence
```

---

## 📊 Product status board

| Product | Status | Next milestone |
|---|---|---|
| **Newsletter (Catch'em Signals / Hobbiest)** | Issue 001 written, never sent | Send 001, ship 002 with Three Creators One Signal piece |
| **Card database (Intelligence)** | JSON file exists, 20 seed cards | Build pipeline + UI, public launch in 6-10 weeks |
| **Catchem-data bot** | Working for ETBs/bundles, BROKEN for booster boxes | Fix per memory #22 — Tyler shares scripts next PC session |
| **Daily pack app (Feels/Backpack/Trading)** | Mockups only, unshipped | After Intelligence launches and stabilizes |
| **Marketplace** | Mockup only | Year 2 feature, design post-V1 launch |
| **X account** | 20K followers (NFT-origin, Pokemon-migrated). Engagement: 600-1,000+ views, 30-100+ likes per post AFTER A YEAR OF INACTIVITY. 3-10%+ engagement rate — significantly higher than typical accounts. Audience is genuinely engaged, not dormant. | LOCKED: rebrand existing handle (Option 2), 2-week pivot campaign before launch. Draft campaign on PC. |
| **YouTube channel** | Doesn't exist | Build Month 2+ |

---

## 🔒 Locked decisions (DO NOT REOPEN)

### Vocabulary
- "Score" = decimal condition value (not "aura")
- "Backpack" = collection home (not "bag")
- "Feels" = pack name (single name for Free + Pro tiers)
- Slang Pokemon names by default (Zard, Moonbreon, Pika, Gary, Twoey, Big D)

### Voice / brand
- Lowercase, vulnerable, self-aware-unhinged
- Specifics everywhere over abstract observations
- Meme card format (~20 words max), NOT character monologues
- All characters must relate to Pokemon (per HARD RULE)
- NFT/crypto/AI archetypes = NO (rejected, do not reopen)

### Strategy
- Sustainability over velocity (Tyler's life: 2 jobs, 2 kids, postpartum wife)
- Path A "real product, passionate" mode
- 80/20 push: database / newsletter
- "All-in-one community" positioning vs Collectrics' pure data
- Catch'em prices win by default (when bot fixed)

### Product specs
- Database scope: cards >$2, ~2,000-3,000 total
- Curation depth at launch: ~300 cards
- All eras covered in curation (vintage, neo, ex, modern)
- pokemontcg.io API for data + images (free)
- intelligence.catchemtcg.com for canonical URL
- Newsletter cadence: 2/week (Tuesday + Friday)
- Pillar structure: Warm (Collecting+Sealed) / Cold (Flipping+Grading)

---

## 📁 Files (what exists where)

### Current/Active
- `/outputs/catchem-knowledge-base.md` — canonical session reference (21KB)
- `/outputs/catchem-intelligence-launch-plan.md` — 4-10 week launch roadmap (THE planning doc)
- `/outputs/catchem-week1-tasks.md` — actionable Week 1 tasks (just shipped)
- `/outputs/catchem-newsletter-pipeline-spec.md` — newsletter data flow + workflow
- `/outputs/catchem-meme-cards-locked.md` — 11 Tyler-approved meme cards

### Intel notes (creator transcripts)
- `/outputs/catchem-intel-ascended-heroes-apr23.md` — Alex/Nostalgianomics thesis
- `/outputs/catchem-intel-pokeoz-apr23.md` — PokeOz thesis
- `/outputs/catchem-intel-collectrics-apr23.md` — Collectrics founder (most strategic)

### Specs (reference for future work)
- `/outputs/catchem-condition-float-tracker-spec.md` — Score/condition system
- `/outputs/catchem-marketplace-economy-spec.md` — Marketplace + Feels economy (V2)
- `/outputs/catchem-cultural-mining-categories.md` — Archetype source material (10 categories)

### Mockups (HTML, browseable in browser)
- `/outputs/feels-pull-ritual-v1.html`
- `/outputs/catchem-marketplace-ui-v1.html`
- `/outputs/catchem-bag-binder-v1.html`
- `/outputs/daily-pack-mockup.html`
- `/outputs/catchem-landing.html`
- `/outputs/bot-dashboard-mockup.html`

### Newsletter
- `/outputs/newsletter-001-web.html` — Issue 001 web version (unshipped)
- `/outputs/newsletter-001-email.html` — Issue 001 email version (unshipped)

### Databases
- `/outputs/pokemon-sets-database.json` — 130 sets, 10 eras
- `/outputs/catchem-cards-database.json` — schema + 20 seed cards

### Tests/Drafts (lower priority, may delete)
- `/outputs/catchem-archetypes-v5-test.md` — superseded by V6 meme card format
- `/outputs/catchem-card-art-prompts.md` — 84 generic archetypes (need cultural rewrite)
- `/outputs/catchem-card-art-direction.md`
- `/outputs/catchem-research-brief-apr21.md`
- `/outputs/catchem-strategic-response.md`
- `/outputs/catchem-seasons-naming-brainstorm.md`

⚠️ **REMINDER:** Tyler should download all `/outputs` files when on PC. They're reproducible from transcripts but not persistent across sessions.

---

## ⏱️ Timeline (realistic)

```
NOW (April 23-24, 2026)
│
├── Week 1: Data pipeline foundation
│   - API setup, bulk pull, data audit, repo setup
│
├── Weeks 2-3: UI build + curation start
│   - React UI for browsing, search, filter
│   - Begin curating 50-75 priority cards
│
├── Weeks 4-5: Curation + polish
│   - Reach ~300 curated cards
│   - Brand pass, design polish
│   - Soft launch to small audience for feedback
│
├── Week 6: Launch prep
│   - X launch thread drafted
│   - Newsletter Issue 002 ("Three Creators One Signal")
│   - Pinned tweet, profile updates
│   - Final QA on database
│
├── Week 7-8: PUBLIC LAUNCH
│   - X thread drops
│   - Convert 20K audience to subscribers + database visitors
│   - Send Issue 001 + Issue 002
│   - Engage replies, build momentum
│
├── Weeks 9-12: Sustained momentum
│   - Newsletter 2/week locked in
│   - Database additions weekly
│   - First creator partnership / cross-promotion attempts
│   - YouTube channel decision
│
└── Months 4-6: Phase 2
    - Catchem-data bot rebuild and integration
    - Marketplace design begins
    - app.catchemtcg.com gameified product begins
```

**Honest target launch window: Late June / Early July 2026.**

---

## 🚨 Active blockers / risks

| Item | Risk level | Action |
|---|---|---|
| Catchem-data bot booster box bug | High (blocks newsletter) | Tyler shares code next PC session, fix before publishing prices |
| pokemontcg.io API works as expected | Medium | Test in Week 1 before building around it |
| catchem-app repo runs locally | Medium | First-time test in Week 1 |
| Tyler's capacity (life > Catch'em) | Always | Push timeline if life requires; never push heroic sprints |
| IP attorney consult | Medium (pre-launch) | Schedule before V1 ships, especially given Pokemon character usage |
| Files persist across sessions | Low (now mitigated) | Tyler downloads on PC, commits to GitHub repo |

---

## 📈 Success metrics (target)

### Launch week (Week 7-8)
- 200-500 newsletter subscribers (1-2.5% of 20K)
- 1,000-3,000 database visits
- Top X thread: 50K+ impressions, 200+ engagements
- 5-15 quality replies/quote-tweets from creators

### Month 2
- 750-1,200 subscribers
- 30-40% open rate on newsletters
- Daily database visitors averaging 100+
- 1-2 creators publicly mentioning Catch'em organically

### Month 3
- 1,500-2,500 subscribers
- First paying customers (Pro tier or marketplace if shipped)
- Creator partnership / interview / cross-promotion
- Catch'em mentioned organically in Discord/Reddit

---

## 🎲 Open decisions (still to make)

These are NOT blockers but worth resolving when there's time:

1. **Newsletter naming:** "Catch'em Signals" vs "The Hobbiest" vs hybrid — currently using Signals
2. **YouTube launch:** When (Month 2? Month 3?), what format, what frequency
3. **Pro tier pricing:** Designed in spec, not yet locked at $X/month
4. **Marketplace fee structure:** Designed in spec, percentages TBD
5. **Catch'em-original season names:** Designing in progress, [Name TBD] placeholders for now
6. **The 84 archetypes full rewrite:** Multi-session project, voice is locked, execution waits
7. **Logo/visual identity refresh:** When Brand Phase 1 happens (Weeks 4-5)
8. **Discord/community space:** Build now, build later, or never

---

## 🧠 Working principles (reminder)

- Sustainability > velocity
- Catch'em data is authoritative when verified
- Every claim about prices needs verification (Evolving Skies incident rule)
- Files are reproducible, not permanent — back up to GitHub
- Don't build something new until designed-but-unshipped list shrinks
- Memory limits exist — durable decisions go in files, working rules go in memory
- Real product. Passionate. Path A.

---

## Last session takeaways

**April 23-24 session highlights:**
- Captured Collectrics founder video (highest-value strategic intel of project)
- Locked meme card format with 11 Tyler-approved cards
- Locked database scope, URL architecture, push strategy
- Built newsletter pipeline spec + Intelligence launch plan
- Identified bot bug (booster boxes) as critical newsletter blocker
- Confirmed: 20K X audience is the launch vehicle

**Most important thing to come back to next session:**
Bot fix (when Tyler is on PC and can share code). Everything else can proceed in parallel; the bot fix is the only thing that unblocks newsletter publication with sealed prices.
