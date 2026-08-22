# PROMPT CONVENTION — how chat writes work for CC
*Tyler, Aug 22 2026: "should we always be auditing your prompts quickly
just in case?" Yes — for judgment, not correctness. This convention makes
that audit take ten seconds.*

## THE RULE
Every prompt chat writes for CC opens with an ASSUMPTIONS block:
**2–4 bullets, one line each, stating only what would CHANGE THE WORK if
it turned out to be false.** Not a summary. Not context. Just the load-
bearing premises.

    ASSUMPTIONS (correct me and stop if any are wrong):
    - The Deal Zone engine is live and flowing through the feed.
    - Newsletter 001 has not sent yet.
    - No mode system exists in the app yet.

## BEFORE DRAFTING — read the last report (added Aug 22, after chat got two of four premises wrong)
Chat must read the newest file in `research/reports/` before writing any
prompt. Twice in one day chat drafted from a stale snapshot: it asked for
the Creator Portal that had shipped the session before (block text was
word-for-word identical to the prior prompt), and it declared a guard
"not running anywhere" because the guard failed in CHAT'S sandbox, which
has no browser — it runs fine in CI. Both were avoidable by reading the
report that already said so.
RULE: latest report first, then `git log --oneline -10`, then draft.
SECOND RULE: never generalise from chat's own environment. Chat's sandbox
has no browser and a restricted network. "It fails here" is evidence
about here, not about the machine that matters.

## STOP vs SKIP (ruling, Aug 22)
The two instructions are not in conflict:
- A premise that makes the WORK WRONG → stop and report. Building on it
  would produce something nobody wants.
- A premise that is false because the work is ALREADY DONE → skip that
  block, say so, and continue with the rest. Stopping would waste a
  session over good news.
CC's handling on 2026-08-22 was correct and is now the precedent.

## WHY IT EXISTS
Chat cannot see the machine. Its worst failures are not bad code — CC
catches those — they are **false premises**: assuming a page exists,
assuming a job is unfinished when CC already shipped it, assuming a
dependency landed. Stating the premises out loud makes them auditable at
a glance by Tyler, and checkable in seconds by CC against the repo.

## THE INSTRUCTION THAT MATTERS MOST
CC should **stop and report** when an assumption is false, rather than
improvising around it. A prompt built on a wrong premise usually wants a
different prompt, not a workaround. Silent adaptation hides the error and
produces work nobody asked for.
Standing companion rule: if a block is already done, say so and skip it.

## KEEP IT SHORT
A long assumptions block is ceremony, and ceremony gets skipped. If more
than four premises are load-bearing, the prompt is probably too big for
one session — split it.

## RECIPROCAL
CC's reports should name any assumption chat got wrong, explicitly. That
is how the error gets fixed at the source instead of being routed around
every session. Tyler's audit is the third layer, not the only one:
chat states → CC checks → Tyler judges.

## THE RETURN LEG — session reports (Tyler, Aug 22)
Reports should carry what the repo CANNOT say. Chat can read git log and
the files; it cannot read a decision that was never made, or a test whose
result was never committed.

### WHERE IT GOES
CC writes `research/reports/<date>-<session>.md` and pushes it. Chat pulls
and reads it — no copy-paste burden on Tyler. CC also prints a SHORT
version (≤10 lines) in the terminal so Tyler sees it live, because he
catches product problems neither machine does.

### WHAT BELONGS IN IT (the repo can't tell chat these)
1. **Wrong assumptions** — which of the prompt's stated premises were
   false, per the ASSUMPTIONS convention. This is the highest-value line
   in the whole report; it fixes the error at the source.
2. **Roads not taken** — what CC chose NOT to do, and why. A skipped
   block with a reason is information; a silently skipped block is a gap.
3. **Needs Tyler** — decisions CC deliberately did not make alone.
4. **Surprises** — anything that behaved differently than expected,
   including CC's own bugs. (The aggregatePrices ReferenceError and the
   negative test that wrongly passed both came from this line.)
5. **Uncommitted verification** — offline tests, live fetches, Lighthouse
   runs, anything proven but not stored as a file.

### WHAT DOESN'T BELONG
A list of what was built. That is what commits are for, and a prose
restatement of the diff is the least useful part of any report.

### WHY BOTH DIRECTIONS MATTER
chat states assumptions → CC checks them and reports what was wrong →
chat corrects at the source. Without the return leg the same false
premise gets re-stated every session, and the audit chain only runs one
way.
