import { test, expect } from '../src/fixtures/test.ts';

test('@smoke editor adds a task with priority and completes its row', async ({ page, workspace }) => {
  await workspace.open();
  await test.step('Create a high-priority task', async () => { await workspace.addTask('Check keyboard navigation', 'High'); });
  const row = workspace.tasks.row('Check keyboard navigation');
  await expect(row.getByRole('cell', { name: 'high', exact: true })).toBeVisible();
  await expect(row.getByRole('cell', { name: 'Open', exact: true })).toBeVisible();
  await workspace.tasks.complete('Check keyboard navigation');
  await expect(row.getByRole('cell', { name: 'Done', exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Complete' })).toBeDisabled();
  await expect(page.getByRole('table', { name: 'Tasks' }).getByRole('row')).toHaveCount(3);
});

test('@smoke task titles are displayed as text', async ({ workspace }) => {
  await workspace.open();
  await workspace.addTask('<script>alert(1)</script>');
  await expect(workspace.tasks.row('<script>alert(1)</script>')).toBeVisible();
});

test.describe('viewer', () => {
  test.use({ role: 'viewer' });
  test('@smoke has read access without editing controls', async ({ page, workspace }) => {
    await workspace.open();
    await expect(workspace.tasks.row('Review test plan')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add task' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Complete' })).toHaveCount(0);
  });
});
