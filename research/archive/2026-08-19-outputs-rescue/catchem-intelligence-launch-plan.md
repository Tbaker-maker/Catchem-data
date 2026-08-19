# Catch'em Intelligence — Launch Plan

**Created:** April 24, 2026
**Goal:** Ship public-facing database + analysis content. Push to existing 20K X audience. Launch ~4 weeks out.
**Strategic frame:** Memory #30 — "all-in-one community approach for Pokemon collectors. Data is a feature, not the product."

**What we're NOT doing:**
- Competing with Collectrics on pure analytics
- Launching a SaaS analytics tool
- Promising live price tracking we can't deliver yet (bot is buggy per memory #22)
- Hiding behind paywalls — V1 must be free to build trust

---

## URL architecture (LOCKED Apr 23-24)

**Canonical product URL:** `intelligence.catchemtcg.com`
- Where the card database lives
- Where Catch'em Intelligence as a product is branded
- Where deep links from X/newsletter point

**Landing page:** `catchemtcg.com` (root domain, existing landing)
- Marketing/brand intro stays
- Newsletter signup stays
- Adds prominent CTA / nav link → Intelligence
- Visitors hitting root domain are gracefully routed to product

**Reserved for future:** `app.catchemtcg.com`
- Will eventually host the gameified app (Backpack, Trading, Feels, daily pack ritual)
- 4-6 months from now, post-Intelligence launch
- Don't burn this subdomain on Intelligence

**Architecture model:** Stripe-style. Marketing on root, product on subdomain.

---

## Scope (LOCKED Apr 23-24)

- **Filter:** All English Pokemon TCG cards with TCGPlayer market price > $2
- **Estimated card count:** ~2,000-3,000 cards
- **Data source:** pokemontcg.io API (free, includes TCGPlayer pricing baked in)
- **Curation depth at launch:** ~300 cards with full Catch'em metadata (chase tier, character tier, intrinsic value, archetype connection)
- **Coverage statement:** "Every English Pokemon card the market values, with deep analysis on the cards collectors actually chase"
- **Eras covered in curation:** ALL — vintage, neo, ex era, modern

---

## The launch positioning statement

**One-sentence pitch:**
> "Catch'em Intelligence is the home base for Pokemon collectors who want smarter analysis, real community, and tools that help them make better decisions — without losing the joy of collecting."

**The cultural differentiator:**
- Collectrics says: "Here's the data. Decide for yourself."
- Catch'em Intelligence says: "Here's what the data means, why it matters, and what your community is doing about it."

**The community promise:**
- We build for collectors, not investors
- We add tools as the community needs them
- We say things creators won't say (cultural authority)
- We do not chase hype — we anchor in what's true

---

## Week-by-week roadmap

### Week 1 (this week) — Foundation

**Goal:** Get the database UI shippable. Make the website ready to receive 20K X audience.

**Tasks:**
- [ ] **Audit current state:** What's at catchemtcg.com right now? Is the landing page good or does it need a rewrite?
- [ ] **Database UI scope:** Decide minimum viable browseable database. Probably ~50-100 cards to start.
- [ ] **Choose a frontend approach:**
  - Option A: Static HTML/JS site reading from JSON (fastest, no server cost)
  - Option B: Use existing Vite/React `catchem-app` repo, deploy to app.catchemtcg.com
  - Option C: Use Next.js or similar framework (slower to ship, more polish)
- [ ] **Card data quality:** Expand from 20 seed cards to ~100. Each card needs verified data (chase tier, intrinsic value, character tier, art).
- [ ] **Image sourcing:** Card images need to be either licensed, official Pokemon TCG IMG API (free), or original Catch'em art. Don't use copyrighted images carelessly.
- [ ] **Branding pass:** Logo, color palette, typography all consistent. The look = the moat.

**Time required:** ~10-15 hours over the week. Mostly weekend block work.

**Risk:** This week is foundational — if you skip it, the launch fails. No shortcut here.

---

### Week 2 — Content + Polish

**Goal:** Database UI is browseable, branded, and feels like a real product. Write the launch content.

**Tasks:**
- [ ] **Database UI public preview:** Catch'em Intelligence at intelligence.catchemtcg.com or similar subdomain
- [ ] **Search and filter:** users can find cards by name, set, character, rarity
- [ ] **Per-card view:** show name, art, chase tier, intrinsic value, voice/flavor (Catch'em-original)
- [ ] **About page:** explain the valuation methodology (without giving away the formula)
- [ ] **The launch X thread (10-15 tweets)** — drafted, edited, ready
- [ ] **Pinned tweet** — the new Catch'em positioning statement
- [ ] **Newsletter Issue 002 / Hobbiest Issue 001** — drafted, integrated with database insights
- [ ] **First "data drop" content** — top 10 something, ranked something, undervalued list

**Time required:** ~10 hours. Half on shipping, half on content.

---

### Week 3 — Soft Launch

**Goal:** Quietly publish. Test that everything works. Fix what breaks.

**Tasks:**
- [ ] **Soft launch the database** — accessible URL, but not promoted yet
- [ ] **Send Newsletter 001** (the issue that's been sitting unsent) — to existing waitlist only
- [ ] **Test the full subscriber flow** — Formspree → email confirmation → newsletter delivery
- [ ] **Fix anything broken** in the flow (links, mobile, load times)
- [ ] **Soft tweet** — "I've been building something for a while" tone, NOT "BIG LAUNCH"
- [ ] **Get 5-10 trusted people** to review before public launch

**Time required:** ~5 hours. Mostly testing.

---

### Week 4 — Public Push

**Goal:** Hit X with the launch thread. Convert audience to subscribers + database visitors.

**Tasks:**
- [ ] **Launch X thread** — 10-15 tweets, the "Three Creators One Signal" analysis as proof-of-value
- [ ] **Database link in thread** — let people experience the product, not just hear about it
- [ ] **Newsletter CTA** — at the end of thread, sign-up for deeper analysis
- [ ] **Engage replies for 48 hours straight** — this is the trust-building moment
- [ ] **Send Newsletter Issue 002** (Hobbiest #1) — to new subscribers + waitlist
- [ ] **Quote-tweet creator content** with database insights ("here's what Alex/PokeOz/Collectrics are saying, here's our data")

**Time required:** ~15 hours of focused engagement work over 5-7 days.

---

## Content cadence post-launch

### Newsletter (per memory: 2/week, "The Hobbiest" branding TBD)
- Tuesday: Warm issue (Collecting + Sealed)
- Friday: Cold issue (Flipping + Grading)
- Each issue references database insights

### X (the engine — ~5-7 posts/week)
- 1 weekly "data drop" thread (chart, ranking, top-10)
- 2 newsletter promotion tweets per week
- 2-3 cultural posts (memes, hot takes, community engagement)
- 1 founder/build-in-public post weekly

### Database
- Add 10-20 cards per week (sustainable cadence)
- Update intrinsic values monthly
- Add filters/views as community asks

### Future (Month 2+)
- YouTube channel — video version of newsletter analysis
- Community features (Discord, comments, user submissions)
- The Catch'em app (Backpack/Trading/Feels) — the gameified product

---

## The X launch thread structure

**Draft outline:**

1. **Hook tweet:** "I've been quietly building something. Three Pokemon TCG analysts are all pointing at the same signal right now. Here's what it means and what I'm building. 🧵"

2. **The cultural setup:** What you've noticed. Why it matters. Why nobody's framing it correctly.

3. **The three creators converge:** Alex, PokeOz, Collectrics founder. Each takes a paragraph.

4. **What the data shows:** Reference to your database. Specific cards. Specific numbers (verified).

5. **The Catch'em frame:** What this means for the hobbyist. Not just the flipper.

6. **The product introduction:** "I'm building Catch'em Intelligence — the home base for Pokemon collectors. Database, newsletter, community, tools."

7. **What's live now:** Database link, newsletter signup link. Be specific about what's available vs what's coming.

8. **The community ask:** "I'd love your feedback. What tools would help you?"

9. **The pinned-tweet redirect:** "Full deep dive on this in my newsletter — link below."

10. **Final tweet:** Newsletter signup CTA with social proof if available.

---

## Success metrics

**Week 4 (launch week) goals:**
- 200-500 newsletter subscribers (1-2.5% conversion of 20K)
- 1,000-3,000 database visits in launch week
- Top thread: 50K+ impressions, 200+ engagements
- 5-15 quality replies/quote-tweets from creators in the space

**Month 2 goals:**
- 750-1,200 newsletter subscribers
- 30-40% open rate on newsletters
- Daily database visitors averaging 100+
- 1-2 creators publicly mentioning Catch'em without being asked

**Month 3 goals:**
- 1,500-2,500 newsletter subscribers
- First paying customers (Pro tier or marketplace if shipped)
- Creator partnership / interview / cross-promotion
- Catch'em mentioned organically in Discord/Reddit conversations

---

## What NOT to do

**Don't pretend to be bigger than you are.** Your 20K knows you. Don't suddenly post like a startup — post like a builder.

**Don't undercut Collectrics publicly.** He's a real person with a real product. Don't make beef. Just be the better, warmer, more community-driven version.

**Don't push if data is wrong.** If the database has Journey Together at $18 (memory #22) DON'T LAUNCH. Fix the data first. The Evolving Skies incident only takes one screenshot.

**Don't promise what you can't ship.** Don't say "live price tracking" if the bot is buggy. Don't say "marketplace coming soon" if it's 6 months out. Underpromise, overdeliver.

**Don't burn out doing this.** 4 weeks is the realistic timeline. If life gets in the way (kids, wife, work), push the launch. A delayed launch is fine. A burned-out founder is fatal.

**Don't skip Newsletter 001.** Send it during week 3 to the existing waitlist. Don't try to launch with Issue 002 only — it'll feel like there's no history. Even sending 001 now to 47 people creates an archive.

---

## Tyler's actual capacity check

This is the honest question.

**4-week launch timeline assumes:**
- ~10-15 hours/week of Catch'em work
- A mix of weeknight 30-60 min sprints and weekend 4-hour blocks
- Family + work commitments come first
- No unexpected emergencies

**Reality check (from your situation):**
- 2 jobs (own business M-F + 8-9hr shifts W-F)
- 2 kids (2yr, 4yr)
- Wife in postpartum
- Brother recently cancer-free

If 10-15 hours/week is unrealistic, the timeline stretches to 6-8 weeks. That's FINE. **Do not compress this to make the calendar look better.** A delayed launch is professional. A failed launch is a setback.

**Honest question:** Can you commit to 8 hours/week (minimum viable) for the next 4-6 weeks? If yes, we proceed. If no, we plan for an even longer runway.

---

## Action items — Week 1

Highest priority items for your next on-PC session:

1. **Audit catchemtcg.com** — what's there, what works, what needs to change
2. **Decide deployment platform** for the database (Vercel? Cloudflare Pages? Existing setup?)
3. **Database scope** — confirm 50-100 cards is right, or different number
4. **Card data sourcing** — where do images come from, where does verified data come from
5. **Brand audit** — does Catch'em have a consistent visual identity yet?

After you confirm the answers, I'll draft week-1 task breakdown into ~30-min chunks Tyler can do between shifts.
