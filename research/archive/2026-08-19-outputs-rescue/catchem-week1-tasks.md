# Catch'em Intelligence — Week 1 Tasks

**Goal of Week 1:** Get the data pipeline working so curation can begin in Week 2.
**NOT the goal:** Ship the database. That's Week 2-3.

**Context tags:**
- 📱 = phone-friendly, 5-30 min, can be done between shifts
- 💻 = needs PC + focus, 1-3 hours, weekend blocks or evening blocks
- 🧠 = thinking task (no execution), can be done anywhere
- ⚠️ = blocking — other tasks depend on this finishing first

**Total Week 1 commitment estimate: ~8-12 hours**

---

## Phase 1: Pre-flight (do these first)

### 📱 Audit catchemtcg.com (15 min)
Open your domain on phone. Note:
- Does it load fast?
- What does the landing page currently say?
- Is the Formspree signup working?
- Are there any embarrassing details (typos, broken images, dev placeholders)?

Just observe. No fixing yet.

**Why:** You can't add a CTA to Intelligence if you don't know what the landing page currently looks like.

---

### 📱 Audit current X presence (15 min)
On the @catchemtcg or your-NFT-handle account (whichever you're using for the launch):
- Last 5 posts — what energy do they give?
- Bio reads as "Catch'em" or as previous brand?
- Pinned tweet appropriate for what's coming?
- Following/follower ratio look healthy?

Just observe.

**Why:** Know your launch surface before designing the launch.

---

### 🧠 Decide which X handle is the launch handle (5 min)
Two questions:
1. Is your 20K-follower handle the right launch vehicle, or does Catch'em need a fresh @catchemtcg handle?
2. If using existing handle: does the bio/profile need a refresh first?

The answer affects launch sequencing. NFT-origin audience is great IF they're warm. If they're cold/dormant, fresh launch might convert better.

**Why:** Decide whether you're activating an audience or building one.

---

## Phase 2: Pokemon TCG API setup ⚠️

### 💻 Sign up for pokemontcg.io API key (30 min)
Go to https://dev.pokemontcg.io/, register, get the API key.

The free tier has rate limits — find out exactly what they are. Consider whether you need paid tier (probably not for V1).

**Save the key:** Add to a local `.env` file (NEVER commit). Document where you saved it.

**Why:** Nothing else in this plan works without the API key.

---

### 💻 Test the API with a simple query (30 min)
Use curl, Postman, or a Python/JS script. Just verify:
- Single card lookup works (try Charizard from Base Set: `base1-4`)
- Search by set works
- TCGPlayer prices come through in the response
- Image URLs are valid and load

Don't build anything yet. Just verify the data is there.

**Why:** Catch any API surprises BEFORE building pipelines around it.

---

### ⚠️💻 Write the bulk-pull script (2-3 hours, weekend block)
A Node.js or Python script that:
1. Iterates through all Pokemon TCG sets
2. Pulls every card from each set
3. Filters to cards where `tcgplayer.prices.[any].market > 2`
4. Saves to a structured JSON file or SQLite database

Keep it simple. Don't optimize yet. Just get the data into a local file.

**Expected output:** A JSON file with 2,000-3,000 cards, each containing:
- pokemontcg.io ID
- name, set, rarity, supertype, types
- TCGPlayer price (the highest variant for now)
- Image URL (small + large)
- Set release date

**Why:** This is the foundation. Until you have this file, there's nothing to curate, display, or push.

---

### 🧠 Audit the bulk-pull output (1 hour)
Once the script runs and produces the JSON:
- How many cards came through? (Hopefully 2,000-3,000.)
- Are there any obviously wrong prices? (Cards under $0.10 in there by mistake?)
- Are there gaps? (Whole sets missing?)
- Do image URLs all resolve?
- Are there cards with `null` prices that need to be excluded?

Spot check 20 random cards against TCGPlayer manually. Trust nothing without verification.

**Why:** "Evolving Skies incident" rule. Bad data ships nothing.

---

## Phase 3: Repo setup ⚠️

### 💻 Get catchem-app running locally (1-2 hours)
The existing Vite/React repo at `Tbaker-maker/catchem-app`. First time deploying to your local machine.

Steps:
1. `git clone https://github.com/Tbaker-maker/catchem-app`
2. `npm install`
3. `npm run dev`
4. Verify it loads in browser
5. Note any errors or missing pieces

If it doesn't run cleanly, document what's broken — that's Week 1 vs Week 2 scope question.

**Why:** Can't deploy what doesn't run. First confirm baseline works.

---

### 💻 Decide deployment target (15 min)
Cloudflare Pages is the obvious answer (you're already on Cloudflare DNS). Verify you can connect the GitHub repo to Cloudflare Pages, configure build settings.

Don't deploy yet. Just confirm the wiring works.

**Why:** Surprise deployment failures eat hours. Catch them early.

---

## Phase 4: Schema design 🧠

### 🧠 Design the Catch'em metadata schema (1 hour, can do on phone)
For the curated layer (300 cards at launch), each card needs:

```
{
  pokemontcg_id: "swsh4-25",
  catchem_chase_tier: "grail" | "flagship" | "key" | "notable" | null,
  catchem_character_tier: "S" | "A" | "B" | null,
  catchem_intrinsic_value: 245.50 (or null if not curated),
  catchem_supply_score: 1-10 (or null),
  catchem_demand_score: 1-10 (or null),
  catchem_archetype: "zard tax" (link to meme card) or null,
  catchem_voice: "every set. every time..." or null,
  catchem_last_curated: "2026-04-25"
}
```

This metadata layer is SEPARATE from the pokemontcg.io data. They merge in the frontend.

Decide:
- Where does this metadata live? Same JSON? Separate file? Database row alongside?
- How does Tyler edit it without redeploying? (Future question, Week 2-3.)

**Why:** Schema decisions made on phone now save 5 hours of refactoring later.

---

### 🧠 List the 300 launch-curation candidate cards (1-2 hours, ongoing)
Mental list — write down on phone or Notes app.

Should include:
- All Charizard ex / Charizard V / vintage Charizard cards
- Moonbreon (Umbreon VMAX Alt Art)
- Pikachu Illustrator (the $5M card)
- Base Set holos (Blastoise, Venusaur, Mewtwo, Alakazam, etc.)
- Trophy cards (Trainer Magazine, Tropical Mega Battle, etc.)
- Modern alt arts that drove buzz (Lugia, Giratina V Alt, etc.)
- Pokemon Center exclusives that hit
- Each major set's chase card

You don't need 300 RIGHT NOW. Get to ~50-75. The rest comes during Week 2-3 curation.

**Why:** Curation is faster when you have a list to work through. Plus this list IS the launch content roadmap.

---

## Done with Week 1 when...

- [ ] catchemtcg.com state is documented
- [ ] X handle/profile state is documented
- [ ] Pokemon TCG API key saved and tested
- [ ] Bulk-pull script runs and produces 2,000-3,000 card JSON
- [ ] Data audited — no obvious garbage
- [ ] catchem-app repo runs locally
- [ ] Cloudflare Pages deployment target confirmed
- [ ] Catch'em metadata schema sketched
- [ ] First 50-75 launch-curation candidates listed

**If 5 of these happen in Week 1, you're on track. All 9 = ahead of schedule.**

---

## What Week 2 looks like (preview, don't worry about it yet)

- Build the React UI to display the cards (search, filter, sort, card detail view)
- Hook up to the JSON data
- Begin curation work on the 50-75 candidates from your list
- First commit + Cloudflare Pages deploy to a staging URL
- Iterate visually until it feels like Catch'em (branded, warm, good)

---

## Honest reality check

**If Week 1 stalls for life reasons (kids, work, wife) — that's fine.** Push it to Week 2. The launch slips a week. That's a real-world cost, not a fatal one.

**If the bulk-pull script blocks you for technical reasons — flag me.** I can write the script for you. You don't have to build everything alone.

**If audit reveals catchemtcg.com landing page is rough — don't try to redesign it now.** Schedule that for Week 3-4 polish phase. Week 1 is data, not design.

**If pokemontcg.io API doesn't work as expected — pause.** Don't pivot to a different data source mid-week. Tell me what's wrong, we adjust the plan.
