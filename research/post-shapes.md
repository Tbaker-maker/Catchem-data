# Post shapes

**A shape is a MECHANIC, not a voice.** "Two cards with an invented story between
them" is a shape. How shotgun writes is not — that is his, it took years, and
copying it produces something hollow that reads as an impression of a person.

We take the first and never the second. Every entry below describes what the
post *does structurally*: what it pairs, whether it asks or asserts, what the
reader is asked to supply.

Referenced by `data/observed-posts.json`. A post that fits none of these is
recorded as `NEW` — that is a finding, not a gap.

---

## PERMISSION
**Adds a second sentence that removes the reason not to answer.**

"What's your favourite Pokémon?" is a question anyone can ignore. "Remember to
pick something quirky" tells them their answer is allowed to be odd, which is
the thing that was stopping them. Observed at ~900 replies on a ~16k-follower
account.

- asks or asserts: **asks**
- reader supplies: an opinion they already hold
- computable: **partly** — we can generate the question from the catalogue; the
  permission sentence is a writing decision

## SET_DOUBT
**Doubts a SET, not a person, and does not answer its own question.**

"Is Team Up actually a good set or does it just have the lovebirds?" Nobody's
taste is on trial, so disagreeing is free. Leaving the question open makes
replying the natural response rather than liking.

- asks or asserts: **asks**
- reader supplies: a defence or a concession about a shared object
- computable: **yes** — `SET_DEPTH` produces the evidence, and states numbers
  without reaching a verdict, because a relation that answers the question
  removes the reason to reply

## ERA_CLAIM
**A short arguable claim about an era, which invites a counter-era.**

"e-Reader era art was peak." The reader's reply is pre-loaded — their own era —
so answering costs no thought. It does not rank, does not explain itself, and is
short enough to disagree with in four words.

- asks or asserts: **asserts**
- reader supplies: a rival era
- computable: **partly** — we can supply the cards; which era is "peak" is taste

## OUTSIDE_REFERENCE
**Connects a card to something real outside the game** — an event, a place, a
piece of art history, a person.

The card is the doorway, not the subject. Its power is that it rewards a reader
who knows the outside thing and teaches one who does not, and neither group
feels talked down to.

- asks or asserts: **asserts**, usually with the claim checkable
- reader supplies: recognition, or a related reference of their own
- computable: **NO — and it is one of the two strongest formats observed.**
  See the note at the bottom of this file.

## NARRATIVE_PAIR
**Two cards with an invented story between them.**

Not a relation the data holds — a story a person sees. The pairing may be
arbitrary; the reading is the product.

- asks or asserts: **asserts**, and invites better readings
- reader supplies: their own reading of the same two images
- computable: **NO** — we can propose pairs; the story is not in the catalogue

## ARTIST_REVISIT
**The same illustrator returning to the same subject, years apart.**

- asks or asserts: **asserts**, from data
- reader supplies: a preference between the two
- computable: **yes** — `artistRevisits()`, and the claim must not outrun what
  the relation measures (see the Kimura trap in house-theses.md)

---

## THE FILTER THAT COST US TWO SHAPES

An earlier review of shotgun's account catalogued cadence and hooks and **missed
both of his highest-performing formats** — the outside reference and the
narrative pair.

The reason is worth more than the omission: **we were looking for what we could
automate.** A shape we could not build did not register as a finding at all. The
filter was never stated, which is why nobody noticed it was running.

So: **record the strongest posts regardless of whether we could build them.**
Computability is a SEPARATE FIELD, never a filter. A shape we cannot automate is
still a shape Tyler can use by hand, and the two we missed are the two most
worth his time.
