# Reusable Playwright patterns

Start with the control you need, then keep the application-specific labels and business actions in your page object. These examples are small on purpose: a native select, an editable combobox, and a checkbox group should not share a catch-all click helper.

## Run the examples

Use the Node version specified in package.json. From a fresh checkout:

```sh
npm ci
npx playwright install --with-deps chromium firefox
npm run check
npx playwright test tests/patterns
```

The existing configuration starts the local demo server and runs the pattern tests in Chromium and Firefox. Run all pattern files with `npx playwright test tests/patterns`. No external website, account, or API key is needed. To inspect one browser interactively:

```sh
npx playwright test tests/patterns/control-patterns.ui.spec.ts --project=chromium --ui
```

## Find a pattern

| Need | Start here | Contract |
| --- | --- | --- |
| Native dropdown | [NativeSelect](src/components/form-controls.ts) | Choose a visible label; use values for a native multi-select. |
| Searchable dropdown | [SearchCombobox](src/components/form-controls.ts) | Editable ARIA combobox and an explicitly supplied listbox; exact option names. |
| Several checkboxes | [CheckboxGroup](src/components/form-controls.ts) | Replace the complete selection using typed keys; scope choices to their group. |
| Radio buttons and dates | [PreferencesPage](src/pages/preferences-page.ts) | Native radio inputs and an ISO-formatted native date input. |
| Mixed select-all state | [PreferencesPage](src/pages/preferences-page.ts) | Set the native controller to a known state; verify affected rows. |
| File uploads | [PreferencesPage](src/pages/preferences-page.ts) | Supply in-memory buffers; clear with an empty list. |
| File downloads | [PreferencesPage](src/pages/preferences-page.ts) | Register the event first, then check completion, name, and content. |
| Confirmation dialog | [PreferencesPage](src/pages/preferences-page.ts) | Scope the action to the named HTML dialog, not another matching button. |
| New tab | [PreferencesPage](src/pages/preferences-page.ts) | Register the popup listener before clicking; close the page after use. |
| Embedded form | [PreferencesPage](src/pages/preferences-page.ts) | Use a frame locator with an explicit frame boundary. |
| Token multi-select | [TokenMultiSelect](src/components/token-multi-select.ts) | Replace the complete selection in a fully loaded ARIA listbox; explicit names and disabled choices. |
| Custom date calendar | [CalendarPicker](src/components/calendar-picker.ts) | Validate date-only ISO values and navigate a bounded number of months. |
| Paged tables | [PaginatedTable](src/components/paginated-table.ts) and [OrdersPage](src/pages/orders-page.ts) | Exact row keys, explicit readiness, and bounded searches across pages. |
| Table filters and sorting | [OrdersPage](src/pages/orders-page.ts) | Wait for committed rows; keep query and column behavior application-specific. |
| Browser storage | [browser-storage](src/support/browser-storage.ts) | Seed missing keys before navigation, restricted to one HTTP(S) origin. |
| Authenticated tests | [existing fixtures](src/fixtures/test.ts) | Create a test session through the demo API and reuse its in-memory storage state. |

The [tests](tests/patterns/control-patterns.ui.spec.ts) show both the page-object calls and the observable results. They also cover duplicate choices, disabled controls, selection clearing, a partial selection, reloads, foreign origins, and separate browser contexts.

## Adapt one page, not the whole framework

```ts
import { type Page } from '@playwright/test';
import { CheckboxGroup, NativeSelect } from './src/components/form-controls.ts';

export class AccountSettingsPage {
  readonly country: NativeSelect;
  readonly notices: CheckboxGroup<'billing' | 'security'>;

  constructor(page: Page) {
    this.country = new NativeSelect(page.getByLabel('Country', { exact: true }));
    const group = page.getByRole('group', { name: 'Notices', exact: true });
    this.notices = new CheckboxGroup({
      billing: group.getByRole('checkbox', { name: 'Billing', exact: true }),
      security: group.getByRole('checkbox', { name: 'Security', exact: true }),
    });
  }
}
```

Adjust import paths for your project. Map your application's real accessible names in this page object. A test can then call `await settings.country.chooseLabel('India')` and `await settings.notices.setSelected(['security'])` without knowing the selectors. Assertions about the saved account belong in the test, not in a general control helper.

### Dropdowns are not interchangeable

`NativeSelect` is for HTML `select` elements. `SearchCombobox` is for an editable input that filters a list of ARIA options. It accepts the listbox separately so the list can live in a portal. It does not implement virtual scrolling, multi-value tokens, or a read-only combobox. Give those widgets their own small adapter and tests rather than adding arbitrary fallbacks.

### Checkbox replacement has a clear meaning

`CheckboxGroup` supports binary native checkboxes. Mixed-state controllers and custom ARIA checkboxes need separate adapters; preflight rejects them rather than quietly leaving a mixed state unchanged.

`setSelected(['email'])` checks email and clears the other mapped choices. Repeating the call has the same result. An unknown key, duplicate key, or an incompatible disabled choice fails before any selection is changed. A failure that occurs later during interaction is not rolled back; the operation is not a transaction. Controls that become enabled asynchronously need an application-specific readiness check before calling it.

## Storage without a shared global object

Different kinds of state have different owners:

- Environment configuration belongs in validated configuration, not browser storage.
- Test data belongs to the test or a fixture. Do not share mutable objects between parallel tests.
- Cookies and local storage used for authentication can be transferred with Playwright storage state. The existing demo fixture keeps this in memory.
- Session storage is not included automatically in that authentication state. Capture and restore it explicitly only when your application needs it.

```ts
await seedBrowserStorage(context, {
  origin: baseURL,
  local: { theme: 'dark' },
  session: { locale: 'en' },
});
await page.goto('/login');
```

Register the seed once on a fresh context, before navigation. It applies to future documents at the specified origin and only fills absent keys. Empty strings and values changed by the application survive a reload. It does not change the current document retroactively. Use separate contexts for tests that need different initial state.

Local storage is shared by pages within that context and origin. Session storage follows the browser's per-tab rules, including initial copying in some opener scenarios; this helper does not redefine those rules. The helper does not clear, encrypt, or validate application tokens. Do not seed real credentials into these examples.

`captureSessionStorage` checks the current page origin, but its result may still contain secrets in a real application. Keep snapshots in memory. Do not put them in reports, logs, commits, or public CI artifacts. Traces, screenshots, and downloaded files from a real application also need a separate data-handling policy.

## What these tests prove

The [synthetic view](examples/patterns/preferences-view.ts) deliberately includes two Email checkboxes in different groups, East and East Coast options, a disabled choice, and a mixed select-all state. This makes incorrect scoping and prefix matching visible. The view is served through a test-only Playwright route on the local demo origin, separate from the demo application's security headers; it is not a deployed application or a backend integration test.

The cases check the supported DOM contracts in Chromium and Firefox. They do not certify another application's accessibility, authentication, performance, or production readiness. The existing task-board UI and API tests cover a separate demo workflow.

## Boundaries and next additions

These examples cover common controls, paged tables, a token multi-select, a single-date calendar, and browser state. They do not yet cover date ranges, time pickers, virtualized grids, drag-and-drop, shadow DOM, async/virtualized multi-selects, SSO/MFA, or WebKit. Add an adapter when there is a concrete widget contract to test. Avoid a universal BasePage with guessed selectors, fixed sleeps, swallowed failures, or forced clicks.

When adding a pattern, include a working view, a positive case, an important failure case, and the limits a reader needs before copying it. Useful examples should be easy to run and easy to remove when the application has a simpler direct Playwright call.


## Paged tables: search a key, not a row number

[OrdersPage](src/pages/orders-page.ts) supplies the named table, First/Next controls, a visible page marker, and a readiness callback to [PaginatedTable](src/components/paginated-table.ts). A row is identified by an exact, unique rowheader key. ORD-10 must not match ORD-100. Business actions stay in the page object:

```ts
await orders.filterStatus('open');
await orders.approve('ORD-400', 10);
```

The search resets to the first page of the current filter and sort, then scans at most the supplied budget (default 20, supported range 1–100). It stops on the last page, an ambiguous key on the current page, a repeated marker, or a load failure. It never chooses the first duplicate or retries an action against a guessed row. Keys must be unique within the result set; the helper does not scan later pages to prove global uniqueness after finding a match.

The readiness callback is part of the application contract. Resolve only after rows, navigation controls, and the page marker are committed. Reject an error state even if old rows remain visible. This example uses data-state and aria-busy; use your application's own explicit signals when adapting it. A click completing or a spinner disappearing is not proof that the requested data loaded successfully. A page marker must change after moving between pages. A stalled marker fails through Playwright's assertion timeout.

Amount sorting is deliberately a two-state ascending/descending header in this view. The tests compare numeric amounts and verify that requesting the current direction does not reload the table. A three-state header, server cursor, infinite scroll, or virtualized grid needs a different adapter. Row actions may remove a row from a filtered result set, so the page object does not assume that an approved row must remain visible.

The [table tests](tests/patterns/table-patterns.ui.spec.ts) intercept a small simulated API with per-test records. They cover exact and off-page matches, filtering, sorting, row removal, missing and duplicate keys, invalid/exhausted budgets, a pagination loop, and a failed request that retains stale rows. The [view](examples/patterns/orders-view.ts) makes real browser fetch calls to those intercepted routes. This is a component-contract test, not coverage of a real order service, authorization, or backend persistence.


## Token multi-select: replace the selection, do not keep toggling

[BookingPage](src/pages/booking-page.ts) maps stable keys to unique option names. [TokenMultiSelect](src/components/token-multi-select.ts) owns the interaction with a fully loaded, non-virtualized ARIA listbox. Unlike a native multi-select, this widget exposes aria-selected on each option and a separate Done button. Its options can be portalled outside the page section.

```ts
await booking.participants.setSelected(['alice-jones', 'bob']);
await booking.participants.setSelected([]);
```

The supplied name map must describe the complete option set. The helper checks the option count and exact names; Alice must not match Alice Jones. It validates every option's binary selection state and checks disabled choices before changing one. Repeating a selection must not toggle those options off. Duplicate or unknown keys and duplicate configured names fail before the panel opens.

A preflight error after opening the panel leaves it open for investigation but does not change the selection. An interaction that fails later is not rolled back. A successful operation closes the panel and checks aria-expanded. Adapters for asynchronous search, virtual scrolling, remote suggestions, or a different close/commit model should be separate; increasing timeouts does not make this contract fit them.

The view includes exact token removal, keyboard option navigation that skips disabled choices, Space activation, and Escape dismissal with focus restoration. The tests exercise those behaviors. They are not a full accessibility audit or a replacement for testing with assistive technology.

## Calendar: date-only values, bounded navigation

[CalendarPicker](src/components/calendar-picker.ts) works with a single-date Gregorian calendar: a dialog, previous/next buttons, a YYYY-MM month marker, and one uniquely named button per full YYYY-MM-DD date. Adjacent-month buttons may share day numbers, so locating a button by just 1 or 29 is intentionally avoided.

The input and dialog deliberately share the Start date name. BookingPage intersects the field label with an input locator and exposes startDateValue for assertions. An exact label alone is not enough when more than one element has that accessible name.

```ts
await booking.startDate.choose('2028-02-29', 0);
```

The optional budget limits month moves, not the day number (default 12, supported range 0–120). Invalid dates, including impossible leap days, fail before opening the calendar. A target beyond the budget opens the panel to read its current month but does not navigate. Each navigation must advance exactly one month; disabled navigation and unexpected jumps fail without selecting a day. An unavailable day cannot overwrite the saved value. Navigation failures can leave the panel at the last visited month; they are not transactional.

The selected value remains a date-only string. The helper does not convert it through a timezone-dependent Date object. The synthetic view uses fixed 2028–2029 bounds, UTC month rendering, and one unavailable date so tests do not depend on today's date or the machine clock. Cases include a leap day, Gregorian century rules, a year boundary, backward navigation, month budgets, disabled dates, a faulty two-month jump, cancellation, keyboard day activation, and a non-UTC browser context.

Only button activation and Escape/focus behavior are demonstrated for the calendar. A complete calendar-grid keyboard model, localized/non-Gregorian calendars, date ranges, and time selection need their own contracts and tests. The month marker must update after the new month's controls are committed; add an application-specific readiness check if your widget fetches availability asynchronously.

Run [booking-patterns.ui.spec.ts](tests/patterns/booking-patterns.ui.spec.ts) to see the calls and their observable results. Its [synthetic view](examples/patterns/booking-view.ts) is a test fixture, not a published booking product or a UI component package to ship to users.
