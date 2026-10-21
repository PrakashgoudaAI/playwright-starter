import { expect, type Locator } from '@playwright/test';

/** Native HTML selects only. Custom comboboxes have a different interaction contract. */
export class NativeSelect {
  constructor(private readonly control: Locator) {}

  async chooseLabel(label: string): Promise<void> {
    await expect(this.control).toHaveCount(1);
    await expect(this.control).toBeEnabled();
    await this.control.selectOption({ label });
  }

  async chooseValues(values: readonly string[]): Promise<void> {
    if (new Set(values).size !== values.length) throw new Error('Select values must be unique.');
    await expect(this.control).toHaveCount(1);
    if (await this.control.getAttribute('multiple') === null) {
      throw new Error('chooseValues requires a native multi-select.');
    }
    await this.control.selectOption([...values]);
  }
}

/** Editable ARIA combobox with an explicitly supplied, possibly portalled listbox. */
export class SearchCombobox {
  constructor(private readonly input: Locator, private readonly listbox: Locator) {}

  async choose(label: string): Promise<void> {
    await this.input.fill(label);
    await expect(this.listbox).toBeVisible();
    const option = this.listbox.getByRole('option', { name: label, exact: true });
    await expect(option).toHaveCount(1);
    await option.click();
    await expect(this.input).toHaveValue(label);
  }
}

/** Explicit choices keep label ownership in the page object, not in DOM guessing. */
export class CheckboxGroup<K extends string> {
  constructor(private readonly choices: Readonly<Record<K, Locator>>) {}

  async setSelected(selected: readonly K[]): Promise<void> {
    if (new Set(selected).size !== selected.length) throw new Error('Checkbox choices must be unique.');
    for (const key of selected) {
      if (!Object.hasOwn(this.choices, key)) throw new Error('Unknown checkbox choice.');
    }
    const desired = new Set(selected);
    const plan: { control: Locator; checked: boolean; enabled: boolean }[] = [];
    // Validate every choice before changing any control. A later UI failure is not rolled back.
    for (const [key, control] of Object.entries(this.choices) as [K, Locator][]) {
      await expect(control).toHaveCount(1);
      const checked = desired.has(key);
      const enabled = await control.isEnabled();
      if (!enabled && await control.isChecked() !== checked) {
        throw new Error('A disabled checkbox cannot reach the requested selection.');
      }
      plan.push({ control, checked, enabled });
    }
    for (const step of plan) {
      if (step.enabled) await step.control.setChecked(step.checked);
    }
  }
}
