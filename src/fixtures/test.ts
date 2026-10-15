import { test as base, expect } from '@playwright/test';
import { signIn } from '../api/demo-session.ts';
import { WorkspacePage } from '../pages/workspace-page.ts';
import type { Role } from '../../examples/demo-app/accounts.ts';

type Fixtures = { role: Role; workspace: WorkspacePage };

export const test = base.extend<Fixtures>({
  role: ['editor', { option: true }],
  storageState: async ({ playwright, baseURL, role }, use) => {
    if (!baseURL) throw new Error('Set baseURL before creating a demo session.');
    const session = await playwright.request.newContext({ baseURL });
    try {
      await signIn(session, role);
      // Playwright creates a fresh browser context using this in-memory cookie state.
      await use(await session.storageState());
    } finally {
      try {
        const logout = await session.delete('/api/session');
        expect(logout.status(), 'Dispose demo session and its test data').toBe(204);
      } finally {
        await session.dispose();
      }
    }
  },
  workspace: async ({ page }, use) => {
    await use(new WorkspacePage(page));
  },
});
export { expect };
