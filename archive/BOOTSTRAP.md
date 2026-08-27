# BOOTSTRAP — paste this file's path to a new chat and say "boot from this"

You are picking up Catch'em mid-build. Do these steps IN ORDER and don't
improvise until step 5.

## 1. Get the repo (your container starts empty)
```
cd /home/claude
git clone https://github.com/Tbaker-maker/Catchem-data.git
cd Catchem-data
```

## 2. Read exactly two files, nothing else yet
```
cat catchem-knowledge-base.md      # canonical state
cat HANDOVER.md                    # what never to do, what's broken
```

## 3. Verify the state yourself — don't trust the docs
```
node scripts/fleet.mjs --quiet     # 8 agents report
node scripts/heartbeat.mjs         # is the bot alive?
```

## 4. Tell Tyler three things
- What the fleet reports (blocking vs advisory)
- Bot status (it was 50h stale, 4 stages quiet as of Aug 24)
- The outcome log count (was 5; twenty is where ranking stops guessing)

## 5. Only then take instructions.

---

## THE STATE, Aug 24 2026 (verify before repeating)

**WORKING:** editor (build.html, 1.9MB, offline, prompt bar, streak with
safeguards, reach tiers) · composite builder (2x2 at safe 1.15 ratio) ·
post queue · experiment tool · metrics reader (needs keys) · 42 guards ·
fleet runner.

**PENDING TYLER:** X API keys from console.x.com — read+write, callback
https://catchemtcg.com/callback. Keys go to CC, never chat.

**PENDING CC:** deploy landing page + editor · wire --send in post-queue.mjs +
fetch in read-metrics.mjs, cron hourly · FIX THE BOT (24 products carry
broken-era price history — the Catch'em news account can't exist until fixed) ·
24 eyes-queue questions waiting.

**THE NUMBER:** outcome log = 5 posts. At 20 it stops guessing.

## LAWS THAT PREVENT REPEAT DAMAGE
- Backslashes die in generated code. Use String.fromCharCode(92). 13 casualties.
- When an edit fails twice, print the raw bytes. Tool is wrong, not pattern.
- A table is truth only if EVERY reader reads it. 4 bugs from recomputing.
- The streak count NEVER advances on its own.
- Every number in a doc gets checked against data before shipping. 2 caught.
- Tyler catches broken promises; machines catch crashes. Both are needed.
- Sustainability over velocity. Two jobs, two kids. Never push sprints.
