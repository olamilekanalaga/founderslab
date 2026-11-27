import { expect, test } from "@playwright/test";
import { sundaySessions } from "@/lib/dates/sunday-schedule";

for (const [width, height] of [
  [320, 710],
  [393, 852],
  [1440, 900],
]) {
  test(`homepage opening and scroll motion at ${width}px keep bookings usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const sessions = sundaySessions(new Date(), 3).map((session, index) => ({
      ...session,
      availableSeats: 4,
      bookingLocked: index > 0,
    }));
    await page.route("**/api/public/sessions", (route) =>
      route.fulfill({ json: { sessions } }),
    );

    await page.goto("/");
    const opening = page.locator(".fl-hero-opening");
    await expect(opening).toHaveCSS("animation-name", "fl-opening-wipe");
    await expect(opening).toHaveCSS("pointer-events", "none");
    await expect(opening).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
      "opacity",
      "1",
    );
    const preview = page.locator("#choose-a-sunday");
    await expect(preview.getByRole("button", { disabled: true })).toHaveCount(
      2,
    );

    const progress = page.locator(".fl-home-progress");
    const initialTransform = await progress.evaluate(
      (bar) => getComputedStyle(bar).transform,
    );
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(progress).not.toHaveCSS("transform", initialTransform);
    await expect(page.locator(".fl-hero-copy")).not.toHaveCSS(
      "translate",
      "0px",
    );
    await page.locator("#about").scrollIntoViewIfNeeded();
    await expect(page.locator(".fl-about-intro")).toHaveCSS(
      "animation-name",
      "fl-scroll-reveal",
    );
    await page.locator("#how-it-works").scrollIntoViewIfNeeded();
    await expect(page.locator(".fl-process-steps li").first()).toHaveCSS(
      "animation-name",
      "fl-scroll-reveal",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    const choose = preview.getByRole("link", { name: "Choose this Sunday" });
    await choose.focus();
    await expect(choose).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`/apply?session=${sessions[0].id}`);
    await expect(page.getByLabel("Founder name")).toBeVisible();
    await expect(page.locator(".fl-hero-opening")).toHaveCount(0);
  });
}

test("reduced motion makes the homepage and anchored booking immediately available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/#choose-a-sunday");
  await expect(page.locator(".fl-hero-opening")).toBeHidden();
  await expect(page.locator(".fl-home-progress")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#choose-a-sunday")).toBeVisible();
  await page.locator("#how-it-works").scrollIntoViewIfNeeded();
  await expect(page.locator(".fl-process-intro")).toHaveCSS("opacity", "1");
});
