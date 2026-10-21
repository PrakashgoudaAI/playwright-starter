import { test as base, expect } from '@playwright/test';
import { bookingView } from '../../examples/patterns/booking-view.ts';
import { BookingPage, type Participant } from '../../src/pages/booking-page.ts';
import { TokenMultiSelect } from '../../src/components/token-multi-select.ts';

const test = base.extend<{ booking: BookingPage; widgetMode: 'normal' | 'jumping-month' }>({
  widgetMode: ['normal', { option: true }],
  booking: async ({ page, widgetMode }, use) => {
    const body = widgetMode === 'jumping-month'
      ? bookingView.replace('<html lang="en">', '<html lang="en" data-calendar-step="2">')
      : bookingView;
    await page.route(url => url.pathname === '/patterns/booking', route => route.fulfill({ contentType: 'text/html', body }));
    await page.goto('/patterns/booking');
    await use(new BookingPage(page));
  },
});

test('custom multi-select replaces the complete selection and exact names avoid prefix matches', async ({ page, booking }) => {
  await booking.participants.setSelected(['alice-jones', 'bob']);
  const tokens = page.getByRole('region', { name: 'Selected participants' });
  await expect(tokens.getByRole('button')).toHaveCount(2);
  await expect(tokens.getByRole('button', { name: 'Remove Alice', exact: true })).toHaveCount(0);
  await expect(tokens.getByRole('button', { name: 'Remove Alice Jones', exact: true })).toBeVisible();
  await expect(tokens.getByRole('button', { name: 'Remove Bob', exact: true })).toBeVisible();
  await booking.participants.setSelected(['alice-jones', 'bob']);
  await expect(tokens.getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('listbox', { name: 'Participants' })).toBeHidden();
});

test('an empty selection clears all owned tokens', async ({ page, booking }) => {
  await booking.participants.setSelected([]);
  await expect(page.getByRole('region', { name: 'Selected participants' }).getByRole('button')).toHaveCount(0);
});

test('duplicate and unknown keys fail before opening the picker', async ({ page, booking }) => {
  await expect(booking.participants.setSelected(['alice', 'alice'])).rejects.toThrow('must be unique');
  await expect(booking.participants.setSelected(['unknown' as Participant])).rejects.toThrow('Unknown multi-select choice');
  await expect(page.getByRole('button', { name: 'Choose participants', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Remove Alice', exact: true })).toBeVisible();
});

test('disabled-choice preflight leaves the existing selection unchanged', async ({ page, booking }) => {
  await expect(booking.participants.setSelected(['bob', 'evan'])).rejects.toThrow('disabled option');
  const options = page.getByRole('listbox', { name: 'Participants' });
  await expect(options.getByRole('option', { name: 'Alice', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(options.getByRole('option', { name: 'Bob', exact: true })).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('button', { name: 'Remove Alice', exact: true })).toBeVisible();
});

test('ambiguous option-name mappings fail before interaction', async ({ page, booking }) => {
  void booking;
  const invalid = new TokenMultiSelect({
    trigger: page.getByRole('button', { name: 'Choose participants', exact: true }),
    listbox: page.getByRole('listbox', { name: 'Participants', exact: true }),
    done: page.getByRole('button', { name: 'Done choosing participants', exact: true }),
    names: { first: 'Alice', second: 'Alice' },
  });
  await expect(invalid.setSelected(['first'])).rejects.toThrow('names must be non-empty and unique');
  await expect(page.getByRole('button', { name: 'Choose participants', exact: true })).toHaveAttribute('aria-expanded', 'false');
});

test('invalid option selection state fails before toggling another option', async ({ page, booking }) => {
  await page.getByRole('button', { name: 'Choose participants', exact: true }).click();
  await page.getByRole('option', { name: 'Bob', exact: true }).evaluate(element => element.setAttribute('aria-selected', 'mixed'));
  await expect(booking.participants.setSelected([])).rejects.toThrow('binary aria-selected');
  await expect(page.getByRole('option', { name: 'Alice', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('keyboard option navigation skips disabled choices and Escape returns focus', async ({ page, booking }) => {
  void booking;
  const trigger = page.getByRole('button', { name: 'Choose participants', exact: true });
  await trigger.click();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Alice Jones', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('option', { name: 'Alice Jones', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'Bob', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('removing one token does not remove a similarly named participant', async ({ page, booking }) => {
  await booking.participants.setSelected(['alice', 'alice-jones']);
  await page.getByRole('button', { name: 'Remove Alice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Alice', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Alice Jones', exact: true })).toBeVisible();
});

test('a leap day is selected by its full date without navigating another month', async ({ page, booking }) => {
  await booking.startDate.choose('2028-02-29', 0);
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2028-02-29');
  await expect(page.getByRole('dialog', { name: 'Start date' })).toBeHidden();
});

test('forward navigation crosses a year boundary without selecting an adjacent-month day', async ({ page, booking }) => {
  await booking.startDate.choose('2029-01-05');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2029-01-05');
});

test('backward navigation selects the exact date in the previous month', async ({ page, booking }) => {
  await booking.startDate.choose('2028-01-05');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2028-01-05');
});

test('malformed and impossible dates fail before opening the calendar', async ({ page, booking }) => {
  for (const value of ['2028-2-01', '2028-02-30', '2027-02-29', '1900-02-29', '2100-02-29', '2028-13-01', '0000-01-01']) {
    await expect(booking.startDate.choose(value)).rejects.toThrow('valid YYYY-MM-DD');
  }
  await expect(page.getByRole('button', { name: 'Choose start date', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('');
});

test('a leap century is valid even when outside the allowed navigation budget', async ({ page, booking }) => {
  await expect(booking.startDate.choose('2000-02-29', 0)).rejects.toThrow('exceeds the month navigation budget');
  await expect(page.getByRole('status', { name: 'Calendar month' })).toHaveAttribute('data-month', '2028-02');
});

test('invalid or insufficient month budgets do not navigate the calendar', async ({ page, booking }) => {
  for (const budget of [-1, 1.5, 121]) {
    await expect(booking.startDate.choose('2029-01-05', budget)).rejects.toThrow('Month budget');
  }
  await expect(page.getByRole('button', { name: 'Choose start date', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(booking.startDate.choose('2029-01-05', 2)).rejects.toThrow('exceeds the month navigation budget');
  await expect(page.getByRole('status', { name: 'Calendar month' })).toHaveAttribute('data-month', '2028-02');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('');
});

test('an unavailable date cannot overwrite the previous selection', async ({ page, booking }) => {
  await booking.startDate.choose('2028-02-29');
  await expect(booking.startDate.choose('2028-02-14')).rejects.toThrow('Date is not available');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2028-02-29');
});

test('calendar range limits stop navigation without changing the value', async ({ page, booking }) => {
  await expect(booking.startDate.choose('2027-12-31')).rejects.toThrow('outside the supported calendar range');
  await expect(page.getByRole('status', { name: 'Calendar month' })).toHaveAttribute('data-month', '2028-01');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('');
});

test('Escape cancels the calendar and preserves the selected date', async ({ page, booking }) => {
  await booking.startDate.choose('2028-02-29');
  const trigger = page.getByRole('button', { name: 'Choose start date', exact: true });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Start date' })).toBeHidden();
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2028-02-29');
  await expect(trigger).toBeFocused();
});

test('a calendar day can be activated by keyboard and restores trigger focus', async ({ page, booking }) => {
  void booking;
  const trigger = page.getByRole('button', { name: 'Choose start date', exact: true });
  await trigger.click();
  const day = page.getByRole('dialog', { name: 'Start date' }).getByRole('button', { name: '2028-02-20', exact: true });
  await day.focus();
  await day.press('Enter');
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2028-02-20');
  await expect(trigger).toBeFocused();
});

test.describe('incorrect month movement', () => {
  test.use({ widgetMode: 'jumping-month' });
  test('unexpected two-month jumps fail without selecting a day', async ({ page, booking }) => {
    await expect(booking.startDate.choose('2028-03-10')).rejects.toThrow('did not move by one month');
    await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('');
  });
});

test.describe('date-only values outside UTC', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('the selected date is not shifted to the previous local day', async ({ page, booking }) => {
    await booking.startDate.choose('2028-02-29');
    await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2028-02-29');
  });
});
