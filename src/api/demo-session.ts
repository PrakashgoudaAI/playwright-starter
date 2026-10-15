import { expect, type APIRequestContext } from '@playwright/test';
import { accounts, type Role } from '../../examples/demo-app/accounts.ts';

export async function signIn(request: APIRequestContext, role: Role): Promise<void> {
  const response = await request.post('/api/session', { data: accounts[role] });
  expect(response.status(), 'Create demo session').toBe(201);
  const session: unknown = await response.json();
  expect(session).toEqual({ role });
  const validation = await request.get('/api/session');
  expect(validation.status(), 'Validate session before browser reuse').toBe(200);
  expect(await validation.json()).toEqual({ role });
}
