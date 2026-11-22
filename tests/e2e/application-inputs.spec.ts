import { test, expect } from "@playwright/test";

test("application starts with honest examples and accepts a bare domain through browser validation", async ({
  page,
}) => {
  await page.goto("/apply");
  await expect(
    page.getByRole("heading", { name: "About you", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "About your project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Your personal X username", { exact: true }),
  ).toHaveAttribute("required", "");
  await expect(page.locator('input[name="projectXHandle"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("Contact email (private)")).toHaveAttribute(
    "type",
    "email",
  );
  await expect(page.getByLabel("Contact email (private)")).toHaveAttribute(
    "placeholder",
    "Optional",
  );
  await expect(page.getByLabel("Contact email (private)")).not.toHaveAttribute(
    "required",
  );
  await expect(page.locator('input[name="country"]')).toHaveValue("");
  await expect(page.locator('input[name="country"]')).toHaveAttribute(
    "placeholder",
    "United Kingdom",
  );
  const website = page.getByLabel("Company website or public project link");
  await expect(website).toHaveAttribute("placeholder", "example.com");
  await website.fill("Ola.com");
  expect(
    await website.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  for (const name of ["stage", "sector", "teamSize"]) {
    const field = page.locator(`select[name="${name}"]`);
    await expect(field).toHaveValue("");
    await expect(field.locator("option:checked")).toHaveText(
      "Select an option",
    );
    expect(
      await field.evaluate((el: HTMLSelectElement) => el.checkValidity()),
    ).toBe(false);
  }
});

test("missing required answers focus the field, while optional email and normalized casing/spacing submit", async ({
  page,
}) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/public/apply", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        token: "a".repeat(48),
        reference: "FORM-TEST",
        companyName: "Example",
        status: "Pending",
      },
    });
  });
  await page.goto("/apply");
  await page
    .getByRole("button", { name: "Submit founder application" })
    .click();
  await expect(page.locator('input[name="founderName"]')).toBeFocused();
  for (const [name, value] of Object.entries({
    founderName: "Example Founder",
    companyName: "Example Project",
    xHandle: " @ Personal_Founder ",
    projectXHandle: " @ Official_Project ",
    website: "Example.com",
    country: "  united   KINGDOM  ",
    description: "A product",
    focus: "A customer need",
    teamCountries: "United Kingdom",
    ecosystem: "None",
    seeking: "None",
    comments: "None",
  })) {
    await page.locator(`.public-form [name="${name}"]`).fill(value);
  }
  await page.locator('select[name="teamSize"]').selectOption("2–5");
  await page.locator('select[name="speakers"]').selectOption("1");
  await page.locator('select[name="hiring"]').selectOption("no");
  await page.locator('select[name="stage"]').selectOption("MVP");
  await page.locator('select[name="sector"]').selectOption("Payments");
  await page
    .getByLabel("I agree to the privacy notice and programme terms.")
    .check();
  await page
    .getByRole("button", { name: "Submit founder application" })
    .click();
  await expect(page).toHaveURL(/\/confirmation#token=/);
  expect(submitted?.contact).toBe("");
  expect(submitted?.xHandle).toBe("personal_founder");
  expect(submitted?.projectXHandle).toBe("official_project");
  expect(submitted?.country).toBe("United Kingdom");
  expect(submitted?.website).toBe("https://Example.com");
});
