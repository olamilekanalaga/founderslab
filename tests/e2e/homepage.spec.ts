import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sundaySessions } from "@/lib/dates/sunday-schedule";
import { publicSlotOpen, type PublicSession } from "@/lib/dates/booking";
import {
  freeSpaceDescription,
  spaceInvitation,
} from "@/lib/space-registration";

for (const [label, width, height] of [
  ["desktop", 1440, 1024],
  ["mobile", 393, 852],
] as const) {
  test(`homepage uses live booking data with a light accessible ${label} layout`, async ({
    page,
    request,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      spaceInvitation,
    );
    await expect(
      page.getByText(freeSpaceDescription, { exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /Private Business Clinic|independent business research|proposed solutions/i,
    );
    await expect(
      page.getByRole("heading", { name: "How It Works", exact: true }),
    ).toBeVisible();
    const sessions: PublicSession[] = (
      await (await request.get("/api/public/sessions")).json()
    ).sessions;
    const upcoming = sessions
      .filter((s) => Date.parse(s.startsAt) > Date.now())
      .slice(0, 3);
    await expect(page.locator(".fl-preview-dates > button")).toHaveCount(
      upcoming.length,
    );
    for (const [index, session] of upcoming.entries()) {
      const card = page.locator(".fl-preview-dates > button").nth(index);
      await expect(card).toContainText(
        index > 0 || session.bookingLocked
          ? "Locked"
          : publicSlotOpen(session, session.availableSeats)
            ? `${session.availableSeats} ${session.availableSeats === 1 ? "slot" : "slots"} left`
            : session.availableSeats <= 0
              ? "Full"
              : "Closed",
      );
    }
    await expect(page.locator(".fl-upcoming")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Make room for your next conversation.",
      }),
    ).toHaveCount(0);
    if (label === "mobile") {
      const toggle = page.getByRole("button", {
        name: "Open programme navigation",
      });
      await toggle.click();
      await expect(
        page.getByRole("button", { name: "Close programme navigation" }),
      ).toHaveAttribute("aria-expanded", "true");
      await page
        .getByRole("navigation", { name: "Programme navigation" })
        .getByRole("link", { name: "About", exact: true })
        .click();
      await expect(page).toHaveURL(/#about$/);
      await expect(
        page.getByRole("button", { name: "Open programme navigation" }),
      ).toHaveAttribute("aria-expanded", "false");
      await page.goto("/");
      await expect(page.locator(".fl-preview-dates > button")).toHaveCount(
        upcoming.length,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toBe("light");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`saas-homepage-${label}.png`),
      fullPage: true,
    });
    await page
      .locator(".fl-hero-actions")
      .getByRole("link", { name: "Start registration" })
      .click();
    await expect(page).toHaveURL(/\/apply$/);
    await expect(
      page.getByRole("heading", { name: spaceInvitation }),
    ).toBeVisible();
  });
}

test("all founder pages expose only public navigation and no founder-award promises", async ({
  page,
}) => {
  for (const route of ["/", "/book", "/apply", "/confirmation", "/terms"]) {
    await page.goto(route);
    for (const selector of [".public-header", ".public-footer"]) {
      await expect(page.locator(selector)).toBeVisible();
      await expect(
        page
          .locator(selector)
          .locator(
            'a[href*="signin"], a[href*="dashboard"], a[href*="manager"], a[href*="settings"], a[href*="campaigns"]',
          ),
      ).toHaveCount(0);
      await expect(page.locator(selector)).not.toContainText(
        /Admin|Manager|Sign In|Dashboard/i,
      );
    }
    await expect(page.locator("body")).not.toContainText(
      /1\s*SOL|monthly award|speaking slot or award|founder (?:prize|reward)/i,
    );
  }
});

test("full, closed, empty and failed availability never invent bookable seats or reveal a host login", async ({
  page,
}) => {
  const sessions = sundaySessions(new Date(), 3).map((s, i) => ({
    ...s,
    availableSeats: i === 0 ? 0 : i === 1 ? 1 : 4,
    status: i === 2 ? "Cancelled" : "Scheduled",
  }));
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions } }),
  );
  await page.goto("/");
  await expect(page.locator(".fl-preview-dates > button")).toHaveCount(3);
  await expect(page.locator(".fl-preview-dates > button").nth(0)).toContainText(
    "Full",
  );
  await expect(
    page.locator(".fl-preview-dates > button").nth(0),
  ).toBeDisabled();
  await expect(page.locator(".fl-preview-dates > button").nth(1)).toContainText(
    "Locked",
  );
  await expect(
    page.getByRole("link", { name: "Choose this Sunday" }),
  ).toHaveCount(0);
  await expect(page.locator(".fl-preview-dates > button").nth(2)).toContainText(
    "Locked",
  );
  await expect(
    page.locator(".fl-preview-dates > button").nth(2),
  ).toBeDisabled();
  await page.unroute("**/api/public/sessions");
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions: [] } }),
  );
  await page.goto("/");
  await expect(page.locator(".fl-preview-message")).toContainText(
    "No upcoming Sundays",
  );
  await expect(page.locator(".fl-preview-dates > button")).toHaveCount(0);
  await page.goto("/book");
  await expect(page.locator(".fl-preview-message")).toContainText(
    "No upcoming Sundays",
  );
  await expect(page.locator('a[href="/signin"]')).toHaveCount(0);
  await page.unroute("**/api/public/sessions");
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/");
  await expect(page.locator(".fl-preview-message")).toContainText(
    "Dates are temporarily unavailable",
  );
  await expect(page.locator(".fl-preview-dates > button")).toHaveCount(0);
});
