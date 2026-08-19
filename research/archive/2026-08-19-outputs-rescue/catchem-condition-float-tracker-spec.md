# Catch'em Condition Float Tracker — Design Spec

> **Purpose:** The complete design for Catch'em's card condition system — floats, tiers, rarity distribution, voice patterns per tier, and phased rollout plan.

> **Status:** v0.1 — 2026-04-22. Design doc. Not a build doc. Build happens in phases (see Section 9).

**Core concept:** Every card instance in Catch'em has a unique float value between 0.0001 and 1.0000 that determines its specific condition within its tier. No card is ever perfectly 0.0000. There's always a better one possible. Inspired by CS:GO skin floats, with Catch'em's own voice and humor system layered on top.

---

## 1. The Six Tiers and Their Float Ranges

Float ranges are CS:GO-inspired but Catch'em-tweaked. The tweaks: Catch'em's ranges are slightly shifted to create more room in the middle tiers (where most pulls land) and tighter windows at the extremes (where chase conditions live).

| Tier | Float Range | % of all pulls | Personality Tagline |
|---|---|---|---|
| **Gem Mint** | 0.0001 – 0.0800 | **<1%** | "I know what I am" — smug, insufferable, performing humility |
| **Near Mint** | 0.0801 – 0.1500 | ~8% | "So close" — haunted by the Gem Mint they almost were |
| **Lightly Played** | 0.1501 – 0.3800 | ~25% | "I'm good" — balanced, content, the grounded middle |
| **Moderately Played** | 0.3801 – 0.4500 | ~35% | "I've been places" — philosophical, has some wisdom |
| **Heavily Played** | 0.4501 – 0.8500 | ~25% | "been LOVED" — proud survivor, stories for days |
| **Damaged** | 0.8501 – 1.0000 | ~6-7% | "seen too much" — emotional heart, specific grief |

**Distribution notes:**
- MP dominates at 35% — most pulls land here. This is intentional. Most real cards are in the middle.
- Gem Mint and Damaged are BOTH rare (chase tiers) — both ends of the spectrum are special
- NM and HP sit at ~25% each — present but not default
- LP and NM get less love than the extremes — they're the "fine" tiers, less narratively interesting

**Top float within a tier:**
- Within each tier, there's a known "top float" — the current best-known float across all users for that specific card
- Someone's Gem Mint at 0.0012 is "the top Gem Mint of the Attic Visitor in the world" until someone pulls lower
- Creates genuine chase dynamics within tiers, not just across them

---

## 2. Float Generation Logic

When a user rips a card, the backend:

1. Determines rarity (common/rare/epic/legendary) based on pack odds
2. Rolls for condition tier using distribution weights above
3. Rolls a specific float within that tier's range using a triangular distribution (weighted toward the middle of the tier, not the edges)
4. Stores the float as an immutable property of that card instance

**Why triangular distribution within tier:**
- A random uniform float would mean Gem Mint 0.0001 is just as likely as 0.0799
- Triangular distribution weights floats toward the middle of their tier's range
- Creates natural rarity pressure toward the edges (low-float Gem Mints and high-float Damaged cards become extra-chase)

**Implementation notes:**
- Floats stored at 4 decimal places (0.0001 precision)
- Floats are immutable — once rolled, they never change
- Each user's instance of a card has its own float (you and I can both own an "Attic Visitor" with different floats)

---

## 3. Top Float Tracking

For each card across all users, Catch'em tracks:

- **Lowest float ever pulled** (best-known for most cards — Gem Mint edge)
- **Highest float ever pulled** (best-known Damaged edge)
- **Current holder** of each extreme
- **Timestamp** of when each record was set

**User-facing features (V3 phase):**
- Each card's detail screen shows: "Best known Gem Mint: 0.0012 (held by @user)"
- Leaderboards per card for top-5 lowest floats
- Notification when you pull a float that beats the current record

**Why this matters:** gives community flex without requiring users to grind rare tiers. Even a Heavily Played can be worth flexing if it's the highest-float HP in existence. Creates value in tiers that would otherwise be ignored.

---

## 4. Float Visibility UI

**Default state:** Float is **visible** on every card (shows tier + decimal, e.g., "Gem Mint · 0.0124"). This enables the marketplace where users can filter listings by float range — a visible float is an economically liquid float.

**Owner controls:**
- Tap card → option to "Hide Float" (toggle) — for users who prefer private presentation
- Hidden floats still exist in the backend but display only as tier (e.g., "Gem Mint" no decimal)
- Can be re-revealed at any time

**Why visible-by-default:**
- **Marketplace liquidity:** buyers filter by float; hidden floats can't be filtered efficiently
- **Community flex:** the float IS the flex; hiding it defeats the social signaling purpose
- **Simpler UX:** users don't have to toggle to see their card's true specimen rank
- **Trust:** in trades and sales, visible floats reduce negotiation asymmetry

**Hidden float use cases (edge cases for privacy):**
- Users who don't want mid-tier floats visible in their public collection
- Competitive traders who don't want to reveal their full inventory specs

**UI placement:**
- Small text near the tier badge: "Gem Mint · 0.0124"
- Tiny eye icon next to float for hide toggle
- Collection view shows floats prominently for sortability

### Marketplace filter integration

Because floats are visible by default, the marketplace (see `/outputs/catchem-marketplace-economy-spec.md`) can offer powerful filter controls that wouldn't work with hidden-by-default floats:

- **Filter by tier** (show only Gem Mint listings of a character)
- **Filter by float range** (show Gem Mints with float ≤ 0.02 — chase specimens only)
- **Sort by float** (ascending for chase buyers, descending for collectors who like HP/DM specimens)
- **Top float indicator** (marketplace surfaces when a listing is a top-N float for that character)
- **Float rank badge** (e.g., "Rank #3 Gem Mint Attic Visitor globally")

Hidden floats can still be listed for sale but lose filterability — creates natural pressure toward revealing for sale. Sellers hiding floats are signaling privacy, not trying to hide poor specimens (since tier is still visible).

---

## 5. The Voice Matrix (the heart of this system)

This is the creative core. Each tier has a default voice pattern. 70% of characters follow default. 30% flip the pattern intentionally.

### Tier 1: Gem Mint (float 0.0001–0.0800)

**Default voice:** *Insufferable smugness disguised as humility.*

Characters at this tier behave like they've been blessed. They're "not like the other cards." They drop mentions of their float. They're performatively modest. The audience can tell they're full of it.

**Speech patterns:**
- Repeated self-affirmation: *"pristine. pristine."*
- Faux-humble brags: *"oh, this? just my natural state."*
- Float name-drops: *"i don't like to talk about it but 0.0089."*
- Fragment smugness: *"perfect. unbothered. moisturized."*

**Art direction additions:**
- Posture: slightly upright, chin raised, one eye half-lidded
- Expression: serene smile with tiny self-satisfied undertone
- Accessory: maybe a tiny protective case, tiny glass dome, small polished surface
- Color: unchanged from base — everything crisp, clean edges

**Flip candidates** (30% break this pattern):
- Sealed Forever (Gem Mint) → *not smug, just lonely* — has never been touched, isolated perfection
- Cardboard Dad (Gem Mint) → *pristine but wistful* — the cards inside are perfect because he never opens them

---

### Tier 2: Near Mint (float 0.0801–0.1500)

**Default voice:** *Haunted by what they almost were.*

Characters here are SO CLOSE to Gem Mint that they can't stop thinking about it. One tiny nick. One microscopic edge wear. They obsess. They calculate the gap between their float and the Gem Mint threshold.

**Speech patterns:**
- Rueful precision: *"0.0801. point 0801. one one-hundredth off."*
- Counterfactual thinking: *"if i had just... if only..."*
- Reassurance-seeking: *"i'm still good though? right?"*
- Acknowledgment of what is: *"near mint is still good. it is."*

**Art direction additions:**
- Posture: slightly tilted head, looking at self with concern
- Expression: small frown + small hopeful smile fighting for dominance
- Accessory: holding a tiny magnifying glass, examining own edge
- Color: identical to Gem Mint but with one tiny visible imperfection (a single off-line)

**Flip candidates:**
- The Lurker Who Reads Everything (Near Mint) → *doesn't care about float, cares about the content* — actually at peace

---

### Tier 3: Lightly Played (float 0.1501–0.3800)

**Default voice:** *Grounded. Content. The healthiest tier.*

Characters here are the functional adults of Catch'em. They've been handled. They're fine with it. They don't obsess about floats. They're not proud, not ashamed. They just ARE. This is the emotional baseline of the set.

**Speech patterns:**
- Present-tense simple: *"good morning. i'm here."*
- Casual contentment: *"yeah. being a card is pretty good."*
- Light self-awareness: *"some wear. whatever. i'm fine."*
- The only tier with full, complete, articulate sentences as default

**Art direction additions:**
- Posture: relaxed, natural
- Expression: genuine small smile, relaxed eyes
- Accessory: none needed — they're not performing
- Color: base art with 1-2 tiny soft wear details

**Flip candidates:**
- The Market Watcher (Lightly Played) → *still anxious despite tier* — can't shake the stress

---

### Tier 4: Moderately Played (float 0.3801–0.4500)

**Default voice:** *Philosophical. Has wisdom. Starting to see the bigger picture.*

Characters here have been through enough to have perspective. They're not tired yet, but they're no longer naive. They drop small insights. They've had feelings about things.

**Speech patterns:**
- Observational: *"i've noticed the light hits different when you're older."*
- Gentle life advice: *"try to remember the good shows."*
- Reminiscence: *"back when i was near mint, i thought i knew."*
- Slightly fragmented philosophy: *"value. floats. none of it. some of it."*

**Art direction additions:**
- Posture: sitting, relaxed, maybe in a small thoughtful pose
- Expression: warm settled eyes, small knowing smile
- Accessory: maybe holding a tiny cup of something, a small book
- Color: visible gentle wear throughout

**Flip candidates:**
- The FOMO Buyer (Moderately Played) → *still hasn't learned* — continues to buy, no wisdom gained

---

### Tier 5: Heavily Played (float 0.4501–0.8500)

**Default voice:** *Proud survivor. Loved too much. Has STORIES.*

Characters here have been LOVED. Not damaged — loved aggressively. They were the favorite. They were the card the kid carried in a pocket for a summer. They're beat up because they were chosen, not forgotten.

**Speech patterns:**
- Loud reminiscence: *"this edge? 2003. school bus. worth it."*
- Run-on story-telling: *"so the kid took me to camp and then it rained and then..."*
- Unashamed of visible wear: *"every mark has a reason."*
- Affectionate toward past owners: *"they loved me so much. they really did."*

**Art direction additions:**
- Posture: confident, a little rumpled, genuine warmth
- Expression: big warm smile with tired happy eyes
- Accessory: visible creases, soft faded colors, faint coffee stain, a tiny bandage
- Color: faded overall with specific worn spots — the wear tells a story

**Flip candidates:**
- The Attic Visitor (Heavily Played) → *not proud, just quietly holding* — wasn't loved aggressively, was misplaced
- The Discord Moderator (Heavily Played) → *worn down by labor, not love*

---

### Tier 6: Damaged (float 0.8501–1.0000) — THE EMOTIONAL HEART

This is the tier that separates Catch'em from every other collector product. Damaged isn't a "bad" condition here. Damaged is where the set carries its real weight.

**Default voice:** Mix of A (genuine dignified sadness) and B (dark humor about destruction). 70/30 split — more genuinely sad than dark-funny, but some characters lean toward dark humor as their specific coping.

Each Damaged character has a **specific story** for why they're damaged. Not aesthetic sadness. Not "I'm just sad :(". Something happened. The sadness is earned and honored.

**Speech patterns for Tier A (genuine sadness, dignified — ~70% of Damaged):**
- Fragmented, quiet: *"still here. tired."*
- Specific grief: *"the basement flooded. i couldn't keep them dry."*
- Earned resignation: *"i've been like this for a long time now."*
- Simple, minimal: *"please be gentle."*
- Some characters barely speak: *"."* or *"..."*

**Speech patterns for Tier B (dark humor, still warm — ~30% of Damaged):**
- Self-aware coping: *"oh we're doing this again."*
- Grim acceptance: *"i've been here before. i'll be here again."*
- Gallows humor: *"every piece of me is held on with tape."*
- Tired wit: *"the float is high. the morale is low."*

**Art direction additions (for all Damaged, regardless of A or B):**
- Posture: slumped, sitting, leaning against something
- Expression: tired eyes, small resigned mouth, might be half-closed eyes
- Accessory: visible significant wear — a tear, a crease, a missing corner, a piece held on with tiny tape, faded to sepia
- Color: muted, desaturated from base
- **Specific damage marker per character** — each Damaged version has a unique visible sign of what happened

**Example Damaged character treatments (mix of A and B):**

| Character | Damage Story | Voice | Tier |
|---|---|---|---|
| **Attic Visitor** | Forgotten for decades | *"no one remembers me now. i am alone in the box."* | A |
| **Cardboard Dad** | The basement flooded | *"the basement flooded. i couldn't keep them dry."* | A |
| **Sticky Boy** | The ice cream melted | *"i couldn't save it. it melted everywhere."* | A |
| **Sealed Forever** | Never got to be opened, now crumbling | *"i was an investment. i was never a friend."* | A |
| **Moonbreon Believer** | Their faith failed them | *"it didn't go higher. i was wrong. i'm still here."* | A |
| **FOMO Buyer** | Addiction logic | *"i don't know how to stop."* | A |
| **The Completionist Snail** | Three cards still missing after all these years | *"close doesn't count. i know now."* | A |
| **The Forum Poster** | Was right about something no one cared about | *"i told them. i was right. it didn't matter."* | B |
| **V-Max Identity Crisis** | Never resolved their form | *"still two people. still neither."* | B |
| **The FOMO Buyer** (variant) | Bankrupt now | *"still buying. always buying. it's a joke."* | B |

**Tone rules for Damaged:**
- **Never aesthetic.** The sadness must come from a specific earned source.
- **Always dignified.** Even the dark-humor ones are held with care by the set.
- **Never decorative.** A Damaged card is a character at their lowest, not a mood board.

**This is what makes Damaged the emotional heart:** the set treats these characters with the same care a good storyteller treats a grieving character. Soft light, specific detail, earned weight.

---

## 6. The Flip System (70/30 split)

70% of characters follow default tier voice patterns. 30% of characters flip the default on at least one tier — creating specific character moments.

### Why flips matter

If every character followed the same default, the system becomes predictable. After a few hours, users could guess any character's voice at any tier. Flips add mystery — some characters DO something unexpected at a specific tier, and that's itself the character moment.

### When a flip is justified

A flip is justified when:
- The character's core identity naturally inverts the default
- The flip adds emotional depth (not just variety)
- The flip reveals something true about the character

A flip is NOT justified when:
- It's just "let's do something different here"
- It breaks the comedic contract without adding meaning

### Flip candidate starter inventory

**Gem Mint flips:**
- **Sealed Forever (GM)** — not smug, just lonely
- **Cardboard Dad (GM)** — pristine as a form of failure

**Near Mint flips:**
- **The Lurker Who Reads Everything (NM)** — at peace with imperfection

**Lightly Played flips:**
- **The Market Watcher (LP)** — still anxious despite tier

**Moderately Played flips:**
- **The FOMO Buyer (MP)** — hasn't learned despite wear
- **The Hype Train (MP)** — still going

**Heavily Played flips:**
- **The Attic Visitor (HP)** — not proud, quietly holding
- **The Discord Moderator (HP)** — worn down by labor, not love

**Damaged flips (the rarest and heaviest):**
- **The Catch'em Believer (Damaged)** — faith tested but not broken
- **The One Who Just Collects (Damaged)** — somehow still content; real peace

---

## 7. Integration with the Existing 84 Character Prompts

The art prompt file at `/outputs/catchem-card-art-prompts.md` describes each character in their **base/default state** — which should be understood as roughly Lightly Played to Moderately Played tier.

When implementing the float system, each character needs art variations per tier:

**Per character, 6 art variations eventually needed:**
- Gem Mint (add pristine/polished/smug markers)
- Near Mint (add "one tiny imperfection" + haunted expression)
- Lightly Played (base prompt, minor soft wear)
- Moderately Played (add philosophical/wise markers)
- Heavily Played (add worn/creased/faded + loud warmth)
- Damaged (add specific damage marker + tired posture + muted color)

**Practical note:** Don't draw/generate 6 variations of every character for V1. Use base art for all tiers at V1. Variations come in V2.

**Prompt variation formula:** Take any base prompt from the existing file, and add a tier modifier block at the end:

```
[existing base prompt]

TIER MODIFIER (Gem Mint):
, pristine condition, crisp edges, flawless color, slightly smug expression with self-satisfied half-lidded eyes, small tiny protective glass dome or case visible, performing humility

TIER MODIFIER (Damaged):
, visible wear and tear, faded desaturated colors, specific damage marker [character-specific], tired expression with half-closed eyes, slumped posture, muted palette throughout
```

---

## 8. Example: Full Tier Treatment for One Character

Showing what the complete system looks like for a single character — **Sticky Boy** (base rarity: common; base prompt in Season 01).

### Gem Mint (float 0.0001–0.0800)
- **Art:** Pristine scoop of ice cream, perfectly round, untouched by melt, small polished cherry on top, serene smile, slightly smug half-lidded eyes
- **Voice:** *"perfectly scooped. never dripped."*
- **Flavor:** *"0.0089. top 3%. but it's fine."*
- **Ability:** *Factory Fresh* — ignore environmental conditions for 3 turns

### Near Mint (float 0.0801–0.1500)
- **Art:** Nearly-pristine ice cream with ONE tiny drip starting on one side, looking at it with concern
- **Voice:** *"one drip. just one. i was so close."*
- **Ability:** *Almost Perfect* — gain +2 Berries for the regret

### Lightly Played (float 0.1501–0.3800) [default/base]
- **Art:** The base prompt — ice cream with one drip trailing, cheerful friendly expression
- **Voice:** *"hi. i'm sticky boy. a little melted. it's fine."*
- **Ability:** *Sticky Situation* — opponent's card gains -5 value this turn

### Moderately Played (float 0.3801–0.4500)
- **Art:** More melty, pooled at bottom, but still cheerful with a slightly wiser expression
- **Voice:** *"i've learned the nature of heat. and time. and ice cream."*
- **Ability:** *Hard-Earned Wisdom* — view opponent's top card

### Heavily Played (float 0.4501–0.8500)
- **Art:** Very melted, mostly puddle with cherry on top, proud big smile, stories to tell
- **Voice:** *"you should have seen the summer of '98. the heat. the joy. i was THERE."*
- **Ability:** *Loved Too Much* — other cards in the Bag gain +1 charm from the story

### Damaged (float 0.8501–1.0000) — Tier A (genuine sadness)
- **Art:** A puddle with a cherry. Almost gone. Small quiet eyes looking at the cherry. The ice cream couldn't be saved.
- **Voice:** *"the ice cream. it melted everywhere. i couldn't save it."*
- **Flavor:** *"the cherry is still here. the rest of me... elsewhere."*
- **Ability:** *What Remains* — this card cannot be destroyed further; it already happened
- **Defense:** *Still Here* — carries the weight of what was lost

---

## 9. Phased Rollout Plan

**Critical:** Do not try to ship the full system at once. It's too much for V1 launch. Build in phases.

### Phase 1 (V1 Launch — weeks 0-2 after app deploys)
- **Ship:** Tier-only condition system. Users rip cards and get a condition tier (one of 6). No floats shown. No variations in art — just a tier badge on the card.
- **Backend:** Each card instance stores a tier. No float field yet.
- **UI:** Card displays tier badge. No decimal numbers.
- **Voice:** Each character has ONE voice at launch (the base voice from existing prompts). Tiers don't shift voice yet.
- **Purpose:** Users get the concept of rarity + condition. System is simple.

### Phase 2 (V2 — roughly 2-4 months after V1 launch)
- **Ship:** Float values added. Cards now show "Gem Mint · Float: 0.0124" when revealed.
- **Backend:** Each card instance now stores float value.
- **UI:** Float reveal toggle added to cards. Hidden by default.
- **Art variations:** Start generating tier-specific art for the most popular cards (top 20-30). Others use base art.
- **Voice variations:** Start writing tier-specific voice lines for top 20-30 characters.
- **Top float tracking:** Backend tracks record floats. UI doesn't surface yet.

### Phase 3 (V3 — roughly 6-12 months after V1 launch)
- **Ship:** Community float features. Leaderboards. Top-float ownership notifications. Float-based trading.
- **Backend:** Leaderboard system, notification system for new record floats.
- **UI:** Per-card detail shows top-5 floats and holders. Trade interface surfaces floats.
- **Art variations:** All 84 characters have all 6 tier variations.
- **Voice variations:** All 84 characters have tier-specific voice lines.
- **Flip characters:** All flip candidates finalized and shipped.

**Don't skip phases.** The system's complexity compounds. Each phase teaches users more mechanics.

---

## 10. Database Schema Implications (for future Supabase build)

When the database gets built (V1 phase), card instances need:

```
card_instance:
  id (UUID)
  user_id (FK)
  character_id (FK to card definitions)
  tier (ENUM: GM, NM, LP, MP, HP, DM)
  float_value (DECIMAL 1,4) — nullable for V1, populated from V2 onwards
  float_revealed (BOOL) — user preference, defaults to false
  pulled_at (TIMESTAMP)
  pulled_from (FK to pack that produced it)

card_top_floats: (V3 phase)
  character_id (FK)
  tier (ENUM)
  lowest_float (DECIMAL)
  highest_float (DECIMAL)
  lowest_holder_user_id (FK)
  highest_holder_user_id (FK)
  last_updated (TIMESTAMP)
```

---

## 11. Things to Revisit After V1 Launch

Questions this doc doesn't answer definitively:

- **Should float ranges be tunable** based on user data?
- **Should tier distribution vary by card rarity?** (legendary cards skew toward Gem Mint more than commons?)
- **How do duplicates work in the Bag?** (3 Sticky Boys at different floats — stack or separate?)
- **Can floats be improved?** (design principle: NO — cards age)
- **What happens in trading?** (do float differences create arbitrage?)
- **Should there be restoration mechanics?** (probably NOT — damaged stays damaged)

Not blocking V1. Research questions for V2/V3 planning.

---

## 12. Why This Is Genuinely Original

**1. It creates chase without inflation.** Most TCG apps add rarity by creating more cards. This creates rarity by making existing cards more interesting. 84 cards × 6 tiers × infinite floats = practically infinite specimens.

**2. It rewards return play.** A user who rips the same pack weekly isn't getting "the same stuff again" — they're getting new specimens with different emotional states and floats.

**3. The voice system is the moat.** Competitors can build float mechanics easily. They cannot build the Catch'em voice. The per-tier emotional character treatment is something only a founder with a real point of view can execute.

**4. Damaged as emotional heart differentiates Catch'em.** Every TCG product treats "damaged" as negative. Catch'em treats it as meaningful. That's a brand position no competitor can ship.

**5. It's 100% legally clean.** Zero Pokemon IP, zero derivative design. Pure mechanics + Catch'em-original voice.

---

## Filed

**Filed by:** Claude
**Date:** 2026-04-22
**Version:** 0.1 — first pass

**Related files:**
- `/outputs/catchem-card-art-prompts.md` — 84 character archetype prompts (base/default tier)
- `/outputs/catchem-card-art-direction.md` — visual style rules
- `/outputs/catchem-seasons-naming-brainstorm.md` — voice foundation + character archetype seeds

**Not yet built:**
- Tier-specific art prompt variations per character (V2 phase)
- Tier-specific voice line collections per character (V2 phase)
- Database schema implementation (V1 phase during Supabase build)
- Float generation code (V2 phase backend work)
