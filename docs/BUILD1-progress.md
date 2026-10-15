# BUILD1 progress

Started from origin/main. Workflow files were not edited. A nightly or midday schedule that needs a workflow edit is BLOCKED. The scripts are on main and can be run by the existing jobs once a workflow line is added.

1. Post Office catalogue builder: SHIPPED, PR #273, SHA e6da04e2dedc60ba36e1aba665b91f99eb4bfbe6. Nightly hook BLOCKED. Script: scripts/build-post-office-catalogue.mjs. Guard passed on the Oct 14 catalog (unpriced share 0.0176).
2. News shared file: SHIPPED, PR #275, SHA 55733b3de99fdf16cd0e5a099473b7c9c18ca82d. The night job stamps research/digests/news.json from scripts/fetch-tcg-news.mjs. Midday schedule BLOCKED. Script: scripts/run-shared-news.mjs.
3. News source registry: SHIPPED, PR #276, SHA 4059d088cd23814433f1288dd342e2cf4786627c. Logged robots and terms checks. No page fetch. An empty log does not drop a source.
4. News dedupe labels: SHIPPED, PR #277, SHA 4da23f427a0a07844b0070b31a82658b3921712c. Labels are Official, Confirmed, and Unconfirmed.
5. News impact record: SHIPPED, PR #278, SHA cad8737c9e1748797474281b1c1c2513032713b3. Windows are 1, 7, and 30 days. No price book is on disk yet, so those windows are empty rather than filled in.
6. Pattern lab: SHIPPED, PR #279, SHA 6d46cacf1b4abd7476c1d52f569954c7336ec2d3. Weekly script is scripts/run-pattern-lab.mjs. Weekly schedule BLOCKED. No episode file yet, so nothing is promoted.
7. Read scorer: SHIPPED, PR #280, SHA 1dc0b5c63bcc95fba165be0e2284091b6fbcf94a. Hit rate and sample size, published when the sample is at least 20.
8. Data drift bot: SHIPPED, PR #281, SHA 24c2dbeb0bba2a6d26b6c0486ab526f8d4c7d757. Opens a fix pull request only when DRIFT_BOT_TOKEN is set. Schedule BLOCKED.
9. Custom reads: SHIPPED, PR #282, SHA 209e951b6d67fe9ae0bb7ac74bb0602f7a1339f8. Quiet days are not written. Nightly hook BLOCKED. The follow list is empty.
