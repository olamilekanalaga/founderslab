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
  await page.getByRole("button", { name: /18:00.*places available/ }).click();
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
  const companyId = companyHref!.split("/").at(-1)!;
  await page.goto("/demo/research");
  await page.getByRole("button", { name: "Add research", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const appearances = dialog.getByRole("combobox").first();
  const appearance = await appearances
    .locator("option")
    .filter({ hasText: "Sade Fictional" })
    .getAttribute("value");
  await appearances.selectOption(appearance!);
  const sections = dialog.locator("details");
  await expect(sections).toHaveCount(12);
  for (const details of await sections.all()) {
    if ((await details.getAttribute("open")) === null)
      await details.locator("summary").click();
    await details
      .locator("textarea")
      .fill(
        "Fictional interview evidence describes the customer's current workflow and next milestone.",
      );
  }
  await dialog
    .getByLabel("Evidence source")
    .fill(
      "Fictional founder interview, reviewed written notes and shared recording.",
    );
  await dialog.getByLabel("Research status").selectOption("Complete");
  await dialog
    .getByRole("button", { name: "Save research", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add business need", exact: true })
    .click();
  await page.getByLabel("Company", { exact: true }).selectOption(companyId);
  await page
    .getByLabel("Business need", { exact: true })
    .selectOption("Data analytics");
  await field(
    page,
    "Identified need",
    "The team needs a repeatable activation and retention analysis.",
  );
  await field(
    page,
    "Source evidence",
    "Fictional founder explicitly requested activation research during the interview.",
  );
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/demo/opportunities");
  await page
    .getByRole("button", { name: "Add opportunity", exact: true })
    .click();
  await page.getByLabel("Company", { exact: true }).selectOption(companyId);
  await page
    .getByLabel("Related founder", { exact: true })
    .selectOption(founderHref!.split("/").at(-1)!);
  const need = page.getByLabel("Documented business need", { exact: true });
  await need.selectOption(
    (await need.locator("option").last().getAttribute("value")) || "",
  );
  await field(
    page,
    "Potential solution",
    "Run a short activation funnel research engagement for the founder team.",
  );
  await field(page, "Decision-maker", "Sade Fictional");
  await field(
    page,
    "Evidence",
    "Fictional founder requested analytics help in the documented interview.",
  );
  await field(
    page,
    "Next action",
    "Schedule a scoped discovery call with the founder.",
  );
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Search opportunities").fill("Fictional Workflow Labs");
  await expect(page.locator(".opportunity-card")).toHaveCount(1);
  await page.goto("/demo/reports");
  await expect(page.getByTestId("report-founders")).toHaveText("51");
});
test("company classifications, opportunity stages, admin access and exports are interactive", async ({
  page,
}) => {
  await page.goto("/demo/companies");
  await page.getByLabel("Filter sector").selectOption("Payments");
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.goto("/demo/market-map");
  await page.getByRole("button", { name: "Network", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Company relationship network" }),
  ).toBeVisible();
  await page
    .getByLabel("Relationship type filter")
    .selectOption("Potential integration");
  await expect(
    page.locator('svg[aria-label="Company relationship network"] a'),
  ).toHaveCount(2);
  await page.goto("/demo/opportunities");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByLabel("Opportunity status filter").selectOption("Discovered");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.goto("/demo/opportunities");
  const status = page.getByLabel("Opportunity status o1", { exact: true });
  await status.selectOption("Qualified");
  await expect(
    page.locator(".kanban-column").filter({
      has: page.locator(".kanban-heading", { hasText: "Qualified" }),
    }),
  ).toContainText("KoraLane");
  await page.goto("/demo/reports");
  await expect(page.getByTestId("report-founders")).toHaveText("50");
  await page.getByLabel("Country", { exact: true }).selectOption("Nigeria");
  await expect(page.getByTestId("report-founders")).toHaveText("20");
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  await expect((await csv).suggestedFilename()).toBe(
    "founders-lab-research.csv",
  );
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await expect((await pdf).suggestedFilename()).toBe(
    "founders-lab-research.pdf",
  );
  await expect(page.getByLabel("Demo role preview")).toHaveCount(0);
  await page.goto("/demo/opportunities");
  await expect(
    page.getByRole("heading", { name: "Opportunity pipeline", exact: true }),
  ).toBeVisible();
  await page.goto("/book?mode=demo");
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveAttribute("href", "/signin");
});
test("research saves all twelve sections and campaign award decisions remain manual", async ({
  page,
}) => {
  await page.goto("/demo/research");
  await page.getByRole("button", { name: "Open / edit" }).first().click();
  await page
    .getByLabel("Notes · Founder origin and motivation", { exact: true })
    .fill(
      "Updated fictional motivation: making everyday payments easier for a narrow customer segment.",
    );
  await page
    .getByRole("button", { name: "Save research", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("saved");
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
      "/demo/space-data",
      "/demo/market-map",
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
    "/demo/spaces",
    "/demo/space-data",
    "/demo/classification",
    "/demo/research",
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

test("redesigned founder cards, classification labels and calendar preserve working records", async ({
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
  await page.goto("/demo/classification");
  await page
    .locator(".classification-group")
    .filter({ has: page.getByRole("heading", { name: "Sector", exact: true }) })
    .getByRole("button", { name: "Identity", exact: true })
    .click();
  await page.getByRole("button", { name: "Save labels", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".classification-group")
      .filter({
        has: page.getByRole("heading", { name: "Sector", exact: true }),
      })
      .getByRole("button", { name: "Identity", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/demo/companies");
  await page.getByLabel("Filter sector").selectOption("Identity");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.goto("/demo/spaces");
  await expect(page.locator(".agenda-session")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(page.locator(".calendar-panel")).toContainText("November 2026");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.locator(".agenda-session")).toHaveCount(4);
  await page.goto("/demo/research");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.locator(".research-takeaways article")).toHaveCount(12);
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(page.locator(".research-takeaways")).toContainText("Follow-up");
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

test("Space Data records actual team attendance and persists totals on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/demo/space-data");
  await expect(page.getByTestId("space-total-people")).toContainText("—");
  await page.getByLabel("Live listeners", { exact: true }).fill("120");
  await page.getByLabel("Space hours", { exact: true }).fill("1");
  await page.getByLabel("Space minutes", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.getByLabel("Founders attended 1", { exact: true }).fill("2");
  await page.getByLabel("Other team members 1", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Save Space data", exact: true })
    .click();
  await expect(page.getByTestId("space-total-people")).toContainText("3");
  await expect(
    page.getByRole("img", { name: /Cumulative founders/ }),
  ).toBeVisible();
  await page.getByLabel("Growth metric").selectOption("durationMinutes");
  await expect(
    page.getByRole("img", { name: /Cumulative hours hosted/ }),
  ).toHaveAttribute("aria-label", /1.5/);
  await expect(page.getByTestId("space-total-time")).toContainText("1h 30m");
  await page.reload();
  await expect(page.getByTestId("space-total-listeners")).toContainText("120");
  await page.getByLabel("Founders attended 1", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Save Space data", exact: true })
    .click();
  await expect(page.getByTestId("space-total-people")).toContainText("2");
  await page.getByLabel("Choose a Space").selectOption({ index: 1 });
  await page.getByLabel("Live listeners", { exact: true }).fill("80");
  await page.getByLabel("Space hours", { exact: true }).fill("0");
  await page.getByLabel("Space minutes", { exact: true }).fill("45");
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.getByLabel("Founders attended 1", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Save Space data", exact: true })
    .click();
  await expect(page.getByTestId("space-total-listeners")).toContainText("200");
  await expect(page.getByTestId("space-total-time")).toContainText("2h 15m");
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "artifacts/space-data-filled-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
    seed.sessions.find((s: { id: string }) => s.id === "up1").capacity = 1;
    seed.participants.push({
      ...seed.participants[0],
      id: "full-saturday",
      sessionId: "up1",
      attendance: "Approved",
    });
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
    page.getByRole("button", { name: /Saturday, 12 December 2026/ }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: /Saturday, 12 December 2026/ })
    .click();
  await page.getByRole("button", { name: /18:00.*places available/ }).click();
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
