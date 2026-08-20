# THE PROFESSOR — AI help navigator (Tyler, Aug 20)
DOCTRINE: assume people will need help using every tool we ship.
The Professor is the living version of the Sandbox Rule — ask anything,
get a simple-first answer, always in house voice. (Name: generic
"Professor" — culture-native, zero TPCi character names.)

## V0 SCOPE (Discord cog, post-Sunday session)
`/ask <question>` anywhere + a #ask-the-professor channel where plain
messages get answers. Home-guild-gated at launch.

## THE GROUNDING PACK (it answers ONLY from house doctrine)
methodology.html (all 🍭s + grown-ups) · tool one-liners (§15 questions)
· POP/berry rules (Fresh/Frozen, rot, holds) · raffle rules template +
current raffle · server map (which channel does what) · glossary
(chips, spread, premium, seasoning). Plus LIVE numbers: it may quote
the current feed (price/index) WITH the chip and a link — never from
memory, never invented.

## SAFETY LAWS (non-negotiable)
- Simple-first: every answer opens at 🍭 level, offers depth second.
- NO advice: never "should I buy/sell/grade" — it explains instruments,
  then: "we publish reads, not calls — here's how to read this one."
- No invented numbers; unknown → "good question — I don't have that;
  a mod will" + logs it.
- v4 posture (no disclaimers-spam; chips carry it), v5 clarity, ≤120
  words default, expand on request.
- Rate limits: 10 questions/user/day, token caps, common-answer cache.

## THE FLYWHEEL (the quiet superpower)
Every question logs (anon-ok) → weekly digest of "what confused people"
→ feeds the Digest Law backlog: repeated questions become UI fixes,
new 🍭s, or FAQ entries. Support becomes product research.

## NEEDS: Anthropic API key (Tyler creates at console.anthropic.com,
small usage billing; masked via gh secret ANTHROPIC_API_KEY on the bot).
COST GUARD: hard monthly token budget in config; degrades to
static-FAQ answers if exceeded — never a surprise bill.
