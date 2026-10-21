import { expect, type Locator } from '@playwright/test';

export type CalendarControls = {
  trigger: Locator;
  dialog: Locator;
  month: Locator;
  previous: Locator;
  next: Locator;
  value: Locator;
  day: (isoDate: string) => Locator;
};

function dateMonth(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must be a valid YYYY-MM-DD value.');
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    throw new Error('Date must be a valid YYYY-MM-DD value.');
  }
  return year * 12 + month - 1;
}

/** Single-date Gregorian calendar. Month marker is YYYY-MM; day names include the full date. */
export class CalendarPicker {
  constructor(private readonly controls: CalendarControls) {}

  private async month(): Promise<{ text: string; ordinal: number }> {
    const text = await this.controls.month.getAttribute('data-month');
    if (!text || !/^\d{4}-\d{2}$/.test(text)) throw new Error('Calendar requires a YYYY-MM month marker.');
    return { text, ordinal: dateMonth(text + '-01') };
  }

  async choose(isoDate: string, maxMonthMoves = 12): Promise<void> {
    const target = dateMonth(isoDate);
    if (!Number.isInteger(maxMonthMoves) || maxMonthMoves < 0 || maxMonthMoves > 120) {
      throw new Error('Month budget must be an integer from 0 to 120.');
    }
    if (!await this.controls.dialog.isVisible()) await this.controls.trigger.click();
    await expect(this.controls.dialog).toBeVisible();
    let current = await this.month();
    const distance = target - current.ordinal;
    if (Math.abs(distance) > maxMonthMoves) throw new Error('Date exceeds the month navigation budget.');
    const direction = Math.sign(distance);
    for (let moved = 0; moved < Math.abs(distance); moved++) {
      const button = direction < 0 ? this.controls.previous : this.controls.next;
      if (!await button.isEnabled()) throw new Error('Target month is outside the supported calendar range.');
      await button.click();
      await expect(this.controls.month).not.toHaveAttribute('data-month', current.text);
      const next = await this.month();
      if (next.ordinal !== current.ordinal + direction) throw new Error('Calendar did not move by one month.');
      current = next;
    }
    const day = this.controls.day(isoDate);
    await expect(day).toHaveCount(1);
    if (!await day.isEnabled()) throw new Error('Date is not available in this calendar.');
    await day.click();
    await expect(this.controls.dialog).toBeHidden();
    await expect(this.controls.value).toHaveValue(isoDate);
  }
}
