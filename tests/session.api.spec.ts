import { test, expect } from '@playwright/test';
import { signIn } from '../src/api/demo-session.ts';
import { accounts } from '../examples/demo-app/accounts.ts';
import { readEnvironment } from '../src/config/environment.ts';

test.afterEach(async ({ request }) => { await request.delete('/api/session'); });

test('@smoke rejects an unauthenticated API request', async ({ request }) => {
  expect((await request.get('/api/tasks')).status()).toBe(401);
});

test('@smoke rejects incorrect credentials', async ({ request }) => {
  const result = await request.post('/api/session', { data: { ...accounts.viewer, password: 'wrong-password' } });
  expect(result.status()).toBe(401);
  expect((await request.get('/api/session')).status()).toBe(401);
});

test('@smoke viewer cannot create tasks even through the API', async ({ request }) => {
  await signIn(request, 'viewer');
  expect((await request.post('/api/tasks', { data: { title: 'Forbidden', priority: 'normal' } })).status()).toBe(403);
});

test('@smoke editor can create, read and complete a task', async ({ request }) => {
  await signIn(request, 'editor');
  const result = await request.post('/api/tasks', { data: { title: 'Check release notes', priority: 'high' } });
  expect(result.status()).toBe(201);
  const task = await result.json();
  expect(task).toEqual({ id: expect.any(String), title: 'Check release notes', priority: 'high', done: false });
  const complete = await request.post(`/api/tasks/${task.id}/complete`);
  expect(complete.status()).toBe(200);
  expect(await complete.json()).toEqual({ ...task, done: true });
  expect((await (await request.get('/api/tasks')).json()).tasks).toContainEqual({ ...task, done: true });
});

test('@smoke logout invalidates a previously issued cookie', async ({ request }) => {
  await signIn(request, 'editor');
  const cookie = (await request.storageState()).cookies.find(c => c.name === 'demo_session');
  expect(cookie).toBeDefined();
  expect((await request.delete('/api/session')).status()).toBe(204);
  expect((await request.get('/api/tasks', { headers: { Cookie: `demo_session=${cookie!.value}` } })).status()).toBe(401);
});

test('@smoke rejects invalid task data without changing the dataset', async ({ request }) => {
  await signIn(request, 'editor');
  for (const data of [{ title: '', priority: 'normal' }, { title: 'x'.repeat(81), priority: 'normal' }, { title: 'Valid', priority: 'urgent' }]) {
    expect((await request.post('/api/tasks', { data })).status()).toBe(400);
  }
  expect((await (await request.get('/api/tasks')).json()).tasks).toHaveLength(1);
});

test('@smoke malformed JSON returns a client error', async ({ request }) => {
  const result = await request.post('/api/session', { data: '{', headers: { 'Content-Type': 'application/json' } });
  expect(result.status()).toBe(400);
  expect(await result.json()).toEqual({ error: 'Invalid request.' });
});

test('@smoke separates data between two simultaneous sessions', async ({ request, playwright, baseURL }) => {
  if (!baseURL) throw new Error('Set baseURL before creating a demo session.');
  const other = await playwright.request.newContext({ baseURL });
  try {
    await signIn(request, 'editor');
    await signIn(other, 'editor');
    const created = await request.post('/api/tasks', { data: { title: 'Private to first session', priority: 'normal' } });
    expect(created.status()).toBe(201);
    const task = await created.json();
    expect((await (await other.get('/api/tasks')).json()).tasks).toHaveLength(1);
    expect((await other.post(`/api/tasks/${task.id}/complete`)).status()).toBe(404);
  } finally { await other.delete('/api/session'); await other.dispose(); }
});

test('@smoke rejects browser requests from a different origin', async ({ request }) => {
  const response = await request.post('/api/session', { data: accounts.viewer, headers: { Origin: 'https://untrusted.example' } });
  expect(response.status()).toBe(403);
});

test('@smoke validates environment configuration before launching tests', () => {
  expect(readEnvironment({ DEMO_PORT: '4300' }).baseURL).toBe('http://127.0.0.1:4300');
  for (const value of ['0', 'abc', '65536', '1.5', '4173/board']) {
    expect(() => readEnvironment({ DEMO_PORT: value })).toThrow('DEMO_PORT');
  }
});
