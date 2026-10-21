import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { accounts, type Role } from '../examples/demo-app/accounts.ts';
import type { Booking, BookingInput } from '../examples/demo-app/booking-store.ts';
import { BookingWorkspace } from '../src/pages/booking-workspace.ts';

const draft: BookingInput = { title: 'Architecture review', startDate: '2028-02-29', participants: ['alice-jones', 'bob'] };
const test = base.extend<{ role: Role; booking: BookingWorkspace }>({
  role: ['editor', { option: true }],
  booking: async ({ page, role }, use) => {
    // This suite signs in through the UI; API checks share the browser's cookie jar.
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(accounts[role].email);
    await page.getByLabel('Password', { exact: true }).fill(accounts[role].password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/board$/);
    try { await use(new BookingWorkspace(page)); }
    finally { expect((await page.request.delete('/api/session')).status()).toBe(204); }
  },
});

test('sign in, save through the widgets, and find the persisted record on a later page', async ({ page, booking }) => {
  // Arrange unrelated records through the real API, not mocked rows.
  for (const title of ['Existing planning', 'Existing review']) {
    const seeded = await page.request.post('/api/bookings', { headers: { 'Idempotency-Key': randomUUID() }, data: { ...draft, title } });
    expect(seeded.status()).toBe(201);
  }
  await page.getByRole('link', { name: 'Bookings', exact: true }).click();
  await booking.waitForReady();
  await booking.fillDraft(draft);
  const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/bookings' && value.request().method() === 'POST');
  await booking.save();
  const saved = await response; expect(saved.status()).toBe(201);
  const record = await saved.json() as Booking;
  expect(record.reference).toBe('BK-003');
  const read = await page.request.get('/api/bookings/' + record.id);
  expect(read.status()).toBe(200); expect(await read.json()).toMatchObject(draft);
  const row = await booking.table.findRow(record.reference);
  await expect(row.getByRole('cell', { name: draft.title, exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: draft.startDate, exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: 'Alice Jones, Bob', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Booking page', exact: true })).toHaveText('Page 2 of 2');
  expect(await (await page.request.get('/api/bookings?pageSize=10')).json()).toMatchObject({ total: 3 });
});

test('a server-rejected draft preserves the entered fields without creating a record', async ({ page, booking }) => {
  await booking.goto();
  await page.getByLabel('Booking title', { exact: true }).fill('Keep this draft');
  const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/bookings' && value.request().method() === 'POST');
  await booking.save(); expect((await response).status()).toBe(400);
  await expect(page.getByRole('alert')).toContainText('available date');
  await expect(page.getByLabel('Booking title', { exact: true })).toHaveValue('Keep this draft');
  await expect(page.getByRole('button', { name: 'Remove Alice', exact: true })).toBeVisible();
  expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
});

test('a temporary server failure preserves the draft and permits a successful retry', async ({ page, booking }) => {
  await booking.goto(); await booking.fillDraft(draft);
  // Fault injection only: the happy path never intercepts a response.
  await page.route('**/api/bookings', route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable.' } }), { times: 1 });
  await booking.save();
  await expect(page.getByRole('alert')).toHaveText('Temporarily unavailable.');
  await expect(page.getByLabel('Booking title', { exact: true })).toHaveValue(draft.title);
  await expect(booking.controls.startDateValue).toHaveValue(draft.startDate);
  expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
  await booking.save();
  await expect(page.getByRole('status', { name: 'Booking result', exact: true })).toHaveText('Saved BK-001');
  expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 1 });
});

test('a lost response after the server commits is recovered with the same request key', async ({ page, booking }) => {
  await booking.goto(); await booking.fillDraft(draft);
  let originalKey: string | undefined;
  await page.route('**/api/bookings', async route => {
    originalKey = route.request().headers()['idempotency-key'];
    const committed = await route.fetch({ maxRetries: 0 }); expect(committed.status()).toBe(201);
    await route.abort('failed');
  }, { times: 1 });
  await booking.save();
  await expect(page.getByRole('alert')).toHaveText('Could not confirm save. Retry uses the same request key.');
  expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 1 });
  const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/bookings' && value.request().method() === 'POST');
  await booking.save();
  const replay = await response; expect(replay.status()).toBe(200);
  expect(originalKey).toBeTruthy(); expect(replay.request().headers()['idempotency-key']).toBe(originalKey);
  expect(replay.headers()['idempotent-replay']).toBe('true');
  await expect(page.getByRole('status', { name: 'Booking result', exact: true })).toHaveText('Saved BK-001 (request replayed)');
  expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 1 });
});

test('submitting the same confirmed draft twice does not create a second booking', async ({ page, booking }) => {
  await booking.goto(); await booking.fillDraft(draft); await booking.save(); await booking.save();
  await expect(page.getByRole('status', { name: 'Booking result', exact: true })).toHaveText('Saved BK-001 (request replayed)');
  expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 1 });
});

test('booking titles render as literal text rather than HTML', async ({ page, booking }) => {
  const title = '<img src=x onerror=alert(1)>';
  await booking.goto(); await booking.fillDraft({ ...draft, title }); await booking.save();
  const row = await booking.table.findRow('BK-001');
  await expect(row.getByRole('cell', { name: title, exact: true })).toBeVisible();
  await expect(row.locator('img')).toHaveCount(0);
  expect((await (await page.request.get('/api/bookings')).json()).bookings[0].title).toBe(title);
});

test('failed pagination does not treat stale visible rows as current results', async ({ page, booking }) => {
  for (const title of ['One', 'Two', 'Three']) expect((await page.request.post('/api/bookings', { headers: { 'Idempotency-Key': randomUUID() }, data: { ...draft, title } })).status()).toBe(201);
  await booking.goto();
  await page.route(url => url.pathname === '/api/bookings' && url.searchParams.get('page') === '2', route => route.fulfill({ status: 503, json: { error: 'Synthetic read outage' } }), { times: 1 });
  await expect(booking.table.findRow('BK-003')).rejects.toThrow('Booking results failed to load');
  await expect(page.getByRole('rowheader', { name: 'BK-001', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Existing rows may be out of date');
  expect(await (await page.request.get('/api/bookings?pageSize=10')).json()).toMatchObject({ total: 3 });
});

test.describe('viewer workspace', () => {
  test.use({ role: 'viewer' });
  test('read-only users do not get an editor form and cannot bypass it through the API', async ({ page, booking }) => {
    await booking.goto();
    await expect(page.getByRole('button', { name: 'Save booking', exact: true })).toHaveCount(0);
    const denied = await page.request.post('/api/bookings', { headers: { 'Idempotency-Key': randomUUID() }, data: draft });
    expect(denied.status()).toBe(403); expect(await (await page.request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
  });
});
