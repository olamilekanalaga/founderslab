import { test, expect } from "@playwright/test";

test("application starts with honest examples and accepts a bare domain through browser validation", async ({
  page,
}) => {
  await page.goto("/apply");
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
  for (const name of ["stage", "sector"]) {
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
