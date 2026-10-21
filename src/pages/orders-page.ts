import { expect, type Locator, type Page } from '@playwright/test';
import { PaginatedTable } from '../components/paginated-table.ts';

/** Application-specific readiness, filtering, and sorting stay in the page object. */
export class OrdersPage {
  private readonly root: Locator;
  readonly table: PaginatedTable;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('table', { name: 'Orders', exact: true });
    this.table = new PaginatedTable(this.root, {
      first: page.getByRole('button', { name: 'First page', exact: true }),
      next: page.getByRole('button', { name: 'Next page', exact: true }),
      marker: page.getByRole('status', { name: 'Order page', exact: true }),
      waitForReady: () => this.waitForReady(),
    });
  }

  async waitForReady(): Promise<void> {
    await expect(this.root).not.toHaveAttribute('data-state', 'loading');
    if (await this.root.getAttribute('data-state') === 'error') {
      throw new Error('Order results failed to load.');
    }
    await expect(this.root).toHaveAttribute('data-state', 'ready');
    await expect(this.root).toHaveAttribute('aria-busy', 'false');
  }

  async filterStatus(status: 'all' | 'open' | 'closed'): Promise<void> {
    await this.waitForReady();
    await this.page.getByLabel('Order status', { exact: true }).selectOption(status);
    await this.waitForReady();
  }

  async sortAmount(direction: 'ascending' | 'descending'): Promise<void> {
    await this.waitForReady();
    const header = this.root.getByRole('columnheader', { name: 'Sort amount', exact: true });
    if (await header.getAttribute('aria-sort') === direction) return;
    await header.getByRole('button', { name: 'Sort amount', exact: true }).click();
    await this.waitForReady();
    await expect(header).toHaveAttribute('aria-sort', direction);
  }

  async approve(key: string, maxPages = 20): Promise<void> {
    const row = await this.table.findRow(key, maxPages);
    await row.getByRole('button', { name: 'Approve', exact: true }).click();
    await this.waitForReady();
  }
}
