# Accessibility and keyboard checks

The accessibility suite scans the login form, editor and viewer boards, booking editor, invalid draft, failed save, participant list, and open calendar. It uses axe WCAG 2 A/AA and 2.1 A/AA tags. Keyboard tests exercise sign-in, participant movement/selection and calendar dismissal with focus restoration.

The initial calendar scan found a label-content-name mismatch: a button displayed `6` but its accessible name was `2028-02-06`. The label now includes both the visible day and full date: `6 (2028-02-06)`. The page-object mapping follows the accessible name; the reusable calendar component still accepts an ISO date. The scan failed before this correction, rather than filtering the finding out.

Run the suite with:

```sh
npx playwright test tests/accessibility.ui.spec.ts
```

These checks run in Chromium, Firefox and WebKit. They do not establish full WCAG compliance or reproduce a screen reader user's experience. No manual screen-reader or inclusive-user assessment has been completed. Before adopting the widgets, manually inspect focus visibility, zoom/reflow, announcement order, calendar navigation effort and selection behavior with your supported assistive technologies. Record actual observations, not a checklist marked complete by assumption.

## Tooling choices

`npm run lint` checks floating promises throughout the TypeScript sources. Existing application formatting is retained to keep the change reviewable. Prettier checks the newly added accessibility suite and lint configuration; this is not a claim that the whole repository has been reformatted. Extend that scope deliberately when editing other files.

The lint toolchain required a minimatch override to 11.0.1 because the resolved older versions were affected by [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). Node 24 is the supported runtime. Lint execution and dependency installation were verified with the override. Remove it when upstream dependency ranges resolve a fixed version without it; rerun lint and dependency checks when doing so.

On macOS, WebKit uses Option+Tab for full keyboard navigation to buttons under the default keyboard-access setting. The login test uses that gesture on macOS WebKit and Tab on other tested configurations; it still asserts the focused control before submitting. This is platform behavior, not a skipped keyboard assertion.
