# Catch'em Card Art — Direction Doc

> **Purpose:** One reference doc for every Catch'em card drawing session. Reduces decision fatigue. Keeps the visual language consistent across 100+ cards and 13 seasons.

> **Status:** v0.1 — 2026-04-22. Living document. Update as the style clarifies in practice.

**Voice (from brainstorm doc):** Soft absurd with anxiety. Little guys trying their best. Earnest weirdness with a cute touch.

**Visual North Star:** Confident simplicity. Every line intentional. Each character is *being* something, not posing.

---

## 0. The one-sentence version

**Bold black outlines. Flat color fills. Colors match the real-world archetype (fire dragon = warm, sea turtle = cool), not a specific Pokemon's palette. Transparent background. Drawn into a roughly 3:4 space. Big heads unless the character says no.**

If you remember nothing else from this doc, remember that sentence.

**The upstream rule:** Go one layer upstream of Pokemon to the source material. Pokemon didn't invent fire dragons; Catch'em doesn't either. You and Pokemon are drawing from the same creature library — independently.

---

## 1. Line work

### Outlines

- **Solid black**, always
- **Medium weight** — at your drawing size, aim for ~2-3 pixels. Should feel like a confident marker, not a pen or a pencil
- **Slightly imperfect** — human hand visible. Not vector-ruler-perfect.
- **Consistent line weight** across the character — no "thick outside, thin inside" rendering
- **No hatching, no crosshatching, no cross-contour lines** — we're not shading with line

### Internal line work

- Used **only** to define key features: eye outline, mouth, limb separation, one or two essential details
- If a detail doesn't change what the character IS, leave it out
- Less is more. If you're adding a fifth internal line, ask: "does this change who they are?"

### What to avoid

- ❌ Wispy/scratchy pencil outlines (too sketchy, too many decisions per line)
- ❌ Hyper-smooth vector outlines (feels corporate, sterile)
- ❌ Variable line weight as decoration (thick here, thin there) — makes 130 characters look inconsistent
- ❌ Decorative border lines around the whole character

---

## 2. Color and fills

### Palette approach

- **Character-appropriate colors.** The palette serves who the character IS and the archetype they're drawn from.
- A fire-creature is warm (oranges, reds, yellows) because fire-creatures have been colored that way across every culture for centuries. A water-creature is cool (blues, teals, soft greys) for the same reason. Ghost-feeling characters are pale/faded/purple. Forest-feeling characters are greens and browns.
- **The framing:** Catch'em characters can draw from the same real-world creatures and archetypes Pokemon itself drew from (dragons, salamanders, sea turtles, ghosts, mice, owls, folklore spirits). Go **upstream** of Pokemon to the source material — Pokemon didn't invent fire dragons or water turtles; they made their versions, Catch'em makes its own.
- **Colors come from the archetype, not from Pokemon specifically.** Real fire dragons in mythology are orange/red/gold — that's the color source, not a Pokemon palette. Real sea turtles are blue/green — that's the source, not Squirtle.

### The upstream test

Before drawing, ask: "What real-world creature or archetype is this character drawn from?" Answers like "fire dragon," "small water turtle," "ghost spirit," "electric mouse," "sleeping giant," "binder with feelings" are good. Answers like "Charizard but anxious" are drift — go one step upstream.

### The non-Pokemon-viewer test

When the character is drawn, imagine someone who has never seen a Pokemon looking at it. Can they tell what the creature is? A fire dragon? A small water turtle? A ghost? If yes → you drew from the archetype. If they'd only recognize it as "that Pokemon but different" → you drew too close to Pokemon specifically.

### Fill rules

- **Flat colors only.** No gradients. No lighting effects. No painted blends.
- **One darker shadow tone allowed per character.** A single slightly-darker fill for belly, underside of limbs, or inside of mouth. Used sparingly. If you're using it on more than 20% of the character, it's too much.
- **Never outline the shadow tone.** It reads as fill, not as drawn rendering.
- **No highlights, no shine.** Unless it's a signature beat for a rare/legendary card (see Section 7).

### Color count per character

- **2-4 colors total** for commons
- **3-5 colors** for rares/epics
- **Up to 6 colors** for legendaries, but only if each color is earning its place
- Transparent background ALWAYS — Catch'em UI provides the background

### Color mood tags (starter reference)

| Mood | Palette direction |
|---|---|
| **Warm** (fire, desert, embarrassed) | Oranges, warm reds, golds, pale yellows |
| **Cool** (water, ice, calm) | Blues, teals, soft cyans, pale greys |
| **Earthy** (ground, rock, grounded) | Browns, tans, muted oranges, warm greys |
| **Fresh** (plant, new, hopeful) | Greens, yellow-greens, soft whites |
| **Spectral** (ghost, uncertain, dream) | Pale purples, faded greys, off-whites |
| **Electric** (energy, anxious, zappy) | Yellows, pale blues, bright whites |
| **Tender** (pink, emotional, shy) | Pinks, soft reds, creams |
| **Dark** (rare, concerning, pointed) | Deep purples, navy, charcoal |

**Don't treat these as rules** — treat as starting points when you're picking colors for a new character.

### When Catch'em UI colors DO apply

The Catch'em brand palette (`--green #36d399`, `--gold #ffb84d`, `--purple #c77dff`, `--blue #64a0ff`, `--red #ef5a5a`, `--berry #ff6b9d`) is for:
- UI elements (buttons, text, indicators)
- Card rarity tier accents (the border glow, the rarity badge)
- **Special editions / holo variants** of cards (see Section 7)
- **NOT** for character body colors by default

---

## 3. Proportions

### Default: big-head chibi

- **Head ~60% of total visual mass** — think Funko Pop, Shin-chan, Adventure Time
- Large, readable silhouette
- Tiny body, tiny limbs
- Emotion lives in the face because the face has room

### When to break the rule

**Character-dependent proportions are encouraged** when the character's identity demands it:

- A **long snake-like** character is long — don't chibi-fy into a blob
- A **very tall trainer persona** can be tall — proportion signals the character
- A **small creature whose whole thing is being tiny** should be very small
- An **object-with-feelings** character (Binder, Nickel, Scanner) takes the object's natural proportions with a face added

### Key principle

**"Big head" is the default. Character is the override.**

If you're drawing a character and chibi proportions feel wrong, trust that. Characters who "want" to be their own shape will tell you. Force-chibi is worse than proportion-diverse.

---

## 4. Face design — where the emotion lives

This is where Catch'em characters earn their voice. A character's face is ~70% of why they work.

### Eyes

**Default style:**
- Two small black dots or simple ovals
- Set close-ish together (cute reads, not wide-eyed manic)
- Slight asymmetry is charming — don't make them mechanically identical

**Eye variants (use to signal emotion):**
- **Simple dots** → gentle, calm, soft
- **Small ovals** → earnest, engaged, slightly anxious
- **Half-closed lids** → tired, melancholic, patient
- **Single raised eyebrow line above eye** → worried, questioning
- **Tiny sparkle/star in eye** → hopeful, wonderstruck (use RARELY)

### Mouths

**Default:**
- Small and minimal
- Often just a dot, a short line, or a tiny curve

**Mouth variants:**
- **Small flat line** → neutral, okay-ish, present
- **Tiny upward curve** → gentle happy
- **Tiny downward curve** → sad, concerned
- **Small circle** → surprise, processing
- **Slightly open small shape** → mid-sentence, mid-thought

### Expression rules

- **Subtle wins.** A 5-pixel difference in mouth curve carries huge emotional weight at this scale
- **One emotion at a time.** Don't try to pack "anxious AND hopeful AND tired" into one face — pick the dominant feeling
- **Tiny asymmetries sell it.** Perfectly symmetrical faces read corporate. One eye slightly bigger, one corner of mouth slightly lower — that's where the "earnest" comes from

### What to avoid

- ❌ Big anime eyes with reflections and highlights
- ❌ Screaming/wide-open expressions (breaks the quiet vibe)
- ❌ Smug expressions (breaks the anxiety vibe)
- ❌ Purely blank expressions (reads as unfinished, not intentional)

---

## 5. The Catch'em tell

Every great character set has a **visual signature** — a tiny detail that appears across characters that makes them feel like one collection. Disney animals always have three-finger hands. Pokemon all have a stark black outline around flat fills. Hello Kitty has the bow.

**Catch'em's tell (proposal, subject to your call):**

### Option A: The tiny sweat drop
- A single small sweat drop somewhere on most characters
- Not always in the same place — on a cheek, on a forehead, on a shoulder, near a paw
- Subtly signals the "anxiety" part of soft-absurd-with-anxiety
- Visible at small sizes (shows up in 80px Bag previews)

### Option B: The little blush
- Two small pink/rose circles on the cheeks
- Universal, warm, makes every character feel alive
- Reads at small sizes

### Option C: The eye shine
- A single tiny white dot in each eye
- Gives every character a specific kind of aliveness
- Already a technique in many chibi styles

### Option D: Asymmetric ear/feature tilt
- Characters always have one feature slightly off-center (ear, eye, antenna)
- Subtle but consistent
- Requires more drawing discipline

**My vote: A (sweat drop) is most on-voice.** It's literally the visual of the anxiety part. Small, visible, easy to draw consistently.

**Tyler picks the final tell later.** Flag this as a decision to make after drawing the first few characters and seeing which detail feels right.

---

## 6. Background and framing

### Background

- **Always transparent.** Characters live on Catch'em UI, not their own backgrounds.
- **No drop shadows baked into the art.** If shadows are needed for UI, they get added in CSS.
- **No painted scenery, no environment.** The character is the entire content of the card art.

### Character positioning

- Character should occupy **~70-80% of the drawing space**
- Small margin of breathing room on all sides
- **No cropping** — entire character visible (feet, tail tip, ears, all visible)
- Centered horizontally; can sit slightly low on the vertical (weight at bottom)

### Aspect ratio

- **3:4 portrait** — same ratio as the art portion of a standard TCG card (2.5" × 3.5" physical card, but the art area specifically is roughly 3:4)
- **Recommended drawing size: 750 × 1000 pixels** (or larger and scaled down)
- Final file export at 750 × 1000 for app use; keep higher-res source files for potential print

---

## 7. Rarity tier visual differences

Catch'em rarities are: common, rare, epic, legendary. (Plus sealed packs, but those are pack art, not character art.)

### How art signals rarity

**The art itself should NOT change dramatically by rarity.** A common and a legendary character have the same drawing style, same line weight, same simplicity. What changes is **the card frame around the art** (which Catch'em designs separately — see future frame direction doc).

**BUT:** rarity tiers can earn small art details:

- **Common:** No extras. Just the character, clean.
- **Rare:** Maybe a small environmental element (tiny sparkle, one small prop the character is holding). Not required.
- **Epic:** A slightly more specific character moment — they're *doing* something small. Prop, posture, gesture.
- **Legendary:** Can break a rule. Can use the Catch'em UI palette for body color (holo-style). Can have a signature background element baked in. Gets more visual real estate.

### Special editions

Not every card needs a special edition, but when they exist:
- **Holo variant:** Same character, but body fills use Catch'em UI gradient colors (green-gold-purple conic) instead of natural colors. Rare drop.
- **Monochrome variant:** Same character, all one tonal color family. For specific story moments.
- **Special edition rule:** Base version of the character must be drawn first. Variants are recolors of the base art, not redrawn characters.

---

## 8. File and export spec

### Drawing

- Source file: any format you draw in (PSD, Procreate file, SVG, etc.)
- Keep source files — you'll revisit for variants

### Export for app

- **Format:** PNG with transparency
- **Dimensions:** 750 × 1000 pixels (3:4 portrait)
- **File naming:** `{season_number}-{card_slug}.png`
  - Example: `s01-the-attic-visitor.png`
  - Example: `s08-the-moonbreon-believer.png`
- **File location when ready:** `/assets/cards/` (path will be established when backend is built)

### Database linkage

When art is ready, the `catchem-cards-database.json` entry for that card gets:
```json
"art": {
  "url": "/assets/cards/s01-the-attic-visitor.png",
  "artist": "Tyler Baker",
  "created": "2026-XX-XX",
  "variants": []
}
```

This field doesn't exist on cards yet — will be added to the database schema when art starts shipping.

---

## 9. Drawing workflow suggestion

When you sit down to draw a card:

1. **Read the archetype seed** from `/outputs/catchem-seasons-naming-brainstorm.md`
2. **Identify the source creature/archetype** — not "Charizard-inspired" but "fire dragon," not "Squirtle-inspired" but "small water turtle." Go upstream.
3. **Read this doc's section 0 (the one-sentence version)**
4. **Draw from memory of the archetype, not from a Pokemon reference image.** Looking at a Pokemon while you draw is how drift happens. Think of the creature, not the Pokemon.
5. **Sketch the silhouette first** — does it read as the archetype (fire dragon, sea turtle, ghost)? Does it read at small size? If not, re-shape.
6. **Add the eyes/mouth** before anything else. Nail the expression before details.
7. **Add 1-2 defining features** that make them THEM (a hat, a prop, a specific body part)
8. **Add the Catch'em tell** (sweat drop or whatever you settle on)
9. **Color flat using archetype-appropriate colors** (warm for fire-creature, cool for water-creature, etc.) — draw from real-world creature coloring, not specific Pokemon coloring
10. **Add the one shadow tone if needed**
11. **Export at spec, save source**

### The quick sanity check before you export

Ask yourself: "If someone never-heard-of-Pokemon saw this, would they know what it is?" 
- Yes → good, you drew from the archetype
- Only if they knew Pokemon → go back, drift happened

Estimated time per card at scale (once you have the style down): **20-45 minutes.**
First 5-10 cards will take longer while you're locking in the style. That's normal.

---

## 10. Voice-to-visual translation

If a character's archetype description says "quietly worried," their art should:
- Have small downward-curved mouth or flat mouth
- Eyes that look at the ground or to the side
- Shoulders hunched slightly
- Sweat drop present

If the archetype says "earnestly hopeful," their art should:
- Small upward-curved mouth
- Eyes forward, maybe tiny sparkle
- Upright posture
- Possibly hands clasped or held in front

If the archetype says "melancholic and tired":
- Half-closed eyes
- Flat or faintly downward mouth
- Body slightly slumped or sitting
- Sweat drop optional

**The voice doc is your writer, this doc is your director, your hand is the actor.**

---

## 11. Quality bar / when a card is done

A Catch'em card is ready to ship when:

- [ ] You could recognize the character at 80px (Bag preview size)
- [ ] The silhouette is distinct from other characters you've drawn
- [ ] The face communicates ONE emotion clearly
- [ ] The color choices serve the character, not the brand by default
- [ ] The Catch'em tell is present
- [ ] No extra lines that don't change who they are
- [ ] Transparent background verified
- [ ] Exported at correct dimensions and naming

If any of those fail, it's not ready. Iterate on that one dimension. Don't try to "fix everything" — fix the one thing that's breaking.

---

## 12. Art volume reality check

**13 seasons × 10 cards/season = 130 cards.**

At 30 minutes per card once the style is locked: **65 hours of drawing time.**
At 45 minutes per card: **~97 hours.**

This is a real commitment, not a side thing. Some honest options if the volume becomes a problem:

- **Draw Season 01 yourself** (sets the style canon). ~5-10 hours.
- **Commission an illustrator** who can match your style for Seasons 02-13. You art-direct.
- **Community art submissions** once Catch'em has a Discord — users submit in your style, you curate.
- **Draw only for rarities you care about** — maybe the commons get simpler placeholder art, rares and above get the hand-drawn treatment.

**Flag to future Tyler:** revisit this section when Season 01 is done and you know how much time it took. Make the volume plan from data, not guessing.

---

## 13. What this doc is NOT

- ❌ Not a list of rules that can't be broken. You're the artist. If something feels wrong, trust your eye.
- ❌ Not a substitute for actually drawing and iterating. The style will refine itself in practice.
- ❌ Not final. Update this doc as you learn what works.

---

## Filed

**Filed by:** Claude
**Date:** 2026-04-22
**Version:** 0.1 — first pass. Will iterate after Season 01 is drawn.

*Pair this doc with: `/outputs/catchem-seasons-naming-brainstorm.md` (voice + character archetype seeds)*
