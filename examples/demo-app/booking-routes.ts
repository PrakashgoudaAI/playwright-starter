import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import type { Role } from './accounts.ts';
import { BookingProblem, BookingStore, bookingOptions } from './booking-store.ts';

type Session = { role: Role };
const stores = new WeakMap<Session, BookingStore>();
const html = readFileSync(new URL('./booking.html', import.meta.url), 'utf8');
const client = stripTypeScriptTypes(readFileSync(new URL('./booking-client.ts', import.meta.url), 'utf8'), { mode: 'strip' });
const css = readFileSync(new URL('./booking.css', import.meta.url), 'utf8');
const assets = new Map([
  ['/assets/booking.js', { body: client, type: 'text/javascript; charset=utf-8' }],
  ['/assets/booking.css', { body: css, type: 'text/css; charset=utf-8' }],
]);

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJSON(req: IncomingMessage): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw new BookingProblem(415, 'Use application/json.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += bytes.length;
    if (size <= 8192) chunks.push(bytes);
  }
  if (size > 8192) throw new BookingProblem(413, 'Booking request exceeds 8 KiB.');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new BookingProblem(400, 'Use valid JSON.'); }
}

function paging(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (!/^[1-9]\d{0,2}$/.test(value)) throw new BookingProblem(400, 'Use positive decimal page parameters.');
  return Number(value);
}

/** Called after the host server checks cookie expiry and rejects foreign write origins. */
export async function handleBookingRequest(req: IncomingMessage, res: ServerResponse, context: {
  path: string; method: string; session: Session | undefined; baseURL: string;
}): Promise<boolean> {
  const { path, method, session, baseURL } = context;
  const asset = assets.get(path);
  if (asset && method === 'GET') { res.writeHead(200, { 'Content-Type': asset.type }); res.end(asset.body); return true; }
  if (path !== '/bookings' && path !== '/api/bookings' && !path.startsWith('/api/bookings/')) return false;
  if (!session) {
    if (path === '/bookings') { res.writeHead(303, { Location: '/login' }); res.end(); }
    else json(res, 401, { error: 'Sign in required.' });
    return true;
  }
  try {
    if (path === '/bookings' && method === 'GET') {
      // This new page needs local script/style/fetch. Existing task-board headers are unchanged.
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return true;
    }
    if (path === '/api/bookings/options' && method === 'GET') { json(res, 200, bookingOptions); return true; }
    let store = stores.get(session);
    if (!store) { store = new BookingStore(); stores.set(session, store); }
    if (path === '/api/bookings' && method === 'GET') {
      const query = new URL(req.url ?? '/', baseURL).searchParams;
      for (const key of query.keys()) {
        if (!['page', 'pageSize'].includes(key) || query.getAll(key).length !== 1) throw new BookingProblem(400, 'Unexpected or repeated page parameter.');
      }
      json(res, 200, store.list(paging(query.get('page'), 1), paging(query.get('pageSize'), 2))); return true;
    }
    if (path === '/api/bookings' && method === 'POST') {
      if (session.role !== 'editor') throw new BookingProblem(403, 'Editor role required.');
      const header = req.headers['idempotency-key'];
      if (typeof header !== 'string') throw new BookingProblem(400, 'An idempotency key is required.');
      const result = store.create(await readJSON(req), header);
      res.setHeader('Idempotent-Replay', String(result.replay));
      json(res, result.replay ? 200 : 201, result.booking); return true;
    }
    const match = /^\/api\/bookings\/([0-9a-f-]{36})$/.exec(path);
    if (match && method === 'GET') {
      const booking = store.get(match[1]!);
      json(res, booking ? 200 : 404, booking ?? { error: 'Booking not found.' }); return true;
    }
    if (path !== '/bookings' && path !== '/api/bookings' && path !== '/api/bookings/options' && !match) {
      json(res, 404, { error: 'Not found.' }); return true;
    }
    res.setHeader('Allow', path === '/api/bookings' ? 'GET, POST' : 'GET');
    json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    if (error instanceof BookingProblem) json(res, error.status, { error: error.message });
    else json(res, 500, { error: 'Booking request failed.' });
  }
  return true;
}
