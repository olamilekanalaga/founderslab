import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function field(page: Page, name: string, value: string) {
  await page.getByLabel(name, { exact: true }).fill(value);
}
test("demo opens without login, edits persist, and reset restores 50 fictional founders", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".demo-banner")).toContainText("Fictional demo");
  await page.goto("/demo/founders");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("button", { name: "Add founder", exact: true }).click();
  await field(page, "Founder name", "Fictional Test Founder");
  await field(page, "Role", "Founder");
  await field(page, "X username", "test_founder_demo");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.getByLabel("Search founders").fill("Fictional Test Founder");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByLabel("Search founders").fill("Fictional Test Founder");
  await expect(page.locator("tbody")).toContainText("Fictional Test Founder");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset fictional demo", exact: true })
    .click();
  await page.goto("/demo/founders");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(50);
});
test("demo application, approval, booking and one recording propagate to linked profiles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/book?mode=demo");
  await page.getByRole("button", { name: /Saturday, 5 December 2026/ }).click();
  await page.getByRole("button", { name: /17:00.*places available/ }).click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/apply\?session=up1&mode=demo/);
  await expect(page.locator(".selected-booking")).toContainText("5 Dec");
  await field(page, "Founder name", "Sade Fictional");
  await field(page, "Company / project name", "Fictional Workflow Labs");
  await field(page, "X username", "sade_workflow_demo");
  await field(
    page,
    "Company website or public project link",
    "https://workflow.example.invalid",
  );
  await field(page, "Short product description", "Pay");
  await field(page, "Main business focus", "AI");
  await page
    .getByLabel("I agree to the privacy notice and programme terms.")
    .check();
  await page
    .getByRole("button", { name: "Submit founder application", exact: true })
    .click();
  await expect(page).toHaveURL(/confirmation#demo=/);
  await expect(
    page.getByRole("heading", { name: "You’re on our radar." }),
  ).toBeVisible();
  await page.goto("/demo/spaces?tab=applications");
  const appRow = page
    .locator("tbody tr")
    .filter({ hasText: "Fictional Workflow Labs" });
  await appRow.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve application", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Founder and company records are linked",
  );
  const founderHref = await page
    .getByRole("link", { name: "Open founder profile" })
    .getAttribute("href");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/demo/spaces?tab=bookings");
  const booking = page
    .locator("tbody tr")
    .filter({ hasText: "Fictional Workflow Labs" });
  await booking.getByRole("combobox").selectOption("Approved");
  await expect(booking.getByRole("combobox")).toHaveValue("Approved");
  await booking.getByRole("link").click();
  await page.getByRole("button", { name: "Edit session & recording" }).click();
  await field(
    page,
    "Shared recording URL",
    "https://spaces.example.invalid/recording/shared-workflow",
  );
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.goto(founderHref!);
  await expect(
    page.getByRole("link", { name: "Session recording" }),
  ).toHaveAttribute(
    "href",
    "https://spaces.example.invalid/recording/shared-workflow",
  );
  const companyHref = await page
    .locator(".entity-row")
    .filter({ hasText: "Fictional Workflow Labs" })
    .getAttribute("href");
  await page.goto(companyHref!);
  await expect(
    page.getByRole("link", { name: "Shared session recording" }),
  ).toHaveAttribute(
    "href",
    "https://spaces.example.invalid/recording/shared-workflow",
  );
  await page.screenshot({
    path: "artifacts/shared-recording-mobile.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "Short description", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Pay");
  await expect(page.getByText("Research notes", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/demo/reports");
  await expect(page.getByTestId("report-founders")).toHaveText("51");
});
test("company filters, simple reports, admin access and exports are interactive", async ({
  page,
}) => {
  await page.goto("/demo/companies");
  await page.getByLabel("Filter sector").selectOption("Payments");
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.goto("/demo/reports");
  await expect(page.getByTestId("report-founders")).toHaveText("50");
  await page.getByLabel("Country", { exact: true }).selectOption("Nigeria");
  await expect(page.getByTestId("report-founders")).toHaveText("20");
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  await expect((await csv).suggestedFilename()).toBe(
    "founders-lab-records.csv",
  );
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await expect((await pdf).suggestedFilename()).toBe(
    "founders-lab-records.pdf",
  );
  await expect(page.getByLabel("Demo role preview")).toHaveCount(0);
  await page.goto("/book?mode=demo");
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveAttribute("href", "/signin");
});
test("campaign award decisions remain manual", async ({ page }) => {
  await page.goto("/demo/campaigns");
  await page.getByRole("button", { name: /November founder cohort/ }).click();
  await page.getByRole("button", { name: "Add / update assessment" }).click();
  await page.getByLabel("Founder", { exact: true }).selectOption("f50");
  await page.getByLabel("Eligible under published rules").check();
  await page
    .getByLabel("Reviewer assessment and any conflicts")
    .fill(
      "All eligibility criteria reviewed, strong customer evidence, and no reviewer conflict declared.",
    );
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page
    .getByRole("button", { name: "Record human decision", exact: true })
    .click();
  await page.getByLabel("Eligible founder").selectOption("f50");
  await page
    .getByLabel("Human selection rationale and conflicts")
    .fill(
      "Selected on the published criteria with documented product progress and no reviewer conflict.",
    );
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.locator(".award-winner")).toContainText("Isabel Cruz");
  await expect(page.getByText(/no transfer is claimed/)).toBeVisible();
});
test("iPhone, tablet and desktop views have working navigation and no horizontal overflow", async ({
  page,
}) => {
  for (const [width, height] of [
    [393, 852],
    [375, 812],
    [834, 1112],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of [
      "/demo",
      "/demo/founders",
      "/demo/spaces",
      "/demo/reports",
      "/apply?mode=demo",
    ]) {
      await page.goto(route);
      await page.locator("h1").first().waitFor();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} @ ${width}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Founders", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Founder directory" }),
  ).toBeVisible();
});
test("core mobile views pass automated accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  for (const route of [
    "/demo",
    "/demo/founders",
    "/demo/founders/f1",
    "/demo/companies",
    "/demo/companies/c1",
    "/demo/spaces",
    "/demo/reports",
    "/apply?mode=demo",
    "/book?mode=demo",
  ]) {
    await page.goto(route);
    await page.locator("h1").first().waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(result.violations, route).toEqual([]);
  }
});

test("simple founder details and calendar preserve working records", async ({
  page,
}) => {
  await page.goto("/demo/founders");
  await expect(page.locator(".founder-tile")).toHaveCount(12);
  await page.getByLabel("Search founders").fill("Amara");
  await expect(page.locator(".founder-tile")).toHaveCount(1);
  await page.getByRole("link", { name: "Amara Okafor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Amara Okafor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Research notes" }),
  ).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Follow-up");
  await page.goto("/demo/companies/c1");
  await page.getByRole("button", { name: "Edit company", exact: true }).click();
  await page
    .getByLabel("Product description", { exact: true })
    .fill("Payments for local teams.");
  await expect(page.getByLabel("Reported business challenges")).toHaveCount(0);
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.reload();
  await expect(page.locator("main")).toContainText("Payments for local teams.");
  await page.goto("/demo/spaces");
  await expect(page.locator(".agenda-session")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(page.locator(".calendar-panel")).toContainText("November 2026");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.locator(".agenda-session")).toHaveCount(4);
  await page.goto("/demo/research");
  await expect(page).toHaveURL(/demo\/founders$/);
  await expect(
    page.getByRole("link", { name: "Research", exact: true }),
  ).toHaveCount(0);
});

test("short founder answers submit and invalid inputs show a readable message", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/apply?mode=demo");
  await field(page, "Founder name", "Short Answer");
  await field(page, "Company / project name", "Short Form Demo");
  await field(page, "X username", "bad handle");
  await field(
    page,
    "Company website or public project link",
    "https://short.example.invalid",
  );
  await field(page, "Short product description", "Pay");
  await field(page, "Main business focus", "AI");
  await page
    .getByLabel("I agree to the privacy notice and programme terms.")
    .check();
  await page
    .getByRole("button", { name: "Submit founder application", exact: true })
    .click();
  await expect(page.locator(".public-form").getByRole("alert")).toContainText(
    "X username:",
  );
  await expect(
    page.locator(".public-form").getByRole("alert"),
  ).not.toContainText('"code"');
  await field(page, "X username", "short_answer_demo");
  await page
    .getByRole("button", { name: "Submit founder application", exact: true })
    .click();
  await expect(page).toHaveURL(/confirmation#demo=/);
});

test("weekly Space totals are shared between founders while team attendance stays separate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/demo/founders/f1");
  await expect(
    page.getByRole("link", { name: "Space Data", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("week-listeners")).toContainText("—");
  await page
    .getByRole("button", { name: "Edit weekly Space data", exact: true })
    .click();
  await page
    .getByLabel("Shared X post URL", { exact: true })
    .fill("https://posts.example.invalid/weekly/s1");
  await page
    .getByLabel("Shared Space URL", { exact: true })
    .fill("https://spaces.example.invalid/weekly/s1");
  await page.getByLabel("Live listeners", { exact: true }).fill("120");
  await page.getByLabel("Space hours", { exact: true }).fill("1");
  await page.getByLabel("Space minutes", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.getByLabel("Founders attended 1", { exact: true }).fill("1");
  await page.getByLabel("Other team members 1", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.getByLabel("Founders attended 2", { exact: true }).fill("2");
  await page.getByLabel("Other team members 2", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Save Space data", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByTestId("week-founders")).toHaveText("3");
  await expect(page.getByTestId("week-people")).toHaveText("10");
  await expect(page.getByTestId("project-people-c1")).toHaveText("4");
  await page.goto("/demo/founders/f2");
  await expect(page.getByTestId("week-listeners")).toHaveText("120");
  await expect(
    page.getByRole("link", { name: "Weekly X post", exact: true }),
  ).toHaveAttribute("href", "https://posts.example.invalid/weekly/s1");
  await expect(
    page.getByRole("link", { name: "Weekly Space", exact: true }),
  ).toHaveAttribute("href", "https://spaces.example.invalid/weekly/s1");
  await expect(page.getByTestId("week-duration")).toHaveText("1h 30m");
  await expect(page.getByTestId("project-founders-c2")).toHaveText("2");
  await expect(page.getByTestId("project-people-c2")).toHaveText("6");
  await page
    .getByRole("button", { name: "Edit weekly Space data", exact: true })
    .click();
  await page.getByLabel("Live listeners", { exact: true }).fill("200");
  await page
    .getByRole("button", { name: "Save Space data", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.goto("/demo/founders/f1");
  await expect(page.getByTestId("week-listeners")).toHaveText("200");
  await expect(
    page.getByRole("link", { name: "Weekly X post", exact: true }),
  ).toHaveAttribute("href", "https://posts.example.invalid/weekly/s1");
  await expect(page.getByTestId("project-people-c1")).toHaveText("4");
  await page.reload();
  await expect(page.getByTestId("week-founders")).toHaveText("3");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/founder-week-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.screenshot({
    path: "artifacts/founder-week-desktop.png",
    fullPage: true,
  });
  await page.goto("/demo");
  await page.getByLabel("Growth metric").selectOption("durationMinutes");
  await expect(
    page.getByRole("img", { name: /Cumulative hours hosted/ }),
  ).toHaveAttribute("aria-label", /1.5/);
  await page.goto("/demo/space-data");
  await expect(page).toHaveURL(/demo\/founders$/);
});

test("public booking calendar enables only open Saturdays and disables full dates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset fictional demo", exact: true })
    .click();
  await page.evaluate(() => {
    const seed = JSON.parse(localStorage.getItem("founders-lab-demo-v1")!);
    seed.companies
      .slice(0, 5)
      .forEach((company: { id: string }, index: number) =>
        seed.participants.push({
          ...seed.participants[0],
          id: `full-saturday-${index}`,
          companyId: company.id,
          sessionId: "up1",
          attendance: "Approved",
        }),
      );
    localStorage.setItem("founders-lab-demo-v1", JSON.stringify(seed));
  });
  await page.goto("/book?mode=demo");
  await expect(
    page.getByRole("button", { name: /Saturday, 5 December 2026, full/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Friday, 4 December 2026/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Saturday, 5 December 2026, full/ }),
  ).toContainText("5/5");
  await expect(
    page.getByRole("button", { name: /Saturday, 12 December 2026/ }),
  ).toContainText("0/5");
  await expect(
    page.getByRole("button", { name: /Saturday, 12 December 2026/ }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: /Saturday, 12 December 2026/ })
    .click();
  await page.getByRole("button", { name: /17:00.*places available/ }).click();
  await expect(
    page.getByRole("link", { name: "Continue", exact: true }),
  ).toHaveAttribute("href", "/apply?session=up2&mode=demo");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/booking-calendar-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.screenshot({
    path: "artifacts/booking-calendar-desktop.png",
    fullPage: true,
  });
});

test("empty real-style calendar explains unpublished dates and shows UTC", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset fictional demo", exact: true })
    .click();
  await page.evaluate(() => {
    const seed = JSON.parse(localStorage.getItem("founders-lab-demo-v1")!);
    seed.sessions = seed.sessions.filter(
      (s: { status: string }) => s.status !== "Scheduled",
    );
    localStorage.setItem("founders-lab-demo-v1", JSON.stringify(seed));
  });
  await page.goto("/book?mode=demo");
  await expect(page.getByRole("status")).toContainText(
    "No Saturday slots published yet",
  );
  await expect(page.locator(".booking-intro")).toContainText("UTC / GMT");
  await expect(page.locator(".booking-days button:enabled")).toHaveCount(0);
});
