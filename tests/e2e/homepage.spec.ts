import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { saturdaySessions } from "@/lib/dates/saturday-schedule";
import type { PublicSession } from "@/lib/dates/booking";

const headline =
  "Building connections between founders, products and opportunities.";
for (const [label, width, height] of [
  ["desktop", 1440, 1024],
  ["mobile", 393, 852],
] as const) {
  test(`homepage uses live booking data with a light accessible ${label} layout`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);
    await expect(
      page.getByRole("heading", { name: "How It Works", exact: true }),
    ).toBeVisible();
    const sessions: PublicSession[] = (
      await (await request.get("/api/public/sessions")).json()
    ).sessions;
    const upcoming = sessions
      .filter((s) => Date.parse(s.startsAt) > Date.now())
      .slice(0, 3);
    await expect(page.locator(".programme-session-card")).toHaveCount(
      upcoming.length,
    );
    for (const session of upcoming) {
      const card = page.locator(`[data-session-id="${session.id}"]`);
      await expect(card).toContainText(
        session.availableSeats > 0
          ? `${session.availableSeats} ${session.availableSeats === 1 ? "slot" : "slots"} left`
          : "Full",
      );
      await expect(card).toContainText(
        `${session.capacity} project seats per Space`,
      );
    }
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
      await expect(page.locator(".programme-session-card")).toHaveCount(
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
      path: `artifacts/v4-homepage-${label}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "View All Available Dates" }).click();
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.locator(".weekly-date")).toHaveCount(8);
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
  const sessions = saturdaySessions(new Date(), 3).map((s, i) => ({
    ...s,
    availableSeats: i === 0 ? 0 : i === 1 ? 1 : 4,
    status: i === 2 ? "Cancelled" : "Scheduled",
  }));
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions } }),
  );
  await page.goto("/");
  await expect(page.locator(".programme-session-card")).toHaveCount(3);
  await expect(page.locator(".programme-session-card").nth(0)).toContainText(
    "Full",
  );
  await expect(
    page.locator(".programme-session-card").nth(0).getByRole("link"),
  ).toHaveCount(0);
  await expect(page.locator(".programme-session-card").nth(1)).toContainText(
    "1 slot left",
  );
  await expect(
    page.locator(".programme-session-card").nth(1).getByRole("link"),
  ).toHaveAttribute("href", `/apply?session=${sessions[1].id}`);
  await expect(page.locator(".programme-session-card").nth(2)).toContainText(
    "Closed",
  );
  await expect(
    page.locator(".programme-session-card").nth(2).getByRole("link"),
  ).toHaveCount(0);
  await page.unroute("**/api/public/sessions");
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions: [] } }),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("No upcoming Saturdays");
  await expect(page.locator(".programme-session-card")).toHaveCount(0);
  await page.goto("/book");
  await expect(page.locator(".calendar-empty-state")).toBeVisible();
  await expect(page.locator('a[href="/signin"]')).toHaveCount(0);
  await page.unroute("**/api/public/sessions");
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Live availability is temporarily unavailable",
  );
  await expect(page.locator(".programme-session-card")).toHaveCount(0);
});
