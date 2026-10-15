import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { accounts, type Role } from './accounts.ts';
import { readEnvironment } from '../../src/config/environment.ts';

const { port, baseURL } = readEnvironment();
type Task = { id: string; title: string; priority: 'normal' | 'high'; done: boolean };
type Session = { role: Role; expires: number; tasks: Task[] };
const sessions = new Map<string, Session>();
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function document(body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Task Board</title></head><body><main>${body}</main></body></html>`;
}
function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function redirect(res: ServerResponse, location: string) {
  res.writeHead(303, { Location: location });
  res.end();
}
function loginPage(error = '') {
  return document(`<h1>Task Board</h1><p>Local test application with public demo accounts.</p>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}<form method="post" action="/login"><label>Email <input name="email" type="email" required></label><label>Password <input name="password" type="password" required></label><button>Sign in</button></form>`);
}
function board(session: Session, error = '') {
  const editor = session.role === 'editor';
  return document(`<h1>Task Board</h1><p>Signed in as ${session.role}</p>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}${editor ? `<form method="post" action="/tasks"><label>Task title <input name="title" required maxlength="80"></label><label for="task-priority">Priority</label><select id="task-priority" name="priority"><option value="normal">Normal</option><option value="high">High</option></select><button>Add task</button></form>` : ''}<table aria-label="Tasks"><thead><tr><th>Title</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>${session.tasks.map(t => `<tr><th scope="row">${escapeHtml(t.title)}</th><td>${t.priority}</td><td>${t.done ? 'Done' : 'Open'}</td><td>${editor ? `<form method="post" action="/tasks/${t.id}/complete"><button ${t.done ? 'disabled' : ''}>Complete</button></form>` : ''}</td></tr>`).join('')}</tbody></table><form method="post" action="/logout"><button>Sign out</button></form>`);
}

async function fields(req: IncomingMessage): Promise<Record<string, unknown>> {
  let body = '';
  for await (const chunk of req) {
    body += String(chunk);
    if (Buffer.byteLength(body) > 8192) throw new Error('Request body exceeds 8 KiB.');
  }
  if (req.headers['content-type']?.startsWith('application/json')) {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
    return value as Record<string, unknown>;
  }
  if (req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  throw new Error('Expected JSON or form data.');
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; form-action 'self'; frame-ancestors 'none'");
  try {
    const path = new URL(req.url ?? '/', baseURL).pathname;
    const method = req.method ?? 'GET';
    const api = path.startsWith('/api/');
    const id = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('demo_session='))?.slice(13);
    let session = id ? sessions.get(id) : undefined;
    if (session && session.expires <= Date.now()) {
      sessions.delete(id!);
      session = undefined;
    }
    if (method !== 'GET' && req.headers.origin && req.headers.origin !== baseURL) {
      json(res, 403, { error: 'Origin not allowed.' }); return;
    }
    const html = (code: number, value: string) => {
      res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(value);
    };
    if (method === 'GET' && path === '/health') { json(res, 200, { status: 'ok' }); return; }
    if (method === 'GET' && (path === '/' || path === '/login')) { html(200, loginPage()); return; }
    if (method === 'POST' && (path === '/login' || path === '/api/session')) {
      const data = await fields(req);
      const role = (Object.keys(accounts) as Role[]).find(r => accounts[r].email === data.email && accounts[r].password === data.password);
      if (!role) {
        if (api) json(res, 401, { error: 'Invalid email or password.' }); else html(401, loginPage('Invalid email or password.'));
        return;
      }
      // Each login owns its dataset so simultaneous tests cannot mutate each other.
      if (id) sessions.delete(id);
      const token = randomUUID();
      sessions.set(token, { role, expires: Date.now() + 15 * 60_000, tasks: [{ id: randomUUID(), title: 'Review test plan', priority: 'normal', done: false }] });
      res.setHeader('Set-Cookie', `demo_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=900`);
      if (api) json(res, 201, { role }); else redirect(res, '/board');
      return;
    }
    if ((method === 'POST' && path === '/logout') || (method === 'DELETE' && path === '/api/session')) {
      if (id) sessions.delete(id);
      res.setHeader('Set-Cookie', 'demo_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      if (api) { res.writeHead(204); res.end(); } else redirect(res, '/login');
      return;
    }
    if (path === '/board' || path === '/api/session' || path === '/api/tasks' || path === '/tasks' || /^\/(api\/)?tasks\/[\w-]+\/complete$/.test(path)) {
      if (!session) { if (api) json(res, 401, { error: 'Sign in required.' }); else redirect(res, '/login'); return; }
      if (method === 'GET' && path === '/board') { html(200, board(session)); return; }
      if (method === 'GET' && path === '/api/session') { json(res, 200, { role: session.role }); return; }
      if (method === 'GET' && path === '/api/tasks') { json(res, 200, { tasks: session.tasks }); return; }
      if (method === 'POST' && (path === '/tasks' || path === '/api/tasks' || path.endsWith('/complete'))) {
        if (session.role !== 'editor') { json(res, 403, { error: 'Editor role required.' }); return; }
        if (path.endsWith('/complete')) {
          const taskId = path.split('/').at(-2);
          const task = session.tasks.find(t => t.id === taskId);
          if (!task) { json(res, 404, { error: 'Task not found.' }); return; }
          task.done = true;
          if (api) json(res, 200, task); else redirect(res, '/board');
          return;
        }
        const data = await fields(req);
        const title = typeof data.title === 'string' ? data.title.trim() : '';
        if (!title || title.length > 80 || !['normal', 'high'].includes(String(data.priority))) {
          if (api) json(res, 400, { error: 'Use a title of 1–80 characters and a valid priority.' });
          else html(400, board(session, 'Use a title of 1–80 characters and a valid priority.'));
          return;
        }
        const task: Task = { id: randomUUID(), title, priority: data.priority as Task['priority'], done: false };
        session.tasks.push(task);
        if (api) json(res, 201, task); else redirect(res, '/board');
        return;
      }
      json(res, 405, { error: 'Method not allowed.' }); return;
    }
    json(res, 404, { error: 'Not found.' });
  } catch {
    if (!res.headersSent) json(res, 400, { error: 'Invalid request.' }); else res.end();
  }
});
const sweep = setInterval(() => {
  for (const [id, session] of sessions) if (session.expires <= Date.now()) sessions.delete(id);
}, 60_000).unref();
server.listen(port, '127.0.0.1', () => console.log(`Demo listening at ${baseURL}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  clearInterval(sweep); server.close(() => process.exit(0));
});
