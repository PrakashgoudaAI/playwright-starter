import { type Page } from '@playwright/test';
import { TaskTable } from '../components/task-table.ts';

export class WorkspacePage {
  readonly tasks: TaskTable;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.tasks = new TaskTable(page.getByRole('table', { name: 'Tasks' }));
  }

  async open(): Promise<void> {
    await this.page.goto('/board');
  }

  async addTask(title: string, priority: 'Normal' | 'High' = 'Normal'): Promise<void> {
    await this.page.getByLabel('Task title', { exact: true }).fill(title);
    await this.page.getByLabel('Priority', { exact: true }).selectOption({ label: priority });
    await this.page.getByRole('button', { name: 'Add task', exact: true }).click();
  }

  async signOut(): Promise<void> {
    await this.page.getByRole('button', { name: 'Sign out', exact: true }).click();
  }
}
