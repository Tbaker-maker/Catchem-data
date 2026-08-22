# Self-sufficiency, backup, the dot, and a refusal (2026-08-23)

`node scripts/audit.mjs` → **20/20** · `node scripts/negative-tests.mjs` → **39/39**

## Wrong assumptions

**Assumption 2 was wrong: `collision-guard.mjs` was NOT fixed.** It still
pinned every git call to Catchem-data and still returned "touched in the last
6h by: nobody · already exists: no" for a `Ticker.jsx` chat had edited twenty
minutes earlier. I fixed it, chat rewrote it concurrently with a better
both-repos design, the rebase took theirs — and theirs had lost the path
normalisation, so an **absolute** path still reported "nobody" while the
relative form correctly said "chat and CC", minutes apart. Re-applied on top of
their design. Three collisions on the file whose job is preventing collisions.

Assumptions 1 and 3 held: `height:100%` is scoped to the desktop grid, and the
dot fingerprints per-section content.

## Block 1 — self-sufficiency

Two things had to be fixed before the watchdog could be scheduled, or it would
have been theatre:

- **`heartbeat.mjs` did nothing on Windows.** It used the
  `file://${argv[1]}` CLI guard, so the whole block was skipped and it exited 0
  no matter how stale the stamps were. It works in CI, which is worse — the
  watchdog's sensor could not be tested on the machine anyone would test it on.
  Now `pathToFileURL`; negative-tested, a 72h-stale stage exits 1 and names it.
- **The watchdog would have been red every single day.** `botAlive` expects an
  hourly check-in from catchem-bot, which is not deployed. A permanently red
  alarm gets muted, which costs the alarm — the same crying-wolf failure as the
  dot, in a different costume. Not-yet-deployed is now distinct from
  gone-quiet: PENDING stages stay silent until they report once.

Then: watchdog at 12:00 UTC on its own workflow (an alarm inside the fire is
not an alarm), the agent digest delivered on success (truncation tested against
the real 9,211-char file → 1,739, cut on a line break), and a failure notice
that asks the API which step died, because GitHub exposes no expression for it.

**Nothing was posted to Discord from this session.** Every notification is
guarded on the secret and fires on the next scheduled run.

## Block 2 — the backup, and the test nobody runs

The mirror step ships **dormant**: `continue-on-error`, and skipped entirely
until `MIRROR_REMOTE_URL` exists as a secret. Creating the second host needs an
account, which is Tyler's to make — the doc says so, and account creation is
outside what I do.

**The restore is real.** Bundled the full history (44.6 MB), cloned it into a
fresh directory, ran `audit.mjs` against the clone: 2,861 files, all four
irreplaceable documents intact, **19/20 — identical to the live repo at that
moment, including the same single failure.** Faithful, not degraded. That is
the difference between a backup and a comfort.

The shared failure was **`/tmp` for the seventh time** — three new rows
(nt-kb2, nt-cs, nt-ac) added within a day of the rule written to stop exactly
this. They got through because of my own fix: to spare the fixture string that
proves the rule works, I had exempted the **whole** `negative-tests.mjs` file,
putting a blind spot in the one file most likely to grow new `/tmp` paths. Now
the exemption is that one string in that one file; planted anywhere else it is
still a violation, which is what its own test asserts.

## Block 3 — the dot works

| test | result |
|---|---|
| A — first visit | 0 dots, no line ✓ |
| B — returning, content unchanged (**the regen case**) | 0 dots ✓ |
| C — one section genuinely different | exactly 1 dot, on that section; movers clean ✓ |

**It no longer cries wolf.** My first pass at these tests reported failures —
that was my own bug: I queried the old `title="new since your last visit"` when
the title is now `"changed since your last visit"`. The feature was correct and
my instrument was not, which is worth recording because I nearly reported a
working feature as broken.

**One residual, minor:** the explanatory line is still gated on
`isNewSince(feed.generatedAt)`, the old signal — so on a quiet day a returning
reader sees *"A ● marks what has changed since"* with no dots anywhere. It
promises markers that are not there. Gating the line on "did any dot fire"
would close it. Not urgent, not wrong, just slightly hollow.

## Block 4 — a second refusal, with one frame

Screenshots worked **once** — fronting the tab made the pane composite, and I
got one desktop frame. It confirmed the accent-colour finding is real: the
bottom nav carries four different colours (Today red/orange, Tools pink, Watch
gold, Board blue) on one surface, against our rule of one.

Then it stopped. Every attempt at phone width failed to composite, including
after re-fronting. The brief asks for "one change at a time, keep what looks
better" — that needs a screenshot after every change, at the width readers use.
One lucky desktop frame does not support 32 emoji deletions and a colour
reduction.

**So: second refusal on 4(a) and 4(b), as invited.** The four-colour nav is
confirmed by eye and ready for whoever can see the result; I am not the one.

## Needs Tyler
1. **Create the mirror remote** and add `MIRROR_REMOTE_URL` — the step is
   already there and dormant.
2. **Emoji and accent passes** — confirmed real, still need working eyes.
3. **The explanatory line** — gate it on a dot actually firing?
4. **`botAlive`** — when catchem-bot deploys, remove it from PENDING or it
   stays permanently exempt, which is the opposite failure.

## Roads not taken
- Did not create an account on a second host (outside what I do; the doc
  assigns it to Tyler anyway).
- Did not attempt the emoji/colour passes on one desktop frame.
- Did not fix the explanatory-line gating — it is a judgment call about copy,
  and the feature it belongs to has now been changed twice.

## Surprises, including my own
- **My own `/tmp` exemption created the blind spot that let the seventh
  instance through.** A fix that widens an exception is a fix that can be
  wrong in the same direction later.
- The **"App builds before push"** guard reported "catchem-app does not
  compile" while the app built fine: `npx` is `npx.cmd` on Windows and
  `execFile` cannot resolve it, and the ENOENT arrives on `e.code` with empty
  streams, so the "tool missing → skip" branch never fired. A guard saying "I
  could not check" as "your app is broken" is the worse of the two lies.
- I nearly filed the retention dot as broken because of my own stale selector.

## Uncommitted / unverified
- The mirror has never actually pushed — no remote exists yet. The restore
  path is tested; the mirror path is not, and cannot be until Tyler adds it.
- The watchdog has never fired in anger; its sensor is negative-tested, its
  schedule is not yet proven by a real 12:00 UTC run.
- The Discord steps have never sent a message — by design this session.
- Emoji count (32) and accent count (4): the four colours are now eye-confirmed
  on desktop; the emoji count remains the agent's figure, unverified by me.
