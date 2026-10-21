import { expect, type Locator } from '@playwright/test';

export type MultiSelectControls<K extends string> = {
  trigger: Locator;
  listbox: Locator;
  done: Locator;
  /** Complete option set, with unique accessible names. Not a virtualized/search list. */
  names: Readonly<Record<K, string>>;
};

export class TokenMultiSelect<K extends string> {
  constructor(private readonly controls: MultiSelectControls<K>) {}

  async setSelected(selected: readonly K[]): Promise<void> {
    if (new Set(selected).size !== selected.length) throw new Error('Multi-select choices must be unique.');
    for (const key of selected) {
      if (!Object.hasOwn(this.controls.names, key)) throw new Error('Unknown multi-select choice.');
    }
    const mappings = Object.entries(this.controls.names) as [K, string][];
    const names = mappings.map(([, name]) => name);
    if (names.some(name => !name.trim()) || new Set(names).size !== names.length) {
      throw new Error('Multi-select option names must be non-empty and unique.');
    }
    const expanded = await this.controls.trigger.getAttribute('aria-expanded');
    if (expanded !== 'true' && expanded !== 'false') throw new Error('Multi-select trigger requires aria-expanded.');
    if (expanded === 'false') await this.controls.trigger.click();
    await expect(this.controls.trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(this.controls.listbox).toBeVisible();
    await expect(this.controls.listbox).toHaveAttribute('aria-multiselectable', 'true');
    await expect(this.controls.listbox).toHaveAttribute('aria-busy', 'false');
    await expect(this.controls.listbox.getByRole('option')).toHaveCount(mappings.length);
    const desired = new Set(selected);
    const changes: { option: Locator; selected: boolean }[] = [];
    // Preflight all choices before toggling one. Later interaction failures are not rolled back.
    for (const [key, name] of mappings) {
      const option = this.controls.listbox.getByRole('option', { name, exact: true });
      await expect(option).toHaveCount(1);
      const state = await option.getAttribute('aria-selected');
      if (state !== 'true' && state !== 'false') throw new Error('Multi-select options require binary aria-selected.');
      const wanted = desired.has(key);
      if ((state === 'true') !== wanted) {
        if (!await option.isEnabled()) throw new Error('A disabled option cannot reach the requested selection.');
        changes.push({ option, selected: wanted });
      }
    }
    for (const change of changes) {
      await change.option.click();
      await expect(change.option).toHaveAttribute('aria-selected', String(change.selected));
    }
    await this.controls.done.click();
    await expect(this.controls.listbox).toBeHidden();
    await expect(this.controls.trigger).toHaveAttribute('aria-expanded', 'false');
  }
}
