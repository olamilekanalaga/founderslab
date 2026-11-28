import type { Page } from "@playwright/test";

export async function openRegistrationForm(page: Page) {
  await page.getByRole("button", { name: "Continue to registration" }).click();
  await page.getByRole("button", { name: "Continue with this Sunday" }).click();
}
