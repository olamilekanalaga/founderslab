import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["mobile", 393, 852],
] as const) {
  test(`date selection exposes the next step and preserves the application date on ${label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/book");
    await expect(page.locator(".weekly-date")).toHaveCount(8);
    const first = page.locator(".weekly-date:not([disabled])").first();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const next = page.getByRole("link", { name: "Continue to application" });
    await expect(next).toBeInViewport();
    const target = await next.getAttribute("href");
    expect(target).toMatch(/^\/apply\?session=/);
    await expect(page.locator(".fl-summary-date")).toContainText("London");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await next.click();
    await expect(page).toHaveURL(target!);
    await expect(
      page.getByRole("heading", { name: "Bring your founder story." }),
    ).toBeVisible();
    await expect(page.locator(".selected-booking")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("hero date choice is carried into the full calendar and mobile Escape restores navigation focus", async ({
  page,
}) => {
  const availabilityReady = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/sessions") && response.ok(),
  );
  await page.goto("/");
  await availabilityReady;
  const preview = page.getByRole("link", { name: "Choose this Saturday" });
  await expect(preview).toBeVisible({ timeout: 15000 });
  const target = await preview.getAttribute("href");
  await preview.click();
  await expect(page).toHaveURL(target!);
  await expect(page.locator(".weekly-date.selected")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Continue to application" }),
  ).toBeVisible();
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
