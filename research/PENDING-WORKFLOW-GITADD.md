# One workflow line CC has to apply (chat's token lacks `workflow` scope)

Chat cannot push changes to `.github/workflows/` — GitHub refuses a Personal
Access Token without the `workflow` scope. So this one edit needs your hands.

## THE CHANGE
In `.github/workflows/update-sealed-prices.yml`, append these to the `git add`
line:

```
data/card-catalogue.json data/themes.json data/decision-log.json data/post-outcomes.json data/knowledge.json data/community.json
```

## WHY IT MATTERS MORE THAN IT LOOKS
`scripts/guard-audit.mjs` now carries an **EVAPORATES** check: any file a
pipeline script writes must appear in that `git add` line, because **written in
CI and never added means gone when the job ends** — the script rewrites it
tomorrow to no effect, and the job appears to work while producing nothing.
That is the class that froze the app feed and ate era history daily.

It found **`data/card-catalogue.json` orphaned — all 16,468 cards**, regenerating
and vanishing every morning. Five others alongside it: themes, the decision log,
post outcomes, the knowledge base, and the community file.

## A NOTE ON THE CHECK ITSELF
My first version compared paths against the `git add` line as plain strings and
reported **40 false positives**, because `research/pulse/` already covers every
file beneath it. Fixed to understand directory coverage before you see it — but
worth knowing the check has been wrong once, so if it flags something that looks
covered, check the directory paths before believing it.
