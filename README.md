# Playwright Starter

[![Verify](https://github.com/PrakashgoudaAI/playwright-starter/actions/workflows/verify.yml/badge.svg)](https://github.com/PrakashgoudaAI/playwright-starter/actions/workflows/verify.yml)

A TypeScript test project built around a small task board. It covers browser workflows and the API behind them: signing in, creating tasks, enforcing viewer permissions, and invalidating sessions on logout.

The application and accounts are included, so a first run needs no external service or credentials. All examples are synthetic.

## Run locally

Use Node.js 24 and npm. From a fresh clone:

```sh
npm ci
npx playwright install chromium firefox
npm run check
npm test
```

Playwright starts and stops the demo server. Port `4173` must be available; set `DEMO_PORT=4300` to use a different port. The suite intentionally targets `127.0.0.1`, not an external application. `.env` files are not loaded automatically.

For API checks without a browser, run `npm run test:api`. To explore the app, run `npm run demo` and open `http://127.0.0.1:4173`. The public demo accounts are in [`accounts.ts`](examples/demo-app/accounts.ts).

## What the tests cover

- **Authentication:** rejected credentials, protected routes, UI sign-in/sign-out, and server-side invalidation of a logged-out cookie.
- **Permissions:** viewers can read tasks but cannot create them through the API; editing controls are absent from their page.
- **Task workflows:** create a high-priority task, find its table row, and mark it complete.
- **Isolation:** two simultaneous sessions receive separate datasets; one cannot complete the other's task.
- **Input handling:** invalid task data, malformed JSON, foreign browser origins, and rendering task titles as text.
- **Configuration:** invalid port values fail before the server starts.

There are 11 API/configuration checks and 6 browser scenarios run in both Chromium and Firefox: 23 checks in total. Viewer permissions include rejected create and complete requests, with task data unchanged after a rejected completion. The workflow badge links to the actual run history.

## Design decisions

Tests use Playwright's fixtures, assertions, and locators directly. A page object describes task-board actions; a table component scopes interactions to a named row. Assertions stay in the tests.

Authenticated browser tests create a new API session, pass its cookie state to a fresh browser context, and invalidate the session during teardown. State stays in memory rather than in a shared authentication file. A viewer role can be selected with `test.use({ role: 'viewer' })`.

Each demo session owns its tasks. This keeps parallel tests independent without random title suffixes or cleanup calls against a shared database. It is a deliberate test-app design, not a model of production account persistence.

```text
examples/demo-app/   Local HTTP app, public accounts, session and task behavior
src/api/            Demo sign-in helper
src/components/     Task-table interaction
src/config/         Validated local environment
src/fixtures/       Role selection and session lifecycle
src/pages/          Task-board actions
src/support/        Generated-result cleanup
tests/              API and browser specifications
```

## Reports and CI

Each test run writes a Playwright HTML report, JUnit XML, and Allure results. Traces, screenshots, and video are retained for browser failures. Retries are disabled so a flaky failure remains visible.

```sh
npx playwright show-report
npm run report:allure
```

The Allure HTML command requires Java 17+ on `PATH` or via `JAVA_HOME`. GitHub Actions installs Java and generates that report after the test step. Its downloadable `test-reports` artifact includes all report formats and is retained for seven days. Allure results are cleared before each run to avoid mixing results from separate runs.

CI runs on pushes to `main`, pull requests, and manual dispatch. It uses two workers, a read-only repository token, and actions pinned to commit revisions. Reports can contain cookies, request bodies, and page content: this workflow is suitable for these public synthetic accounts, not sensitive systems without a separate artifact policy.

## Scope and limitations

This is a focused starter, not a production authentication service. The demo has public plaintext credentials, in-memory data, HTTP-only local hosting, and no rate limiting or account recovery. Its cookie has `HttpOnly` and `SameSite=Strict`; it is not `Secure` because the app runs on local HTTP. Do not deploy it as a real service.

Chromium and Firefox are configured; WebKit is not included yet. SSO/MFA, visual baselines, accessibility audits, persistent databases, and Azure DevOps execution are not implemented. Broader permission boundaries and accessibility checks remain useful next additions.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [MIT license](LICENSE).
