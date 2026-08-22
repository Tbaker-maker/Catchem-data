# BACKUP — one remote is not a backup (Tyler applies; 20 minutes)
Verified 2026-08-23: this repo has **one remote**, on one GitHub account.
Everything — fourteen agents, thirty-eight negative tests, thirty-two laws,
seventeen logged errors with the guard each produced, every session report —
lives behind a single login.

That is not a criticism of GitHub. It is that a lost password, a locked
account, or one wrong `git push --force` takes all of it, and the most
valuable thing in there is not code. **It is the error ledger** — the record
of what broke and what we built because of it. Code can be rewritten in a
week. That list took a fortnight of being wrong in specific ways.

## THE SMART VERSION, cheapest first

**1. A second git remote (10 minutes, free).**
A mirror on a second host — GitLab, Codeberg, Bitbucket, anything — pushed by
the same workflow that already runs daily.
```bash
git remote add mirror https://gitlab.com/<you>/catchem-data.git
git push mirror main
```
Then one step at the end of the daily workflow:
```yaml
      - name: Mirror
        run: git push mirror HEAD:main
        continue-on-error: true      # a failed mirror must never fail the run
```
`continue-on-error` matters: a backup that can break the thing it protects is
worse than no backup.

**2. A second pair of eyes on the account (5 minutes).**
Turn on two-factor if it is not on, and store recovery codes somewhere that is
not the same laptop. The DBIR finding that 46% of compromised corporate logins
came from unmanaged personal devices applies to exactly this account.

**3. A quarterly cold copy (5 minutes, once a quarter).**
`git bundle create catchem-$(date +%F).bundle --all` produces one file
containing the entire history. Put it wherever your important documents live.
A bundle restores with `git clone`, needs no service to exist, and does not
care whether GitHub is still a company.

## WHAT TO PROTECT FIRST, IF YOU ONLY DO ONE THING
`research/RESEARCH-GATE.md` (the error ledger), `research/house-theses.md`
(every ruling), `research/THE-OPERATING-SYSTEM.md` (the portable half), and
`catchem-knowledge-base.md` (the entry point). Those four files are the part
that cannot be reconstructed by rewriting code.

## THE TEST NOBODY RUNS
A backup nobody has restored is not a backup. Once the mirror exists, clone it
into a fresh folder and run `node scripts/audit.mjs` against it. If it does not
pass, the backup is a comfort rather than a control — which is exactly what we
said about untested guards, and it is the same mistake in a different costume.
