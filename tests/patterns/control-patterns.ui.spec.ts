import { test as base, expect } from '@playwright/test';
import { preferencesView } from '../../examples/patterns/preferences-view.ts';
import { PreferencesPage } from '../../src/pages/preferences-page.ts';
import { captureSessionStorage, seedBrowserStorage } from '../../src/support/browser-storage.ts';

const test = base.extend<{ preferences: PreferencesPage }>({
  preferences: async ({ page }, use) => {
    await page.goto('/login');
    await page.setContent(preferencesView);
    await use(new PreferencesPage(page));
  },
});

test('native select chooses an option by its visible label', async ({ page, preferences }) => {
  await preferences.plan.chooseLabel('Team');
  await expect(page.getByLabel('Plan', { exact: true })).toHaveValue('team');
});

test('native multi-select replaces and clears selected values', async ({ page, preferences }) => {
  await preferences.languages.chooseValues(['en', 'fr']);
  await expect(page.getByLabel('Languages')).toHaveValues(['en', 'fr']);
  await preferences.languages.chooseValues([]);
  await expect(page.getByLabel('Languages')).toHaveValues([]);
});

test('multi-select API rejects a single select', async ({ preferences }) => {
  await expect(preferences.plan.chooseValues(['basic', 'team'])).rejects.toThrow('requires a native multi-select');
});

test('checkbox replacement is exact, repeatable, and scoped', async ({ page, preferences }) => {
  const other = page.getByRole('group', { name: 'Other settings' }).getByRole('checkbox', { name: 'Email' });
  await other.check();
  await preferences.channels.setSelected(['email', 'sms']);
  await preferences.channels.setSelected(['email']);
  await preferences.channels.setSelected(['email']);
  const group = page.getByRole('group', { name: 'Notification channels' });
  await expect(group.getByRole('checkbox', { name: 'Email', exact: true })).toBeChecked();
  await expect(group.getByRole('checkbox', { name: 'SMS', exact: true })).not.toBeChecked();
  await expect(other).toBeChecked();
});

test('duplicate checkbox choices fail without changing selection', async ({ page, preferences }) => {
  await expect(preferences.channels.setSelected(['email', 'email'])).rejects.toThrow('must be unique');
  await expect(page.getByRole('group', { name: 'Notification channels' }).getByRole('checkbox', { name: 'Email', exact: true })).not.toBeChecked();
});

test('disabled checkbox preflight prevents partial changes', async ({ page, preferences }) => {
  await preferences.channels.setSelected(['email']);
  await expect(preferences.channels.setSelected(['sms', 'push'])).rejects.toThrow('disabled checkbox');
  const group = page.getByRole('group', { name: 'Notification channels' });
  await expect(group.getByRole('checkbox', { name: 'Email', exact: true })).toBeChecked();
  await expect(group.getByRole('checkbox', { name: 'SMS', exact: true })).not.toBeChecked();
});

test('searchable combobox selects an exact option rather than a prefix match', async ({ page, preferences }) => {
  await preferences.region.choose('East');
  await expect(page.getByRole('combobox', { name: 'Region' })).toHaveValue('East');
  await expect(page.getByRole('listbox', { name: 'Regions' })).toBeHidden();
});

test('radio and native date actions compose into a form workflow', async ({ page, preferences }) => {
  await preferences.setDigest('Weekly');
  await preferences.setDueDate('2026-11-12');
  await preferences.save();
  await expect(page.getByRole('radio', { name: 'Weekly' })).toBeChecked();
  await expect(page.getByLabel('Due date')).toHaveValue('2026-11-12');
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Preferences saved');
});

test('uploads use in-memory files and can be cleared', async ({ page, preferences }) => {
  await preferences.attachFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic notes') },
    { name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from('id\n1') },
  ]);
  await expect(page.getByLabel('Attached files')).toHaveText('notes.txt, data.csv');
  await preferences.attachFiles([]);
  await expect(page.getByLabel('Attached files')).toHaveText('');
});

test('downloads verify the completed file name and contents', async ({ preferences }) => {
  const download = await preferences.exportPreferences();
  expect(download.suggestedFilename()).toBe('preferences.txt');
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream is unavailable.');
  let contents = '';
  for await (const chunk of stream) contents += chunk.toString();
  expect(contents).toBe('synthetic preferences');
});

test('confirmation dialog is scoped to its own action', async ({ page, preferences }) => {
  await preferences.confirmDeletion();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Preferences deleted');
});

test('popup handling registers its listener before opening the tab', async ({ page, preferences }) => {
  const popup = await preferences.openHelp();
  try {
    await expect(popup).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Preferences', exact: true })).toBeVisible();
  } finally {
    await popup.close();
  }
});

test('iframe fields remain in their frame scope', async ({ page, preferences }) => {
  await preferences.setEmbeddedReference('case-104');
  await expect(page.frameLocator('iframe[title="Embedded details"]').getByLabel('Internal reference')).toHaveValue('case-104');
});

test('select-all handles a mixed native checkbox state', async ({ page, preferences }) => {
  await page.getByRole('checkbox', { name: 'Row A', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Select all rows' })).toHaveJSProperty('indeterminate', true);
  await preferences.selectAllRows(true);
  await expect(page.getByRole('checkbox', { name: 'Row B', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select all rows' })).toHaveJSProperty('indeterminate', false);
  await preferences.selectAllRows(false);
  await expect(page.getByRole('checkbox', { name: 'Row A', exact: true })).not.toBeChecked();
});

test('storage is seeded before navigation and session values stay in memory', async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required.');
  await seedBrowserStorage(context, { origin: baseURL, local: { theme: 'dark' }, session: { locale: 'en' } });
  await page.goto('/login');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  expect(await captureSessionStorage(page, baseURL)).toEqual({ locale: 'en' });
});

test('storage seeding preserves application updates and empty values on reload', async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required.');
  await seedBrowserStorage(context, { origin: baseURL, local: { theme: 'dark' }, session: { locale: 'en' } });
  await page.goto('/login');
  await page.evaluate(() => { localStorage.setItem('theme', ''); sessionStorage.setItem('locale', 'fr'); });
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('');
  expect(await captureSessionStorage(page, baseURL)).toEqual({ locale: 'fr' });
});

test('origin checks do not seed another site or snapshot its session', async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required.');
  await seedBrowserStorage(context, { origin: baseURL, local: { theme: 'dark' }, session: { locale: 'en' } });
  await context.route('https://other.example/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Other site</h1>' }));
  await page.goto('https://other.example/preferences');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('locale'))).toBeNull();
  await expect(captureSessionStorage(page, baseURL)).rejects.toThrow('origin does not match');
});

test('a separate browser context does not inherit storage', async ({ page, browser, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required.');
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('theme', 'private-to-this-context'));
  const isolated = await browser.newContext({ baseURL });
  try {
    const other = await isolated.newPage();
    await other.goto('/login');
    expect(await other.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  } finally {
    await isolated.close();
  }
});

test('storage configuration rejects paths and non-string values before registration', async ({ context, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required.');
  await expect(seedBrowserStorage(context, { origin: baseURL + '/path' })).rejects.toThrow('requires an HTTP(S) origin');
  await expect(seedBrowserStorage(context, { origin: 'file:///tmp' })).rejects.toThrow('requires an HTTP(S) origin');
  await expect(seedBrowserStorage(context, { origin: baseURL, local: { theme: 42 } as unknown as Record<string, string> })).rejects.toThrow('string-record limits');
});
