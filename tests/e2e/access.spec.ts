import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public booking is light, backend-backed and limited to eight Saturdays", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/book?mode=demo");
  await expect(page.locator(".weekly-date")).toHaveCount(8);
  await expect(page.locator(".fl-date-panel-heading")).toContainText(
    "7 PM London",
  );
  await expect(page.locator(".fl-date-group")).toHaveCount(2);
  await expect(page.getByText("Demo mode", { exact: true })).toHaveCount(0);
  await expect(page.locator(".public-footer")).toContainText("⭕️La_Crrypt💰₿");
  await expect(page.locator(".weekly-date").first()).toContainText(
    /slots? left|Full/,
  );
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: "artifacts/saas-booking-mobile.png",
    fullPage: true,
  });
});
test("browser storage cannot grant Admin access or enable a demo", async ({
  page,
  request,
}) => {
  await page.goto("/signin");
  await page.evaluate(() => {
    localStorage.setItem(
      "founders-lab-demo-v1",
      JSON.stringify({ role: "admin" }),
    );
    document.cookie = "fl_session=forged; path=/";
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin$/);
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect((await request.get("/api/space-managers")).status()).toBe(401);
  expect((await request.get("/api/manager/spaces")).status()).toBe(401);
  expect((await request.get("/demo")).status()).toBe(404);
  expect(
    (
      await request.post("/api/auth/signup", {
        headers: { Origin: new URL(page.url()).origin },
        data: {
          email: "unauthorised@example.invalid",
          password: "not-a-real-password",
        },
      })
    ).status(),
  ).toBe(404);
});
test("application and manager sign-in contain no demo or public account signup", async ({
  page,
}) => {
  for (const route of ["/apply", "/signin", "/manager/spaces"]) {
    await page.goto(route);
    await expect(page.getByText("Demo mode", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /demo/i })).toHaveCount(0);
  }
});
