import { test as base, expect, type Page } from '@playwright/test';
import { ordersView } from '../../examples/patterns/orders-view.ts';
import { OrdersPage } from '../../src/pages/orders-page.ts';

type Order = { id: string; amount: number; status: 'open' | 'closed' | 'approved' };
type Mode = 'normal' | 'duplicate' | 'cycle' | 'load-error';
type Scenario = { view: OrdersPage; records: Order[]; requests: number[] };

const test = base.extend<{ mode: Mode; scenario: Scenario }>({
  mode: ['normal', { option: true }],
  scenario: async ({ page, mode }, use) => {
    // Each test owns its simulated API state. No shared accounts or external service.
    const records: Order[] = [
      { id: 'ORD-10', amount: 2000, status: 'open' },
      { id: 'ORD-100', amount: 500, status: 'open' },
      { id: 'ORD-200', amount: 1200, status: 'closed' },
      { id: 'ORD-300', amount: 800, status: 'closed' },
      { id: 'ORD-400', amount: 3200, status: 'open' },
      { id: 'ORD-500', amount: 1500, status: 'open' },
    ];
    if (mode === 'duplicate') records.push({ id: 'ORD-100', amount: 500, status: 'open' });
    const requests: number[] = [];
    await page.route(url => url.pathname === '/patterns/orders', route => route.fulfill({
      contentType: 'text/html', body: ordersView,
    }));
    await page.route(url => url.pathname === '/patterns/orders-data', async route => {
      const query = new URL(route.request().url()).searchParams;
      const requested = Number(query.get('page'));
      requests.push(requested);
      if (mode === 'load-error' && requested === 2) {
        await route.fulfill({ status: 503, json: { error: 'Synthetic outage' } });
        return;
      }
      const status = query.get('status');
      const direction = query.get('direction') === 'descending' ? -1 : 1;
      const filtered = records.filter(order => status === 'all' || order.status === status)
        .toSorted((left, right) => direction * (left.amount - right.amount));
      const pages = Math.max(1, Math.ceil(filtered.length / 2));
      const current = mode === 'cycle' && requested === 3 ? 1 : Math.min(requested, pages);
      await route.fulfill({ json: { page: current, pages, rows: filtered.slice((current - 1) * 2, current * 2) } });
    });
    await page.route(url => url.pathname === '/patterns/orders-approve', async route => {
      if (route.request().method() !== 'POST') {
        await route.fulfill({ status: 405, json: { error: 'POST required' } });
        return;
      }
      const { id } = route.request().postDataJSON() as { id: string };
      const order = records.find(record => record.id === id);
      if (!order || order.status !== 'open') {
        await route.fulfill({ status: 409, json: { error: 'Order is not approvable' } });
        return;
      }
      order.status = 'approved';
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto('/patterns/orders');
    const view = new OrdersPage(page);
    await view.waitForReady();
    await use({ view, records, requests });
  },
});

function amounts(page: Page) {
  return page.getByRole('table', { name: 'Orders', exact: true }).locator('[data-field="amount"]');
}

test('exact row keys do not match a prefix and each search resets to the first page', async ({ page, scenario }) => {
  const ten = await scenario.view.table.findRow('ORD-10');
  await expect(ten.getByRole('rowheader')).toHaveText('ORD-10');
  await expect(page.getByRole('status', { name: 'Order page' })).toHaveText('Page 3 of 3');
  const hundred = await scenario.view.table.findRow('ORD-100');
  await expect(hundred.getByRole('rowheader')).toHaveText('ORD-100');
  await expect(page.getByRole('status', { name: 'Order page' })).toHaveText('Page 1 of 3');
});

test('an off-page action changes only the exact target order', async ({ scenario }) => {
  await scenario.view.approve('ORD-400');
  const row = await scenario.view.table.findRow('ORD-400');
  await expect(row.getByRole('cell', { name: 'Approved', exact: true })).toBeVisible();
  expect(scenario.records.filter(order => order.status === 'approved').map(order => order.id)).toEqual(['ORD-400']);
});

test('filtering waits for the committed rows and resets pagination', async ({ page, scenario }) => {
  await scenario.view.table.findRow('ORD-400');
  await scenario.view.filterStatus('closed');
  await expect(page.getByRole('table', { name: 'Orders' }).getByRole('rowheader')).toHaveText(['ORD-300', 'ORD-200']);
  await expect(page.getByRole('status', { name: 'Order page' })).toHaveText('Page 1 of 1');
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
});

test('numeric amount sorting works in both directions and is repeatable', async ({ page, scenario }) => {
  await scenario.view.sortAmount('descending');
  await expect(amounts(page)).toHaveText(['32.00', '20.00']);
  const requestCount = scenario.requests.length;
  await scenario.view.sortAmount('descending');
  expect(scenario.requests).toHaveLength(requestCount);
  await scenario.view.sortAmount('ascending');
  await expect(amounts(page)).toHaveText(['5.00', '8.00']);
});

test('a missing row stops at the last page without a mutation', async ({ scenario }) => {
  await expect(scenario.view.approve('ORD-missing')).rejects.toThrow('not found before the last page');
  expect(scenario.requests).toEqual([1, 2, 3]);
  expect(scenario.records.some(order => order.status === 'approved')).toBe(false);
});

test('invalid and exhausted page budgets do not scan extra pages', async ({ scenario }) => {
  for (const budget of [0, 1.5, 101]) {
    await expect(scenario.view.table.findRow('ORD-400', budget)).rejects.toThrow('Page budget');
  }
  await expect(scenario.view.table.findRow('ORD-400', 1)).rejects.toThrow('exhausted its page budget');
  expect(scenario.requests).toEqual([1]);
});

test('approval can remove a row from an open-only result set', async ({ page, scenario }) => {
  await scenario.view.filterStatus('open');
  await scenario.view.approve('ORD-100');
  await expect(page.getByRole('table', { name: 'Orders' }).getByRole('rowheader', { name: 'ORD-100', exact: true })).toHaveCount(0);
  expect(scenario.records.find(order => order.id === 'ORD-100')?.status).toBe('approved');
});

test.describe('duplicate keys', () => {
  test.use({ mode: 'duplicate' });
  test('ambiguous rows fail before an action is attempted', async ({ scenario }) => {
    await expect(scenario.view.approve('ORD-100')).rejects.toThrow('ambiguous on the current page');
    expect(scenario.requests).toEqual([1]);
    expect(scenario.records.some(order => order.status === 'approved')).toBe(false);
  });
});

test.describe('pagination loop', () => {
  test.use({ mode: 'cycle' });
  test('repeated page markers terminate the search', async ({ scenario }) => {
    await expect(scenario.view.table.findRow('ORD-missing')).rejects.toThrow('repeated or omitted its page marker');
    expect(scenario.requests).toEqual([1, 2, 3]);
  });
});

test.describe('failed page load', () => {
  test.use({ mode: 'load-error' });
  test('stale visible rows are not treated as a successful load', async ({ page, scenario }) => {
    await expect(scenario.view.approve('ORD-400')).rejects.toThrow('Order results failed to load');
    await expect(page.getByRole('alert')).toHaveText('Orders could not be loaded');
    await expect(page.getByRole('rowheader', { name: 'ORD-100', exact: true })).toBeVisible();
    expect(scenario.requests).toEqual([1, 2]);
    expect(scenario.records.some(order => order.status === 'approved')).toBe(false);
  });
});
