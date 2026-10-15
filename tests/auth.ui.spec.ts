import { test, expect } from '@playwright/test';
import { accounts } from '../examples/demo-app/accounts.ts';

test('@smoke direct navigation requires sign-in', async ({ page }) => {
  await page.goto('/board');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Tasks' })).toHaveCount(0);
});

test('@smoke invalid credentials remain on the login screen', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(accounts.viewer.email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
  await expect(page.getByRole('table', { name: 'Tasks' })).toHaveCount(0);
});

test('@smoke UI sign-in and sign-out enforce the route boundary', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(accounts.viewer.email);
  await page.getByLabel('Password', { exact: true }).fill(accounts.viewer.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByText('Signed in as viewer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.goto('/board');
  await expect(page).toHaveURL(/\/login$/);
});
