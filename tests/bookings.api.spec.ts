import { randomUUID } from 'node:crypto';
import { test, expect } from '../src/fixtures/test.ts';
import { signIn } from '../src/api/demo-session.ts';
import type { Booking, BookingInput } from '../examples/demo-app/booking-store.ts';

const draft: BookingInput = { title: 'Planning session', startDate: '2028-02-29', participants: ['bob', 'alice'] };
const headers = () => ({ 'Idempotency-Key': randomUUID() });

test('booking creation returns the canonical record and supports reading it back', async ({ request }) => {
  const response = await request.post('/api/bookings', { headers: headers(), data: { ...draft, title: '  Planning session  ' } });
  expect(response.status()).toBe(201);
  expect(response.headers()['idempotent-replay']).toBe('false');
  const booking = await response.json() as Booking;
  expect(booking).toMatchObject({ title: 'Planning session', startDate: draft.startDate, participants: ['alice', 'bob'], reference: 'BK-001' });
  const read = await request.get('/api/bookings/' + booking.id);
  expect(read.status()).toBe(200); expect(await read.json()).toEqual(booking);
  expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 1, page: 1, totalPages: 1 });
});

test('unauthenticated API access is rejected and the booking page redirects to sign-in', async ({ playwright, baseURL }) => {
  if (!baseURL) throw new Error('A base URL is required.');
  const outsider = await playwright.request.newContext({ baseURL });
  try {
    for (const path of ['/api/bookings', '/api/bookings/options', '/api/bookings/' + randomUUID()]) expect((await outsider.get(path)).status()).toBe(401);
    expect((await outsider.post('/api/bookings', { headers: headers(), data: draft })).status()).toBe(401);
    const page = await outsider.get('/bookings', { maxRedirects: 0 });
    expect(page.status()).toBe(303); expect(page.headers().location).toBe('/login');
  } finally { await outsider.dispose(); }
});

test('invalid fields, dates, and participant sets do not create records', async ({ request }) => {
  const invalid: unknown[] = [null, [], {}, { ...draft, title: '' }, { ...draft, title: 'x'.repeat(81) },
    { ...draft, startDate: '2028-02-30' }, { ...draft, startDate: '2028-02-14' }, { ...draft, startDate: '2027-12-31' },
    { ...draft, participants: [] }, { ...draft, participants: ['alice', 'alice'] }, { ...draft, participants: ['evan'] },
    { ...draft, participants: ['unknown'] }, { ...draft, participants: [42] }, { ...draft, extra: true }];
  for (const data of invalid) {
    const response = await request.post('/api/bookings', { headers: { ...headers(), 'Content-Type': 'application/json' }, data: JSON.stringify(data) });
    expect(response.status()).toBe(400); expect(await response.json()).toHaveProperty('error');
  }
  expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
});

test('malformed, oversized, and wrong-content-type requests are rejected', async ({ request }) => {
  expect((await request.post('/api/bookings', { headers: { ...headers(), 'Content-Type': 'application/json' }, data: '{' })).status()).toBe(400);
  expect((await request.post('/api/bookings', { headers: { ...headers(), 'Content-Type': 'application/json' }, data: JSON.stringify({ ...draft, title: 'x'.repeat(9000) }) })).status()).toBe(413);
  expect((await request.post('/api/bookings', { headers: { ...headers(), 'Content-Type': 'text/plain' }, data: 'not JSON' })).status()).toBe(415);
  expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
});

test('missing or invalid idempotency keys do not create records', async ({ request }) => {
  expect((await request.post('/api/bookings', { data: draft })).status()).toBe(400);
  for (const key of ['short', 'x'.repeat(81), 'not a valid request key']) {
    expect((await request.post('/api/bookings', { headers: { 'Idempotency-Key': key }, data: draft })).status()).toBe(400);
  }
  expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
});

test('the same key and equivalent payload replay the original record', async ({ request }) => {
  const key = headers();
  const first = await request.post('/api/bookings', { headers: key, data: draft });
  const repeat = await request.post('/api/bookings', { headers: key, data: { ...draft, participants: ['alice', 'bob'] } });
  expect(first.status()).toBe(201); expect(repeat.status()).toBe(200);
  expect(repeat.headers()['idempotent-replay']).toBe('true'); expect(await repeat.json()).toEqual(await first.json());
  expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 1 });
});

test('reusing a successful key for a different booking returns a conflict', async ({ request }) => {
  const key = headers();
  const first = await request.post('/api/bookings', { headers: key, data: draft }); expect(first.status()).toBe(201);
  expect((await request.post('/api/bookings', { headers: key, data: { ...draft, title: 'Different intent' } })).status()).toBe(409);
  const list = await (await request.get('/api/bookings')).json(); expect(list.total).toBe(1); expect(list.bookings[0].title).toBe(draft.title);
});

test('concurrent duplicate requests produce one record', async ({ request }) => {
  const key = headers();
  const responses = await Promise.all([request.post('/api/bookings', { headers: key, data: draft }), request.post('/api/bookings', { headers: key, data: draft })]);
  expect(responses.map(response => response.status()).sort()).toEqual([200, 201]);
  expect(await responses[0]!.json()).toEqual(await responses[1]!.json());
  expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 1 });
});

test('sessions cannot read each other records or idempotency entries', async ({ request, playwright, baseURL }) => {
  const key = headers();
  const created = await request.post('/api/bookings', { headers: key, data: draft }); expect(created.status()).toBe(201);
  const ownerRecord = await created.json() as Booking;
  if (!baseURL) throw new Error('A base URL is required.');
  const other = await playwright.request.newContext({ baseURL });
  try {
    await signIn(other, 'editor');
    expect((await other.get('/api/bookings/' + ownerRecord.id)).status()).toBe(404);
    expect(await (await other.get('/api/bookings')).json()).toMatchObject({ total: 0 });
    const own = await other.post('/api/bookings', { headers: key, data: { ...draft, title: 'Other session' } });
    expect(own.status()).toBe(201); expect((await own.json()).id).not.toBe(ownerRecord.id);
    expect((await (await request.get('/api/bookings/' + ownerRecord.id)).json()).title).toBe(draft.title);
  } finally { await other.delete('/api/session'); await other.dispose(); }
});

test('foreign browser origins cannot mutate booking data', async ({ request }) => {
  const response = await request.post('/api/bookings', { headers: { ...headers(), Origin: 'https://other.example' }, data: draft });
  expect(response.status()).toBe(403); expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
});

test('pagination is bounded and malformed query values are rejected', async ({ request }) => {
  for (const title of ['First', 'Second', 'Third']) expect((await request.post('/api/bookings', { headers: headers(), data: { ...draft, title } })).status()).toBe(201);
  const second = await request.get('/api/bookings?page=2&pageSize=2'); expect(second.status()).toBe(200);
  expect(await second.json()).toMatchObject({ page: 2, totalPages: 2, total: 3, bookings: [{ title: 'Third' }] });
  for (const query of ['page=0', 'page=1.5', 'page=101', 'page=1&page=2', 'pageSize=11', 'page=3', 'extra=1']) expect((await request.get('/api/bookings?' + query)).status()).toBe(400);
});

test('the new page has a local-only CSP while task-board policy is unchanged', async ({ request }) => {
  const booking = await request.get('/bookings'); expect(booking.status()).toBe(200);
  const policy = booking.headers()['content-security-policy'];
  expect(policy).toContain("default-src 'none'"); expect(policy).toContain("script-src 'self'"); expect(policy).toContain("connect-src 'self'"); expect(policy).not.toContain('unsafe-inline');
  const board = await request.get('/board'); expect(board.headers()['content-security-policy']).toBe("default-src 'none'; form-action 'self'; frame-ancestors 'none'");
});

test('logout revokes access to booking records', async ({ request }) => {
  const created = await request.post('/api/bookings', { headers: headers(), data: draft }); expect(created.status()).toBe(201);
  const booking = await created.json() as Booking;
  expect((await request.delete('/api/session')).status()).toBe(204);
  expect((await request.get('/api/bookings/' + booking.id)).status()).toBe(401);
});

test.describe('viewer booking permissions', () => {
  test.use({ role: 'viewer' });
  test('viewers may read their empty collection but cannot create a booking', async ({ request }) => {
    expect((await request.get('/api/bookings/options')).status()).toBe(200);
    expect((await request.post('/api/bookings', { headers: headers(), data: draft })).status()).toBe(403);
    expect(await (await request.get('/api/bookings')).json()).toMatchObject({ total: 0 });
  });
});
