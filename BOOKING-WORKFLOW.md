# Booking reference workflow

This example joins the reusable controls to a real local HTTP service. The happy-path test signs in through the UI, selects participants and a date, saves a booking, reads the server record back, and finds the same reference on a later table page. It does not intercept successful API responses.

```text
UI sign-in -> booking widgets -> POST /api/bookings -> session-owned store
           -> API read-back -> paginated booking table
```

## Run it

Use Node.js 24 as required by package.json. From a fresh checkout:

```sh
npm ci
npx playwright install chromium firefox
npm run check
npm test
```

For a manual walkthrough, run `npm run demo`, open `http://127.0.0.1:4173/login`, and sign in with an account from [accounts.ts](examples/demo-app/accounts.ts). Choose the Bookings link on the task board. Use a date in the fixed 2028–2029 demo window; 14 February 2028 and Evan are deliberately unavailable. No real account, API key, or external service is required. If DEMO_PORT changes, use that port in the URL.

To run only this feature:

```sh
npx playwright test tests/bookings.api.spec.ts --project=api
npx playwright test tests/bookings.ui.spec.ts
```

## How the pieces fit

- [BookingWorkspace](src/pages/booking-workspace.ts) composes the existing [BookingPage](src/pages/booking-page.ts) widgets and [PaginatedTable](src/components/paginated-table.ts). Test locators stay out of the browser application.
- [booking-client.ts](examples/demo-app/booking-client.ts) implements the browser behavior and fetches options from the service. It renders record fields with textContent, not HTML interpolation.
- [booking-routes.ts](examples/demo-app/booking-routes.ts) serves the page, same-origin assets, and authenticated API. The host server checks session expiry and foreign write origins before calling it.
- [booking-store.ts](examples/demo-app/booking-store.ts) owns validation, record references, and per-session idempotency. A bounded store is associated with the authenticated session through a WeakMap.

The browser client is TypeScript checked by the existing check command. The Node 24 demo removes its type annotations when serving JavaScript; this is not a general-purpose build pipeline. Only checked-in local assets are served. The new page permits same-origin scripts, styles, and fetch calls under its own restrictive CSP. Task-board headers are unchanged, and neither page permits inline scripts.

## API contract

| Request | Behavior |
| --- | --- |
| GET /api/bookings/options | Authenticated demo options and availability. |
| GET /api/bookings?page=1&pageSize=2 | Session-owned records; page 1–100, size 1–10. |
| GET /api/bookings/:id | Read a record from this session, or 404. |
| POST /api/bookings | Editor-only creation; JSON body and Idempotency-Key required. |
| GET /bookings | Authenticated workspace; otherwise redirect to sign-in. |

A booking body contains title, startDate, and participants only. Titles are trimmed and limited to 80 characters. Dates must be valid Gregorian YYYY-MM-DD values within the fixed demo window and not blocked. Participants must be 1–3 distinct available IDs. Unknown fields and malformed page parameters are rejected. Request bodies are capped at 8 KiB; each session can create at most 100 bookings.

The unauthenticated and secondary API clients explicitly start with empty cookie/origin storage state. A manually created client inside a configured test must not accidentally inherit the owner identity; signing in with that cookie could rotate the owner session.

Viewers can read their own collection but cannot write. Two sign-ins, even with the same public account, own separate datasets. This is deliberate test isolation, not persistent account storage or a model of real booking permissions. Logout revokes access; the host's existing session expiry also applies. Records are lost on process restart.

## Duplicate requests and uncertain saves

The client creates a request key for a draft and keeps it in memory. Repeating the same draft reuses that key. Changing the payload or choosing New draft starts a different intent. Controls are disabled while a save is pending.

The server canonicalizes the payload before comparing it: whitespace around a title is removed, and participant order does not change the intent. A first successful request returns 201. Replaying the same key and equivalent payload returns 200 with the same record and Idempotent-Replay: true. A previously successful key with a different payload returns 409. Validation failures do not reserve the key.

The server records the booking and key together without an intervening await in this single process. This is not a distributed transaction or a durable idempotency design. A production service needs a database uniqueness constraint, atomic commit, retention rules, and a documented key scope. The browser's key is not persisted across reloads, so recovery here covers retries in the current page, not recovery after closing the tab.

The lost-response test forwards the POST to the real service, confirms it committed, then drops the response. The UI cannot know whether it saved, preserves the draft, and offers a manual retry using the same key. The test verifies the retry replays the original record and the collection still contains one booking. There is no hidden automatic retry.

## What is tested

[API tests](tests/bookings.api.spec.ts) cover canonical creation/read-back, authentication, viewer restrictions, invalid payloads, malformed and oversized JSON, media types, missing keys, replay/conflict/concurrent duplicates, cross-session ownership, foreign origins, pagination, CSP boundaries, and logout.

[Browser tests](tests/bookings.ui.spec.ts) cover real UI sign-in and persistence, a later-page row, server rejection without losing fields, a temporary 503, a committed write with a lost response, repeated submission, literal rendering of an HTML-like title, stale rows after a failed page load, and a read-only viewer. Only the failure cases inject network faults, and they verify the actual service state separately.

The existing standalone pattern tests remain separate. They test small DOM contracts; this suite checks how several contracts work together through HTTP.

## Adapting it

Keep the reusable components, but replace the application mapping and service-specific readiness signals. Define your own allowed participants, availability, identity, and persistence rules. Do not copy the demo's fixed dates, public credentials, per-login datasets, or in-memory store into a real deployment. Real scheduling conflicts, durable storage, SSO, deployment security, full accessibility, and multi-process concurrency are outside this reference.

Use synthetic data when running the public workflow. Traces, screenshots, reports, and downloaded artifacts need a separate data-handling policy before testing an application containing real customer data.
