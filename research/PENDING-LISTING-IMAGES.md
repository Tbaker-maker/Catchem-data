# Listing images — the trade layer

Tyler, 2026-08-23: *"Turn it into 'I'm buying this card / sealed product'. You
now don't have to look up a photo of something you like and get a poor quality
item. We offer high quality, format breakdown."*

Strong, and it is the same tool a third time: **creators** make posts,
**collectors** plan binders, **traders** show what they are after. One binder,
three jobs, and the third is the one people do every single day.

---

## THE SPLIT THAT DECIDES WHETHER THIS HELPS OR HARMS

**SEALED — stock imagery is standard practice.** Every sealed box looks
identical. A buyer is not inspecting *that* box, they are buying a SKU. A clean
formatted image is a straight upgrade on a blurry photo of a box on a carpet,
and nobody is misled by it.

**SINGLES — stock imagery is misleading and can get a seller banned.** The whole
question on a single is *condition*. A buyer needs to see **that** card — its
corners, its centering, its surface. Showing pristine stock art for a card you
are selling in NM is misrepresentation, and marketplaces treat it that way.

**So the tool refuses by intent, not by card type:**

| intent | sealed | singles |
|---|---|---|
| **selling** | allowed | **refused, with the reason** |
| **want list** | allowed | allowed |
| **trade list** | allowed | allowed |
| **showcase** | allowed | allowed |

A seller asking for a singles SELL image gets told plainly: *"Buyers need to see
the card you're actually sending. Photograph it — we'll format your photo
instead."* **That is a better product than the one that says yes**, because a
seller who gets a strike from a marketplace on our image never comes back.

---

## WHAT IT PRODUCES
- **Want list**: cards you're hunting, priced, with a total. Post it, hold it up
  at a table, pin it in a Discord.
- **Trade list**: have-column and want-column in one frame.
- **Sealed listing**: product, clean stock image, our net-proceeds figure so a
  seller prices it sensibly rather than guessing.
- **Format breakdown**: which SKUs exist for a set, what each contains, what
  each costs — the thing nobody publishes and everybody asks in Discord.

## WHY IT COMPOUNDS
Every one of these carries the watermark and goes into a channel we do not own —
eBay listings, Discord trade threads, card-show tables. **The free tier markets
us on every trade somebody makes**, and trades happen far more often than posts.

---

## BUILD ORDER
1. **Intent picker** in the editor: selling / want / trade / showcase. Drives the
   refusal and the copy.
2. **Want-list and trade-list frames.** Two columns for trade, one for want, the
   total already exists from the page tally.
3. **Sealed listing frame**, with net proceeds. We already compute eBay and
   TCGplayer fee maths — this surfaces it where a seller is actually deciding.
4. **Format breakdown**, from `pokemon-sets-database.json`. Remember the SKU
   rule: special and mini sets have NO booster boxes, only ETBs, bundles and
   collections. Getting that wrong in a public tool would be the loudest
   possible version of the mistake.

## WHAT TO WATCH
- **Never let a singles sell image out.** It is the one output that can cost a
  user money and us the relationship.
- Sealed net proceeds must carry its fee basis and its date, same as every other
  figure — a seller pricing off a stale number is a wrong number with a cost.
