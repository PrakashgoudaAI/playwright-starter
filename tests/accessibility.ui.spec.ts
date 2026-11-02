import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "../src/fixtures/test.ts";
import { BookingWorkspace } from "../src/pages/booking-workspace.ts";

async function scan(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}

test("login has labeled controls and works with keyboard submission", async ({
  page,
  browserName,
}) => {
  const tabKey =
    browserName === "webkit" && process.platform === "darwin"
      ? "Alt+Tab"
      : "Tab";
  await page.goto("/login");
  await scan(page);
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.type("editor@example.test");
  await page.keyboard.press(tabKey);
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type("demo-only-password");
  await page.keyboard.press(tabKey);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/board$/);
});

test("editor board has no detected WCAG A/AA violations", async ({
  page,
  workspace,
}) => {
  await workspace.open();
  await scan(page);
});

test("booking editor and invalid draft remain accessible", async ({ page }) => {
  const booking = new BookingWorkspace(page);
  await booking.goto();
  await scan(page);
  await booking.save();
  await expect(page.getByRole("alert")).toBeVisible();
  await scan(page);
});

test("calendar returns keyboard focus and exposes its expanded state", async ({
  page,
}) => {
  await new BookingWorkspace(page).goto();
  const trigger = page.getByRole("button", {
    name: "Choose start date",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Start date", exact: true }),
  ).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await scan(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("participant list supports keyboard movement and restores trigger focus", async ({
  page,
}) => {
  await new BookingWorkspace(page).goto();
  const trigger = page.getByRole("button", {
    name: "Choose participants",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("option", { name: "Alice", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const next = page.getByRole("option", { name: "Alice Jones", exact: true });
  await expect(next).toBeFocused();
  await page.keyboard.press("Space");
  await expect(next).toHaveAttribute("aria-selected", "true");
  await scan(page);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("failed booking save exposes an alert and keeps the draft available", async ({
  page,
}) => {
  const booking = new BookingWorkspace(page);
  await booking.goto();
  await booking.fillDraft({
    title: "Keyboard review",
    startDate: "2028-02-29",
    participants: ["alice"],
  });
  await page.route(
    "**/api/bookings",
    (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Temporarily unavailable." },
      }),
    { times: 1 },
  );
  await booking.save();
  await expect(page.getByRole("alert")).toHaveText("Temporarily unavailable.");
  await expect(page.getByLabel("Booking title", { exact: true })).toHaveValue(
    "Keyboard review",
  );
  await scan(page);
});

test.describe("viewer accessibility", () => {
  test.use({ role: "viewer" });
  test("read-only board and bookings have no detected WCAG A/AA violations", async ({
    page,
    workspace,
  }) => {
    await workspace.open();
    await scan(page);
    await new BookingWorkspace(page).goto();
    await expect(page.getByRole("form", { name: "Booking draft" })).toHaveCount(
      0,
    );
    await scan(page);
  });
});
