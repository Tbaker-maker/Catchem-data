# BUILD1 progress

Started from origin/main. Workflow files are not edited. A step that needs a workflow edit is marked BLOCKED after the rest of that item is merged.

1. Post Office catalogue builder: SHIPPED, PR #273, SHA e6da04e2dedc60ba36e1aba665b91f99eb4bfbe6. Nightly workflow hook BLOCKED. Script: scripts/build-post-office-catalogue.mjs.
2. News shared file: in this PR. The night job already runs scripts/fetch-tcg-news.mjs, which stamps research/digests/news.json. Midday schedule BLOCKED (needs a workflow edit). Script: scripts/run-shared-news.mjs.
3. News source registry: not started
4. News dedupe labels: not started
5. News impact record: not started
6. Pattern lab: not started
7. Read scorer: not started
8. Data drift bot: not started
9. Custom reads: not started
