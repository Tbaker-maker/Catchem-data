# Catch'em — Grok handover, 26 Aug 2026 21:00 PDT

You are picking up **Catch'em** for Tyler Baker (@LongedEth). This file is
what we actually shipped tonight. Older pickups (`PICK-UP-HERE-AUG-26.md`,
`PICK-UP-HERE.md`) are still true on laws and history; **where they disagree
with the live page, the live page wins.** Where they disagree with the
guards, the guards win.

```
git clone https://github.com/Tbaker-maker/Catchem-data.git
# HEAD at handover: 5a8f301 (will move — git log -1)
```

Live editor: https://tbaker-maker.github.io/Catchem-data/research/assets/build.html

Read in this order: `CLAUDE.md` → this file → `catchem-knowledge-base.md` →
the live page. Then run `node scripts/editor-hostile.mjs` and
`node scripts/launch-gauntlet.mjs` before you believe anything.

---

## Truth rules (non-negotiable)

1. **Never assume. Always verify.** Tyler is tired of being told it works
   when it does not. iPhone, Android, PC, Mac — or say you could not.
2. If docs and guards disagree, **guards are right**.
3. If guards and the live page disagree, **the live page is right**.
4. Compare what the log claims against what the file contains.
5. Do not invent cards, artists, or facts. Catalogue or silence.
6. Tyler supplies the sentence. The tool supplies the card and the fact.
7. **Do not put secrets in the repo.** A GitHub PAT was pasted in chat
   earlier this week. Never write it down. If you see one, treat it as
   burned.

---

## What the product is tonight

**Catch'em Creators** — a browser editor that finds real Pokémon cards,
composes a picture, and offers lines derived from those cards. Soft launch.
16,468 cards inlined. Connecting-art groups from `data/connecting-art.json`.

| Surface | File |
|---|---|
| Editor (the product) | `scripts/build-editor.mjs` → `research/assets/build.html` |
| Lines | `scripts/build-lines.mjs` → `scripts/line-engine.js` |
| Relations | `scripts/card-relations.mjs` |
| Hostile tests | `scripts/editor-hostile.mjs` (73 attacks) |
| Viewport gauntlet | `scripts/launch-gauntlet.mjs` (65 checks) |
| Rebuild | `CATCHEM_TODAY=1 node scripts/build-editor.mjs` then copy `research/assets/build.html` if previewing locally |

How many cards: 1, 2, 3, 4 (square), 6 (2×3), 8 (2×4), 9 (3×3). Connecting
art **ignores** that and uses the group's own grid.

Save on iPhone: data URL on the picture + Save to Photos sheet (`navigator.share`).
Find button next to the ask box — iPhone will not fire Enter on an input.

---

## Tonight's session (this chat)

### Posts that taught us

| Post | Result | Lesson |
|---|---|---|
| Beasts, 8:18am — "These are three cards. One painting. Which beast are you keeping?" + **full card frames** | 5,532 views, 169 likes, 23 replies | The format works **once**. Question. Frames. |
| Beach, 1:17pm — 9-up **art crop** with Pokédex bars + waitlist self-reply | 971 views, 19 likes, 0 reposts | Cropped frames don't look like cards. Asserting isn't asking. Ad in the first reply kills the thread. |
| Count skeleton all afternoon | Tyler: "we're using the same line WAY too often" | `two cards / three cards / one painting` is a template. Name the cards. |

Beasts vs beach, same account, same day: **5.7× views**. The picture has to
read as cardboard at phone size. Self-reply is the **map** (names, sets,
which piece did you have) — never the waitlist. Pitch lives in the bio.

### Caption engine (still the weak point)

There is no one algorithm. Four writers, they disagree.

- `lineOptions()` generates notices / asks / divides from the tray.
- `pickCaption()` is what actually fills the box. It used to prefer any
  divide, skip the middle card on a trio, and burn the best line on a
  double `fillLineFromCards`.
- CTA has two frozen sentences.
- `formula-engine.mjs` never reaches the textarea.

**Fixed tonight:** `#label` is a **textarea** (an `<input>` ate newlines, so
"Moltres or Articuno.Which one is the post?" ran together). A 3-card
painting must name **all three**. First-or-last divide is 2-card only.
Boot caption now:

```
Moltres, Zapdos or Articuno?

Keep one.
```

### Search pins that work (verified)

`the fishes` → Carvanha left, Sharpedo right (across, not down).
`the beasts` → Entei, Raikou, Suicune.
`the birds` → Moltres, Zapdos, Articuno (Wizards promo).
`the beach` / `hyogonosuke` / `nine cards one beach` → 9-card HYOGONOSUKE.
`what kimura drew twice` → two Magmars, 25 years.
`ninetales` is **not** nine cards (substring `nine` used to dump a 9-up).

Wiki listed Carvanha/Sharpedo vertical. Printed art is **across**.
`ART_ACROSS` in `build-editor.mjs`. Spiders stay down.

### Bugs found tonight, now closed

- 1–9 count chips did nothing / stuck on 2 — Apple `<select>` + `applyCount`.
- Save on iPhone / Grok iframe — data URL + share sheet.
- Count skeleton hardcoded in `fillLineFromCards`.
- `ninetales` → 9-card dump.
- Connecting lines matched a 2-card **subset** of a 9-card group.
- iPhone SE pager **Last** sat 32px off-screen.
- 3-card caption skipped the middle card.
- Line field was an `<input>`.

Hostile 73 / gauntlet 65 green at `5a8f301`. Not claimed: physical iOS Safari.

---

## Laws added to `catchem-knowledge-base.md` (v1.2.3+)

- **THE COUNT IS NOT THE HOOK** — do not open with "N cards. one painting."
- **THE FINISHER PUTS THE READER IN THE PICTURE** — "you already pulled a
  piece of this and didn't know" beat naming Magikarp.
- **THREE CARDS IS NOT TWO ENDS** — name every card on a 3-up, or don't post.
- Frames on connecting posts for the timeline. Art-only mural reads as a
  cartoon, not a pull.
- First self-reply is the map. Never the waitlist.

---

## What to do next (in order)

1. **Do not ship another count-skeleton post.** Name the cards or the artist.
2. Caption scoring is still shallow. `pickCaption` should prefer connecting
   whole-group lines; Notice cap is still eaten by attack names.
3. CTA / Post Office lines are still two frozen sentences. Tyler is building
   Post Office as a Chrome reply tool — keep it information-friendly, with
   room to shill their own site, not ours in the first reply.
4. NOTICE the watch tower is still unread: `card-bios.json` has 20 fields on
   every card and NOTICE reads almost none of it.
5. Google Docs is **not** connected to this Grok. If Tyler wants a Doc, paste
   this file. Do not pretend a Doc exists.

---

## How Tyler starts a new Grok chat

Drop this in the first message:

> Clone the public repo Tbaker-maker/Catchem-data. github.com is reachable
> from your bash tool. Read GROK-HANDOVER-2026-08-26.md first, then
> CLAUDE.md, then catchem-knowledge-base.md. Guards beat docs. Live page
> beats guards. Never assume — verify on the live editor. We're in bull
> build mode on Catch'em Creators.

Then give him the live URL if the preview is stale:

https://tbaker-maker.github.io/Catchem-data/research/assets/build.html

---

## Do not

- Crop connecting art for a main post. Full card frames.
- Auto-write a finished caption as if it were Tyler's voice.
- Put Magikarp (or any named Pokémon) as the punchline of a mural.
- Reply to our own post with "made by our bot / waitlist in bio."
- Trust a green test that did not assert **which** cards came back.
- Commit secrets, form IDs, or PATs.
