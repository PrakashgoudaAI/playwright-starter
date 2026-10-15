import { type Locator } from '@playwright/test';

export class TaskTable {
  private readonly root: Locator;
  constructor(root: Locator) { this.root = root; }

  row(title: string): Locator {
    return this.root.getByRole('row').filter({ has: this.root.page().getByRole('rowheader', { name: title, exact: true }) });
  }

  async complete(title: string): Promise<void> {
    await this.row(title).getByRole('button', { name: 'Complete', exact: true }).click();
  }
}
