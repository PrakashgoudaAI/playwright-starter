# Put each check at the layer that can prove it

Status: accepted.

## Problem

Running every check through a browser slows feedback and can obscure whether a failure belongs to application state, HTTP authorization, or UI interaction.

## Decision

- Use Node.js unit tests for exact session expiry and lifecycle rules. These tests need no port, browser, credentials, or fixed sleeps.
- Use Playwright request contexts for response contracts, role enforcement, stale cookies, and cross-session access. Each independent context has its own cookie jar.
- Use browser tests for labels, navigation, native controls, task rows, and user-visible state. Keep assertions in specifications and interactions in small page/component objects.

Unit tests cannot prove cookie handling or HTTP route authorization. API tests cannot prove the UI is accessible or that browser interactions work. Browser tests should not repeat every low-level expiry case.

## Consequences

`npm test` runs unit checks first, then the API and browser projects. Unit failures stop the full command early. Playwright reports contain only the Playwright checks; unit results remain in the command/CI log. No combined-report claim is made.

Do not add wrappers around native assertions, request contexts, or locators solely to make the project look larger. Add abstractions only when their ownership and repeated use are clear.
