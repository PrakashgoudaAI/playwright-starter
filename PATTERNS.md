# Reusable Playwright patterns

Start with the control you need, then keep the application-specific labels and business actions in your page object. These examples are small on purpose: a native select, an editable combobox, and a checkbox group should not share a catch-all click helper.

## Run the examples

Use the Node version specified in package.json. From a fresh checkout:

```sh
npm ci
npx playwright install --with-deps chromium firefox
npm run check
npx playwright test tests/patterns/control-patterns.ui.spec.ts
```

The existing configuration starts the local demo server and runs the pattern tests in Chromium and Firefox. No external website, account, or API key is needed. To inspect one browser interactively:

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

The [synthetic view](examples/patterns/preferences-view.ts) deliberately includes two Email checkboxes in different groups, East and East Coast options, a disabled choice, and a mixed select-all state. This makes incorrect scoping and prefix matching visible. The view is mounted with `page.setContent` on the local demo origin; it is not a deployed application or a backend integration test.

The cases check the supported DOM contracts in Chromium and Firefox. They do not certify another application's accessibility, authentication, performance, or production readiness. The existing task-board UI and API tests cover a separate demo workflow.

## Boundaries and next additions

This first set covers common controls and browser state. It does not yet cover custom calendar widgets, virtualized grids, pagination, drag-and-drop, shadow DOM, complex multi-selects, SSO/MFA, or WebKit. Add an adapter when there is a concrete widget contract to test. Avoid a universal BasePage with guessed selectors, fixed sleeps, swallowed failures, or forced clicks.

When adding a pattern, include a working view, a positive case, an important failure case, and the limits a reader needs before copying it. Useful examples should be easy to run and easy to remove when the application has a simpler direct Playwright call.
