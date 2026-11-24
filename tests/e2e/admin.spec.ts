import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const email = process.env.FOUNDERSLAB_TEST_ADMIN_EMAIL;
const password = process.env.FOUNDERSLAB_TEST_ADMIN_PASSWORD;
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
test.describe("Admin experience", () => {
  test.skip(
    !email || !password,
    "Requires explicitly configured isolated local Admin credentials.",
  );
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const page = await context.newPage();
    await page.goto("/signin");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/auth/login"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await response).status()).toBe(200);
    await page.waitForURL("**/dashboard");
    cookies = await context.cookies();
    await context.close();
  });
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies(cookies);
    await page.goto("/dashboard");
    await expect(page.locator(".desk-grid")).toBeVisible();
  });
  test("workspace search supports repeated queries and distinct company results", async ({
    page,
  }) => {
    for (const q of ["first-query", "second-query"]) {
      await page
        .getByRole("button", { name: "Search workspace", exact: true })
        .click();
      await page.getByLabel("Search founders and companies").fill(q);
      await page
        .getByRole("link", { name: "Search all founders", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`founders\\?q=${q}`));
      await expect(page.getByLabel("Search founders")).toHaveValue(q);
    }
    await page
      .getByRole("button", { name: "Search workspace", exact: true })
      .click();
    await page
      .getByLabel("Search founders and companies")
      .fill("company-query");
    await page
      .getByRole("link", { name: "Search all companies", exact: true })
      .click();
    await expect(page).toHaveURL(/companies\?q=company-query/);
    await expect(page.getByLabel("Search companies")).toHaveValue(
      "company-query",
    );
  });
  test("Operations deep links and browser history select the intended workflow", async ({
    page,
  }) => {
    await page.goto("/operations?tab=applications&status=Pending");
    await expect(
      page.getByRole("button", {
        name: "Review founder applications",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Space workflow status")).toHaveValue(
      "Pending",
    );
    await page.goto("/operations?tab=bookings");
    await expect(
      page.getByRole("button", { name: "Manage bookings", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(
      page.getByRole("button", {
        name: "Review founder applications",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Enter Space data", exact: true })
      .click();
    await expect(page).toHaveURL(/operations\?tab=sessions$/);
    await expect(
      page.getByRole("button", { name: "Create Space", exact: true }),
    ).toBeVisible();
  });
  test("mobile navigation and account sign-out revoke the current real session", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      viewport: { width: 393, height: 852 },
    });
    const page = await context.newPage();
    await page.goto("/signin");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.setViewportSize({ width: 393, height: 852 });
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: /Open account menu for/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(page).toHaveURL(/\/signin$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    await context.close();
  });
  test("dirty forms preserve edits until the user explicitly discards them", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Add founder", exact: true })
      .click();
    await page
      .getByLabel("Founder name", { exact: true })
      .fill("Unsaved acceptance draft");
    await page.keyboard.press("Escape");
    await expect(
      page.getByText("Discard unsaved changes?", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(page.getByLabel("Founder name", { exact: true })).toHaveValue(
      "Unsaved acceptance draft",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  test("workflow status remains valid when switching from sessions to applications", async ({
    page,
  }) => {
    await page.goto("/spaces");
    await page.getByLabel("Space workflow status").selectOption("Scheduled");
    await page.getByRole("button", { name: /^Applications/ }).click();
    await expect(page.getByLabel("Space workflow status")).toHaveValue("All");
    await page.getByLabel("Space workflow status").selectOption("Pending");
    await page.getByRole("button", { name: "Sessions", exact: true }).click();
    await expect(page.getByLabel("Space workflow status")).toHaveValue("All");
  });
  test("server validation identifies the field and preserves unsaved input", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Add founder", exact: true })
      .click();
    await page
      .getByLabel("Founder name", { exact: true })
      .fill("Invalid country acceptance");
    await page
      .getByLabel("Founder X", { exact: true })
      .fill("invalid_country_acceptance");
    await page
      .getByLabel("Country", { exact: true })
      .fill("Not a real country");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/workspace") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    expect((await response).status()).toBe(400);
    await expect(page.getByLabel("Country", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#founder-country-error")).toContainText(
      "Choose a country from the list",
    );
    await expect(page.getByLabel("Founder name", { exact: true })).toHaveValue(
      "Invalid country acceptance",
    );
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
  });
  test("refresh errors are persistent and recover without losing the workspace", async ({
    page,
  }) => {
    await page.route("**/api/workspace", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Acceptance simulation: refresh unavailable",
        }),
      }),
    );
    await page
      .getByRole("button", { name: "Refresh workspace", exact: true })
      .click();
    await expect(page.locator(".toast[role=alert]")).toContainText(
      "Acceptance simulation: refresh unavailable",
    );
    await expect(page.locator(".desk-grid")).toBeVisible();
    await page.unroute("**/api/workspace");
    await page
      .getByRole("button", { name: "Refresh workspace", exact: true })
      .click();
    await expect(page.locator(".toast[role=status]")).toContainText(
      "Workspace refreshed.",
    );
  });
  test("manager load failures provide retry and do not claim email is disconnected", async ({
    page,
  }) => {
    await page.route("**/api/space-managers", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Acceptance simulation: manager service unavailable",
        }),
      }),
    );
    await page.goto("/owner-invitations");
    await expect(
      page.locator(".space-managers-settings [role=alert]"),
    ).toContainText("Space Managers couldn’t load.");
    await expect(
      page.getByRole("button", { name: "Retry", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Email delivery is not connected.", { exact: false }),
    ).toHaveCount(0);
    await page.unroute("**/api/space-managers");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.getByText("No Space Managers invited.", { exact: true }),
    ).toBeVisible();
  });
  for (const zone of ["Africa/Lagos", "Europe/London", "America/New_York"]) {
    test(`UTC clock stays unchanged in ${zone}`, async ({ browser }) => {
      const context = await browser.newContext({ timezoneId: zone }),
        page = await context.newPage();
      try {
        await context.addCookies(cookies);
        await page.goto(`${test.info().project.use.baseURL}/spaces`);
        await page
          .getByRole("button", { name: "Create Space", exact: true })
          .click();
        await page
          .getByLabel("Session starts · UTC", { exact: true })
          .fill("2027-06-05T18:00");
        await expect(
          page.getByLabel("Session starts · UTC", { exact: true }),
        ).toHaveValue("2027-06-05T18:00");
        await expect(page.locator(".time-preview")).toContainText("19:00");
      } finally {
        await context.close();
      }
    });
  }
  test("admin desktop and phone views fit and have no scoped accessibility violations", async ({
    page,
  }) => {
    test.setTimeout(120000);
    for (const width of [1440, 393]) {
      await page.setViewportSize({ width, height: width === 393 ? 852 : 1000 });
      for (const route of [
        "/dashboard",
        "/founders",
        "/companies",
        "/spaces",
        "/spaces?tab=applications",
        "/reports",
        "/owner-invitations",
      ]) {
        await page.goto(route);
        await expect(page.locator("main h1")).toBeVisible();
        if (route === "/owner-invitations")
          await expect(
            page.getByText("No Space Managers invited.", { exact: true }),
          ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(axe.violations).toEqual([]);
      }
    }
  });
});
