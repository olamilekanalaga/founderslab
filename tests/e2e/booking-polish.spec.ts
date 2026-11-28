import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sundaySessions } from "@/lib/dates/sunday-schedule";
import { openRegistrationForm } from "./registration-steps";

for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["mobile", 393, 852],
] as const) {
  test(`date selection exposes the next step and preserves the application date on ${label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/book");
    await expect(page.locator(".fl-preview-dates > button")).toHaveCount(3);
    const first = page
      .locator(".fl-preview-dates > button:not([disabled])")
      .first();
    await expect(
      page.locator(".fl-preview-dates > button:disabled"),
    ).toHaveCount(2);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const next = page.getByRole("link", { name: "Choose this Sunday" });
    const target = await next.getAttribute("href");
    expect(target).toMatch(/^\/apply\?session=/);
    await expect(page.locator(".fl-preview-time")).toContainText("London");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await next.click();
    await expect(page).toHaveURL(target!);
    await openRegistrationForm(page);
    await expect(
      page.getByRole("heading", { name: "Founder application" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Founder name", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Your selected Space", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Change date" })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("hero date choice is carried directly into the application and mobile Escape restores navigation focus", async ({
  page,
}) => {
  const availabilityReady = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/sessions") && response.ok(),
  );
  await page.goto("/");
  await availabilityReady;
  const preview = page.getByRole("link", { name: "Choose this Sunday" });
  await expect(preview).toBeVisible({ timeout: 15000 });
  const target = await preview.getAttribute("href");
  await preview.click();
  await expect(page).toHaveURL(target!);
  await openRegistrationForm(page);
  await expect(page.getByLabel("Founder name", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 393, height: 852 });
  const menu = page.getByRole("button", { name: "Open programme navigation" });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Close programme navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("an unavailable Sunday offers a return to the calendar", async ({
  page,
}) => {
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions: [] } }),
  );
  await page.goto("/apply?session=unavailable");
  await page.getByRole("button", { name: "Continue to registration" }).click();
  await expect(
    page.getByText("That Sunday is no longer available."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to booking calendar" }),
  ).toHaveAttribute("href", "/#choose-a-sunday");
  await expect(
    page.getByRole("button", { name: "Request booking" }),
  ).toBeHidden();
});

test("the next Sunday opens only after Space data is submitted", async ({
  page,
}) => {
  const now = new Date("2026-11-29T18:59:50Z");
  await page.clock.install({ time: now });
  const sessions = sundaySessions(now, 4).map((session) => ({
    ...session,
    availableSeats: 4,
  }));
  let completed = false;
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({
      json: {
        sessions: sessions
          .slice(completed ? 1 : 0)
          .map((session, index) => ({ ...session, bookingLocked: index > 0 })),
      },
    }),
  );
  await page.goto("/");
  const dates = page.locator(".fl-preview-dates > button");
  await expect(dates).toHaveCount(3);
  await expect(dates.first()).toContainText("November 2026");
  await page.clock.fastForward(31_000);
  await expect(dates).toHaveCount(3);
  await expect(dates.first()).toContainText("Awaiting Space data");
  await expect(page.locator(".fl-preview-dates > button:disabled")).toHaveCount(
    3,
  );
  completed = true;
  await page.clock.fastForward(31_000);
  await expect(dates.first()).toContainText("December 2026");
  await expect(dates.last()).toContainText("20");
  await expect(page.locator(".fl-preview-dates > button:disabled")).toHaveCount(
    2,
  );
});
