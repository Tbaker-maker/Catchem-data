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
