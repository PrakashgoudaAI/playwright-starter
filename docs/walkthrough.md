# Investigate a failure without hiding it

Run `npm ci`, `npx playwright install --with-deps chromium firefox webkit`, then `npm run verify` on Node 24. The local application and test data are synthetic. The command includes the session and shard-gate unit tests as well as all browser and API projects.

## Session boundaries

Start with `tests/unit/session-store.test.ts`: the injected clock makes expiry deterministic at the deadline without waiting fifteen minutes. Rotation invalidates the previous token. Follow those behaviors into `tests/session.api.spec.ts`, where separate signed-in sessions prove task ownership and logout isolation. The HTTP checks complement the store tests; a correctly hidden control does not prove authorization.

## Locate the failure

For a UI failure, open the merged Playwright HTML report and the failing test's trace. Inspect the action, accessible locator and response before changing a timeout. Table tests include ambiguous keys, missing rows, repeated pagination markers and stale rows after failed loads. Each case should stop safely rather than click the wrong record.

## Check whether the run is complete

The reusable workflow generates the expected test-ID manifest separately, runs two shards and compares the distinct observed IDs with that plan. Missing manifests, missing results, skips and retries fail the gate. Passing assertions in the results that arrived cannot compensate for a shard that never reported. Unit tests in `tests/unit/shard-gate.test.ts` exercise those negative controls.

Merged HTML, JUnit and Allure output belongs to one run; start with empty output directories when reproducing a merge. The `merged-test-reports` artifact expires after seven days. Source-controlled tests and this walkthrough remain the durable explanation after artifacts expire. See [the shard design](SHARDED-CI.md) for the exact local commands.

The suite covers selected accessibility flows with axe and keyboard checks. A green run does not certify full accessibility, production authentication or behavior against a persistent deployment.
