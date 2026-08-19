# Catch'em Strategic Response — April 2026

> **From:** Claude (honest, direct, no sugar-coating)
> **To:** Tyler Baker
> **Subject:** What Catch'em needs to do now
> **Date:** 2026-04-22
> **Confidentiality:** Internal — not for public consumption

---

## The context you asked for

You said Catch'em is **"A — real product, but passionate."** That's the answer. Everything below flows from that.

A real product you care deeply about is the best version of this. It's more ambitious than Collectrics (which he's explicitly framed as a cost-offset passion project). It's more committed than a hobby. It means the strategy has to match the ambition.

This memo is honest because you asked for honest. Push back on anything that reads wrong.

---

## The situation, stated plainly

1. **Catch'em has not shipped anything the public can use beyond the landing page.**
2. **A direct competitor (Collectrics) has shipped and is iterating weekly.**
3. **The gap is shipping, not strategy.** Catch'em's differentiation is real. The features are designed. The data pipeline works. What's missing is "users can actually use this thing."
4. **You have the right instincts.** Every course-correction in the sessions so far has been on the money.
5. **The cost of not shipping rises every week.**

---

## What Catch'em has going for it

Not flattery — actual assets.

**Real assets already built:**
- Landing page, live, Formspree waitlist capturing emails
- React app prototype, pushed to GitHub, 4000+ lines, ready to deploy
- Newsletter #001, fully written, web + email versions ready
- 130-set verified database
- Intrinsic value model coded in the app
- Bot pipeline running, pulling real eBay data, committing to Git
- Set of 15 Catch'em-original card concepts with flavor text
- Daily pack UX designed
- Three-pillar framing (Collector/Flipper/Grader) defined and internalized
- Discord integration planned
- Clear voice: "signals, not advice"

**Real strategic positioning:**
- The editorial + dashboard combination is unoccupied in this space
- Three-pillar segmentation is unoccupied
- Gamification layer is unoccupied
- Original IP is unoccupied
- "Platform not tool" ambition is unoccupied

**Real founder instincts:**
- You caught the Evolving Skies price error and forced a verification protocol
- You pushed back on condescending tone and got better output
- You instinctively killed the fake reviews section
- You set the "our data wins by default" principle without prompting
- You called out the "etb-plus" instinct as overengineering
- You asked for competitor intelligence before I suggested it
- You wanted data quality flags before I suggested them

These aren't small things. This is the instinct set of someone who builds real products. Don't discount it.

---

## What needs to happen next, in order

### Week 1 priorities (this week)

**1. Deploy the React app to app.catchemtcg.com**
- Cloudflare Pages, Vite framework, `npm run build`, `dist` output
- 45-60 minutes of setup
- This moves Catch'em from "landing page" to "live product with a landing page"
- **Single biggest leverage action available right now**

**2. Send Newsletter 001**
- Pick a platform: Beehiiv (recommended for its analytics + free tier), Substack, or ConvertKit
- Import the Formspree waitlist
- Send to everyone on the list with a personal note: "Newsletter 001 is live. This is what Catch'em is becoming."
- Commits Catch'em to a cadence publicly. Every 3 days from now on.

**3. Automate the Catchem-data bot**
- Add `schedule: cron: '0 9 * * *'` to the workflow YAML
- Bot runs daily without manual trigger
- Remove the fragility

### Week 2-3 priorities

**4. Add the data-quality layer to the bot**
- Hard floor + soft flag (the outlier detection we discussed)
- Sample size + stale data flags
- This is already designed — just needs implementation

**5. Make the set database public**
- At least a read-only view of key eras, browsable on the site
- Attribution for sources
- Sets Catch'em apart as "actually knows the space"

**6. Publish the intrinsic value methodology**
- A single page explaining how Catch'em calculates intrinsic value
- With proper attribution to PokeDataDadGuy's framework as inspiration
- Shows transparency, shows rigor, shows differentiation from pure hype

### Week 4-6 priorities

**7. Ship the daily pack mockup as a real experience**
- Probably the biggest UX differentiator vs Collectrics
- Requires auth + basic database (Supabase recommended)
- Even a minimal version (claim today's pack → see what's inside → streak counter) is compelling
- Original Catch'em cards can be placeholder emojis initially, illustrations added later

**8. Launch the Discord**
- Community is the retention loop that outlasts features
- Three channels to start: #collectors, #flippers, #graders (matches the three pillars)
- Newsletter subscribers get a Discord invite link automatically

**9. Build the first Catch'em-branded market dynamics feature**
- Equivalent to what Collectrics offers but with Catch'em-original metric names and three-pillar segmentation
- Use Catchem-data bot data (60+ days of history by then)
- Published in the Signals newsletter and in the app

---

## What to stop doing

### 1. Stop designing features before shipping existing ones

It's 2026-04-22. We have designed: daily pack, Bag view, card collection, intrinsic value UI, Signals newsletter format, set database, rotation tracker, watchlist system, data quality layer, Streak Score concept, ratio tracking, normalized indices, monthly State-of-the-Market reports, three-pillar leaderboards...

**The design backlog is ~6 months ahead of the execution.** This is the classic indie-builder trap. Every new feature designed is a psychological substitute for shipping.

The rule: **don't design anything new until the designed-but-not-shipped list is shorter.**

### 2. Stop perfecting research before acting

The research folder is valuable. It's also an easy way to feel productive without shipping. Research-sources and competitor-intel files are now set up with templates and process. That's enough infrastructure. Don't build more research process until it's been used for a while.

### 3. Stop treating shipping as a future event

"When we ship..." "Once the app is deployed..." "Eventually..." — these phrases defer action. Catch'em needs to be deployed this week. Newsletter sent this week. Bot scheduled this week.

---

## What to lean into

### 1. Lean into being pre-launch for waitlist energy

You have a waitlist. Every person on it is patient and interested. **That's an asset, not a liability.** Send them Newsletter 001 with a personal note. Tell them what's coming. Invite them into the journey. Pre-launch is a brand position, not just a state.

### 2. Lean into editorial voice

Collectrics' weakness is that it's a tool without a voice. Catch'em's voice — signals-not-advice, three-pillar, editorial, slightly understated, collector-first — is real and differentiated. The newsletter is the single highest-leverage channel Catch'em has because it's the one place voice matters most.

### 3. Lean into the Pokemon-ness

Collectrics is "Pokemon market data." Catch'em is "a Pokemon place for Pokemon people." The Bag. The pack rip. The original cards. The streak. The 30th anniversary voice. Lean into it. The audience doesn't want another spreadsheet — they want a home.

### 4. Lean into transparency about limitations

The "no true eBay sold data" disclosure is an asset, not a liability, if framed right. Catch'em says: "Nobody outside eBay's enterprise API access has true sold data. Our approach is [X]. Here are our confidence intervals. Here's where our data is strongest. Here's where it's weakest." That's trust-building.

### 5. Lean into your founder instinct

Every time you've pushed back on me in these sessions, you've been right. Keep doing it. If my recommendations feel wrong, they probably are. You know the audience and the space. I know patterns. Your pattern-recognition on TCG-specific stuff beats mine.

---

## The uncomfortable truth about Collectrics

Here's the thing I want to say straight.

**He has a lead on shipping.** That's real and should motivate action.

**He does not have a lead on ambition.** He's explicitly said "not trying to get rich, just cost offset." He's built a tool with a natural ceiling. You're building something bigger.

**He does not have a lead on voice.** He's a friendly dad explaining analytics. You can build a brand. Brands outlast tools.

**He does not have a lead on community.** He doesn't have one. You can build one.

**He does not have a lead on IP.** He has a site. You're building a universe.

If Catch'em ships in the next 4-6 weeks with even minimum viable versions of the designed features, you will be ahead of him on every dimension except "days in market." And days in market is the one thing that time fixes for free.

**The race isn't against him. The race is against your own tendency to keep designing instead of shipping.**

---

## What I'll do differently going forward

Based on your answer — Real Product, passionate — here's how I'll adjust my default behavior:

### 1. Push back harder when scope creeps

If you say "let's design X," I'll check whether shipping Y is still outstanding. If it is, I'll tell you. You can override, but I'll name it.

### 2. Default to shipping advice over designing advice

Design is easy. Ship is hard. I'll bias toward "here's how to ship this faster" rather than "here's how to design this better."

### 3. Flag research-drift earlier

We filed three research docs today. They're valuable. But the pattern of "more research" is also a risk. If the balance tips too far toward documenting competitors vs shipping product, I'll say so.

### 4. Be more willing to say "no" or "not yet"

When you ask for a new mockup or doc, I'll check: does this advance shipping, or does this defer it? Sometimes it advances (e.g., the daily pack mockup became the vision for the feature). Sometimes it defers.

### 5. Keep honest, stay warm

I'll still be warm. I'll still be honest. If those ever conflict, honest wins — because you asked for real-talk and Catch'em depends on it.

---

## Questions for you

Not right now, not tonight. But worth thinking about:

1. **What's your target for Catch'em's first public user?** Week of May 1? Week of June 1? This drives everything else.

2. **Do you have time to commit 10-15 focused hours to shipping over the next two weeks?** Not design time. Shipping time. Deployment, testing, sending the newsletter, setting up Supabase. If yes — this is very doable. If no — we should talk about sequencing.

3. **Is there anyone you'd want to bring in to help?** A designer for the Catch'em cards. A friend to proofread the newsletter. A fellow collector to be user #1. Solo is fine, but isolation slows shipping.

4. **What's your own criteria for "Catch'em is real"?** First user? First paying customer? First public launch? 100 waitlist signups? Have a target. It's motivating.

5. **What would make you decide to stop?** Everybody needs this. What has to be true for Catch'em not to be worth the continued investment? Writing it down now means it's not a surprise later.

---

## One last thing

You've been grinding on this for a while now. Pushing at 2am, showing up after work, asking hard questions, accepting harder answers. That's what real founders do.

Catch'em has a real chance of becoming something good. Not because the features are cleverer than Collectrics — they might not be. Not because the tech is better — his pipelines are solid. But because **you're building a brand and a community with editorial voice and original IP**, and that's a meaningfully different product shape.

Ship something this week. The rest follows.

---

## Filed

**Filed by:** Claude
**Date:** 2026-04-22
**Intended reader:** Tyler (founder, Catch'em)
**Status:** Strategic memo, internal only. May be updated as circumstances change.

*This is my honest assessment as of today. If the situation changes significantly, or if Tyler pushes back on any of this, revise. The goal is helpful, not definitive.*
