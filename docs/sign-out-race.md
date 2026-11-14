# Wait for logout before testing another navigation

The first main run after the session milestone failed one WebKit check: [run 43613158622](https://github.com/PrakashgoudaAI/playwright-starter/actions/runs/43613158622), shard two. The browser remained on `/board` after the test clicked Sign out and immediately navigated there again. The pull-request run and fresh local run had passed, so a green result alone did not establish stability.

The test issued its second navigation before establishing the outcome of the form submission. That could race with logout navigation and session revocation. `WorkspacePage.signOut()` now starts waiting for the login URL before clicking and returns only after that navigation. The route-boundary test also verifies that the browser's API context receives 401 before it attempts a fresh protected navigation.

This changes synchronization around the actual user outcome. It adds no sleep, retry or wider assertion timeout. The original failed run remains available; any later verification must identify its own revision and result. Passing repeated checks reduces uncertainty about this race but is not a claim that the entire suite is free of intermittent failures.

Local verification on 14 November 2026 passed the complete command (12 unit tests and 246 configured executions). Twenty repeats of all three WebKit authentication tests also passed: 60 executions, two workers, zero retries. This is a targeted synchronization check, not a substitute for the hosted run on the fix revision.
