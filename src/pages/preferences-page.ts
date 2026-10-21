import { type Download, type Page } from '@playwright/test';
import { CheckboxGroup, NativeSelect, SearchCombobox } from '../components/form-controls.ts';

export type Channel = 'email' | 'sms' | 'push';

/** Example application mapping. Keep your own labels and business actions here. */
export class PreferencesPage {
  readonly plan: NativeSelect;
  readonly languages: NativeSelect;
  readonly channels: CheckboxGroup<Channel>;
  readonly region: SearchCombobox;

  constructor(private readonly page: Page) {
    this.plan = new NativeSelect(page.getByLabel('Plan', { exact: true }));
    this.languages = new NativeSelect(page.getByLabel('Languages', { exact: true }));
    const channels = page.getByRole('group', { name: 'Notification channels', exact: true });
    this.channels = new CheckboxGroup<Channel>({
      email: channels.getByRole('checkbox', { name: 'Email', exact: true }),
      sms: channels.getByRole('checkbox', { name: 'SMS', exact: true }),
      push: channels.getByRole('checkbox', { name: 'Push', exact: true }),
    });
    this.region = new SearchCombobox(page.getByRole('combobox', { name: 'Region', exact: true }),
      page.getByRole('listbox', { name: 'Regions', exact: true }));
  }

  async setDigest(frequency: 'Daily' | 'Weekly'): Promise<void> {
    await this.page.getByRole('radio', { name: frequency, exact: true }).check();
  }

  async setDueDate(isoDate: string): Promise<void> {
    await this.page.getByLabel('Due date', { exact: true }).fill(isoDate);
  }

  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  }

  async confirmDeletion(): Promise<void> {
    await this.page.getByRole('button', { name: 'Delete preferences', exact: true }).click();
    await this.page.getByRole('dialog', { name: 'Delete preferences?', exact: true })
      .getByRole('button', { name: 'Confirm delete', exact: true }).click();
  }

  async attachFiles(files: readonly { name: string; mimeType: string; buffer: Buffer }[]): Promise<void> {
    await this.page.getByLabel('Attachments', { exact: true }).setInputFiles([...files]);
  }

  async exportPreferences(): Promise<Download> {
    const download = this.page.waitForEvent('download');
    await this.page.getByRole('link', { name: 'Export preferences', exact: true }).click();
    return download;
  }

  async openHelp(): Promise<Page> {
    const popup = this.page.waitForEvent('popup');
    await this.page.getByRole('button', { name: 'Open help', exact: true }).click();
    return popup;
  }

  async setEmbeddedReference(value: string): Promise<void> {
    await this.page.frameLocator('iframe[title="Embedded details"]').getByLabel('Internal reference').fill(value);
  }

  async selectAllRows(checked: boolean): Promise<void> {
    await this.page.getByRole('checkbox', { name: 'Select all rows', exact: true }).setChecked(checked);
  }
}
