# Contributing

This project is intentionally small. Prefer a focused change with an accompanying test over a broad abstraction.

Before opening a pull request, run `npm ci`, `npm run check`, and `npm test` with Node.js 24. Install Chromium with `npx playwright install chromium` if needed. Explain which behavior changed and what you verified; mention any checks you could not run.

Keep all examples synthetic; do not add employer, customer, credential, or production-system material. Avoid fixed sleeps, shared mutable test data, and retries that conceal failures. Prefer semantic locators and native Playwright features before adding helpers.

Use a short, factual commit message, such as `test: cover viewer task permissions`. Never commit generated reports, browser downloads, or authentication state.
