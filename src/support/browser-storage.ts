import type { BrowserContext, Page } from '@playwright/test';

export type StorageSeed = {
  origin: string;
  local?: Readonly<Record<string, string>>;
  session?: Readonly<Record<string, string>>;
};

function checkedOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Storage seed requires an HTTP(S) origin without a path or credentials.');
  }
  return url.origin;
}

function entries(values: Readonly<Record<string, string>> | undefined): [string, string][] {
  if (values === undefined) return [];
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('Storage values must be a string record.');
  }
  const result = Object.entries(values);
  if (result.length > 100 || result.some(([key, value]) =>
      !key || key.length > 128 || typeof value !== 'string' || value.length > 4096)) {
    throw new Error('Storage seed exceeds the supported string-record limits.');
  }
  return result;
}

/** Register before navigation. Seed missing keys only; do not reset app changes on reload. */
export async function seedBrowserStorage(context: BrowserContext, seed: StorageSeed): Promise<void> {
  const payload = { origin: checkedOrigin(seed.origin), local: entries(seed.local), session: entries(seed.session) };
  await context.addInitScript((data) => {
    if (window.location.origin !== data.origin) return;
    for (const [key, value] of data.local) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
    for (const [key, value] of data.session) {
      if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
    }
  }, payload);
}

/** Returned values may contain secrets. Keep snapshots in memory and out of test attachments. */
export async function captureSessionStorage(page: Page, origin: string): Promise<Record<string, string>> {
  if (new URL(page.url()).origin !== checkedOrigin(origin)) {
    throw new Error('Session snapshot origin does not match the current page.');
  }
  return page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
}
