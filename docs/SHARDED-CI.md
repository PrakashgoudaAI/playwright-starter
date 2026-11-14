# Complete results across two shards

The reusable `browser-tests.yml` workflow is called by pull requests, main pushes, manual runs and one weekly schedule. Manual runs accept all browsers or one browser plus the API project. Unrecognized browser names fail before test execution.

A planning job lists the selected suite and records its test IDs. Two test jobs record their planned IDs, final statuses and attempt counts with the same run/attempt/commit identity. The report job checks those manifests against the full plan before accepting success. Missing shards, omitted tests, repeated IDs, stale run identity, skips, failures and retries all fail the gate. A green subset is insufficient. This is a completeness check over runner artifacts, not a security boundary against a malicious workflow author.

The report job runs after failed shards when planning succeeded, allowing diagnostic report generation. It combines Playwright blob reports into HTML and JUnit. Each shard also uploads its raw Allure results; their unique result files are collected for Allure HTML generation with Java 17. Replaying blobs through the Allure reporter returned an error with the installed versions, so the workflow uses the original results instead. It retains the reports and manifests for seven days. Jobs use read-only repository permissions and disable checkout credential persistence.

## Local evidence

On 2 November 2026, both shards passed 122 tests each: 244 total. The gate accepted all 244 distinct planned IDs. Six unit tests passed, including missing-manifest and incomplete-result negative controls. Merged JUnit recorded 244 tests, zero failures, errors or skips; HTML and raw Allure output were produced. Local Allure HTML generation could not run because this host has no Java runtime. The hosted workflow installs Java; [run 43571894099](https://github.com/PrakashgoudaAI/playwright-starter/actions/runs/43571894099) subsequently passed the shard and report jobs, including Allure generation.

```sh
QUALITY_RUN_ID=local PLAN_MANIFEST=quality-results/plan.json npx playwright test --list --reporter=./src/support/shard-reporter.ts
QUALITY_RUN_ID=local SHARD_MANIFEST=quality-results/shard-1.json BLOB_DIR=quality-results/blob-1 npx playwright test --shard=1/2
QUALITY_RUN_ID=local SHARD_MANIFEST=quality-results/shard-2.json BLOB_DIR=quality-results/blob-2 npx playwright test --shard=2/2
QUALITY_RUN_ID=local npm run check:shards
```

Copy the two generated zip files into a single directory and run `npx playwright merge-reports --config=merge.config.ts <directory>`. Run `npx allure generate quality-results/allure --clean -o merged-allure-report` with Java 17 installed. Use a fresh result directory per run; repeated report merges append Allure output.

Azure execution is deferred because no Azure project or runner is connected. There is no claimed Azure pipeline evidence.

The 14 November session regression additions bring the complete local suite to 246 executions and 12 unit tests. The earlier 244-test shard run above remains a dated historical measurement. New hosted results must be read from the run for the new commit.
