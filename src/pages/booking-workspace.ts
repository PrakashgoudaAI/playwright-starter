import { expect, type Page } from '@playwright/test';
import type { BookingInput } from '../../examples/demo-app/booking-store.ts';
import { BookingPage } from './booking-page.ts';
import { PaginatedTable } from '../components/paginated-table.ts';

/** Composes existing widget contracts against the real local demo routes. */
export class BookingWorkspace {
  readonly controls: BookingPage;
  readonly table: PaginatedTable;
  constructor(private readonly page: Page) {
    this.controls = new BookingPage(page);
    this.table = new PaginatedTable(page.getByRole('table', { name: 'Bookings', exact: true }), {
      first: page.getByRole('button', { name: 'First page', exact: true }),
      next: page.getByRole('button', { name: 'Next page', exact: true }),
      marker: page.getByRole('status', { name: 'Booking page', exact: true }),
      waitForReady: () => this.waitForReady(),
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/bookings');
    await expect(this.page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    const root = this.page.getByRole('table', { name: 'Bookings', exact: true });
    await expect(root).not.toHaveAttribute('data-state', 'loading');
    if (await root.getAttribute('data-state') === 'error') throw new Error('Booking results failed to load.');
    await expect(root).toHaveAttribute('data-state', 'ready');
    await expect(root).toHaveAttribute('aria-busy', 'false');
  }

  async fillDraft(input: BookingInput): Promise<void> {
    await this.page.getByLabel('Booking title', { exact: true }).fill(input.title);
    await this.controls.participants.setSelected(input.participants);
    await this.controls.startDate.choose(input.startDate);
  }

  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save booking', exact: true }).click();
    await expect(this.page.getByRole('form', { name: 'Booking draft', exact: true })).toHaveAttribute('aria-busy', 'false');
  }
}
