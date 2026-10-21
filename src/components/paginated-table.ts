import { expect, type Locator } from '@playwright/test';

export type TableNavigation = {
  first: Locator;
  next: Locator;
  marker: Locator;
  /** Resolve after rows and navigation are committed; reject a failed load. */
  waitForReady: () => Promise<void>;
};

/** Conventional paged tables with a unique rowheader key, not virtualized grids. */
export class PaginatedTable {
  constructor(private readonly root: Locator, private readonly navigation: TableNavigation) {}

  private row(key: string): Locator {
    return this.root.getByRole('row').filter({
      has: this.root.page().getByRole('rowheader', { name: key, exact: true }),
    });
  }

  private async move(button: Locator): Promise<void> {
    const before = await this.navigation.marker.innerText();
    await button.click();
    await this.navigation.waitForReady();
    await expect(this.navigation.marker).not.toHaveText(before);
  }

  async findRow(key: string, maxPages = 20): Promise<Locator> {
    if (!key.trim()) throw new Error('A non-empty row key is required.');
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
      throw new Error('Page budget must be an integer from 1 to 100.');
    }
    await expect(this.root).toHaveCount(1);
    await this.navigation.waitForReady();
    if (await this.navigation.first.isEnabled()) await this.move(this.navigation.first);
    const visited = new Set<string>();
    for (let scanned = 1; scanned <= maxPages; scanned++) {
      const marker = (await this.navigation.marker.innerText()).trim();
      if (!marker || visited.has(marker)) throw new Error('Pagination repeated or omitted its page marker.');
      visited.add(marker);
      const row = this.row(key);
      const matches = await row.count();
      if (matches > 1) throw new Error('Row key is ambiguous on the current page.');
      if (matches === 1) return row;
      if (await this.navigation.next.isDisabled()) throw new Error('Row was not found before the last page.');
      if (scanned === maxPages) throw new Error('Row search exhausted its page budget.');
      await this.move(this.navigation.next);
    }
    throw new Error('Row search ended without a result.');
  }
}
