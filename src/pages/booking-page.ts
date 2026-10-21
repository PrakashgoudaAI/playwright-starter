import { type Page } from '@playwright/test';
import { CalendarPicker } from '../components/calendar-picker.ts';
import { TokenMultiSelect } from '../components/token-multi-select.ts';

export type Participant = 'alice' | 'alice-jones' | 'bob' | 'evan';

/** Labels and widget boundaries belong to this application mapping. */
export class BookingPage {
  readonly participants: TokenMultiSelect<Participant>;
  readonly startDate: CalendarPicker;

  constructor(page: Page) {
    const listbox = page.getByRole('listbox', { name: 'Participants', exact: true });
    this.participants = new TokenMultiSelect<Participant>({
      trigger: page.getByRole('button', { name: 'Choose participants', exact: true }),
      listbox,
      done: page.getByRole('button', { name: 'Done choosing participants', exact: true }),
      names: { alice: 'Alice', 'alice-jones': 'Alice Jones', bob: 'Bob', evan: 'Evan' },
    });
    const dialog = page.getByRole('dialog', { name: 'Start date', exact: true });
    this.startDate = new CalendarPicker({
      trigger: page.getByRole('button', { name: 'Choose start date', exact: true }),
      dialog,
      month: dialog.getByRole('status', { name: 'Calendar month', exact: true }),
      previous: dialog.getByRole('button', { name: 'Previous month', exact: true }),
      next: dialog.getByRole('button', { name: 'Next month', exact: true }),
      value: page.getByLabel('Start date', { exact: true }),
      day: isoDate => dialog.getByRole('button', { name: isoDate, exact: true }),
    });
  }
}
