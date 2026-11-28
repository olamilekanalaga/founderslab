import { test, expect } from "@playwright/test";
import { projectLogoPng } from "../fixtures/project-logo";
import { businessDiscovery } from "../fixtures/business-discovery";
import {
  discoveryQuestions,
  researchAcknowledgements,
} from "@/lib/business-research";
import { openRegistrationForm } from "./registration-steps";

test("application starts with honest examples and accepts a bare domain through browser validation", async ({
  page,
}) => {
  await page.goto("/apply");
  await expect(
    page.getByRole("heading", { name: "More than a conversation." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "This format is not for me" }),
  ).toHaveAttribute("href", "/");
  await openRegistrationForm(page);
  const contact = page.getByRole("region", {
    name: "Let’s connect before your Space",
  });
  await expect(
    page.locator(".founder-application-card + .founder-contact"),
  ).toBeVisible();
  await expect(
    contact.getByRole("link", { name: "X DM", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://x.com/messages/compose?recipient_id=1506909333740826628",
  );
  await expect(
    contact.getByRole("link", { name: "Telegram", exact: true }),
  ).toHaveAttribute("href", "https://t.me/ola_crrypt");
  await expect(
    page.getByRole("heading", { name: "About you", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "About your project", exact: true }),
  ).toBeVisible();
  await expect(page.locator('input[name="xHandle"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.locator('input[name="projectXHandle"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("Email (optional)")).toHaveAttribute(
    "type",
    "email",
  );
  await expect(page.getByLabel("Email (optional)")).toHaveAttribute(
    "placeholder",
    "Optional",
  );
  await expect(page.getByLabel("Email (optional)")).not.toHaveAttribute(
    "required",
  );
  await expect(page.locator('input[name="country"]')).toHaveValue("");
  await expect(page.locator('input[name="country"]')).toHaveAttribute(
    "placeholder",
    "United Kingdom",
  );
  const website = page.getByLabel("Website");
  await expect(website).toHaveAttribute("placeholder", "example.com");
  await website.fill("Ola.com");
  expect(
    await website.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  for (const name of [
    "stage",
    "teamCountries",
    "seeking",
    "focus",
    "comments",
  ]) {
    await expect(page.locator(`.public-form [name="${name}"]`)).toHaveCount(0);
  }
  await expect(
    page.locator(".public-form input[name=ecosystem]"),
  ).toHaveAttribute("required", "");
  for (const name of ["sector", "teamSize"]) {
    const field = page.locator(`select[name="${name}"]`);
    await expect(field).toHaveValue("");
    await expect(field.locator("option:checked")).toHaveText("Select");
    expect(
      await field.evaluate((el: HTMLSelectElement) => el.checkValidity()),
    ).toBe(false);
  }
});

test("mobile booking highlights missing and invalid answers, then submits corrected inputs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({
      json: {
        sessions: [
          {
            id: "test-sunday",
            title: "Test Space",
            startsAt: "2030-01-06T19:00:00.000Z",
            deadline: "2030-01-06T19:00:00.000Z",
            status: "Scheduled",
            availableSeats: 3,
          },
        ],
      },
    }),
  );
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === "fl-confirmation-token")
        throw new DOMException("Storage is blocked", "SecurityError");
      setItem.call(this, name, value);
    };
  });
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
  await page.route("**/api/public/confirmation", (route) =>
    route.fulfill({
      json: {
        reference: "FORM-TEST",
        companyName: "Example Project",
        status: "Pending",
        bookings: [],
      },
    }),
  );
  await page.goto("/apply?session=test-sunday");
  await openRegistrationForm(page);
  await expect(page.getByLabel("Founder name")).toBeVisible();
  for (const [leftName, rightName] of [
    ["xHandle", "founderRole"],
    ["projectXHandle", "website"],
    ["speakers", "sector"],
    ["ecosystem", "hiring"],
  ]) {
    const left = await page.locator(`[name="${leftName}"]`).boundingBox();
    const right = await page.locator(`[name="${rightName}"]`).boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.y).toBeCloseTo(right!.y);
    expect(left!.x + left!.width).toBeLessThan(right!.x);
  }
  const nameWidth = (await page.getByLabel("Founder name").boundingBox())!
    .width;
  const xWidth = (await page.locator('[name="xHandle"]').boundingBox())!.width;
  expect(nameWidth).toBeGreaterThan(2 * xWidth);
  const submit = page.getByRole("button", {
    name: "Request booking",
  });
  await expect(submit.locator("svg")).toHaveCount(0);
  await submit.click();
  const founderName = page.getByRole("textbox", {
    name: "Founder name",
    exact: true,
  });
  await expect(founderName).toBeFocused();
  await expect(founderName).toHaveAttribute("aria-invalid", "true");
  await expect(founderName).toHaveAccessibleDescription("Fill in this field.");
  await expect(page.getByLabel("Hiring?")).toHaveAccessibleDescription(
    "Select an option.",
  );
  await expect(
    page.getByLabel("I agree to the privacy notice and programme terms."),
  ).toHaveAccessibleDescription(
    "Accept the privacy notice and programme terms.",
  );
  const feedback = page.locator(".public-form > .error");
  await expect(feedback).toContainText(/Check the \d+ highlighted fields/);
  expect(submitted).toBeUndefined();

  const personalX = page.locator('input[name="xHandle"]');
  await personalX.fill("https://x.com/sample");
  const contactEmail = page.getByLabel("Email (optional)");
  await contactEmail.fill("invalid-email");
  const speakers = page.locator('select[name="speakers"]');
  await speakers.selectOption("Other");
  const numberOfSpeakers = page.getByLabel("Number of speakers");
  await numberOfSpeakers.fill("3");
  await submit.click();
  await expect(personalX).toHaveAccessibleDescription(
    "Use an X username without a URL",
  );
  await expect(contactEmail).toHaveAccessibleDescription(
    "Enter a valid email address or leave this blank.",
  );
  await expect(numberOfSpeakers).toHaveAccessibleDescription(
    "Enter a whole number from 4 to 10.",
  );
  expect(submitted).toBeUndefined();
  await contactEmail.clear();

  for (const [name, value] of Object.entries({
    founderName: "Example Founder",
    companyName: "Example Project",
    xHandle: " @ Personal_Founder ",
    projectXHandle: " @ Official_Project ",
    website: "Example.com",
    country: "  united   KINGDOM  ",
    description: "A product",
    ecosystem: " SOLANA , Base, solana ",
  })) {
    await page.locator(`.public-form [name="${name}"]`).fill(value);
  }
  const logo = page.getByLabel("Company logo (optional)", { exact: true });
  await logo.setInputFiles({
    name: "fake.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(
    page.getByText("Choose a JPG, PNG or WebP image under 8 MB."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove logo" }).click();
  await expect(logo).toHaveValue("");
  await logo.setInputFiles({
    name: "company.png",
    mimeType: "image/png",
    buffer: Buffer.from(projectLogoPng, "base64"),
  });
  await expect(
    page.getByRole("img", { name: "Company logo preview" }),
  ).toBeVisible();
  await page.locator('select[name="teamSize"]').selectOption("2–5");
  await speakers.selectOption("1");
  await page.locator('select[name="hiring"]').selectOption("no");
  await page.locator('select[name="sector"]').selectOption("Payments");
  await page
    .getByLabel("I agree to the privacy notice and programme terms.")
    .check();
  for (const [field, question] of Object.entries(discoveryQuestions))
    await page
      .getByLabel(question)
      .fill(businessDiscovery[field as keyof typeof discoveryQuestions]);
  for (const area of businessDiscovery.areas)
    await page.getByLabel(area, { exact: true }).check();
  await submit.click();
  await expect(
    page.getByLabel(researchAcknowledgements.researchConsent),
  ).toBeFocused();
  expect(submitted).toBeUndefined();
  for (const label of Object.values(researchAcknowledgements))
    await page.getByLabel(label).check();
  await submit.click();
  await expect(page).toHaveURL(/\/confirmation#token=/);
  const contact = page.getByRole("region", {
    name: "Let’s connect before your Space",
  });
  await expect(contact).toBeVisible();
  for (const name of ["X DM", "Telegram"]) {
    const link = contact.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  }
  await expect(
    contact.getByRole("link", { name: "X DM", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://x.com/messages/compose?recipient_id=1506909333740826628",
  );
  await expect(
    contact.getByRole("link", { name: "Telegram", exact: true }),
  ).toHaveAttribute("href", "https://t.me/ola_crrypt");
  expect(submitted?.contact).toBe("");
  expect(submitted?.projectLogo).toMatch(/^data:image\/png;base64,/);
  expect(submitted?.discovery).toEqual(businessDiscovery);
  expect(submitted?.focus).toBe("");
  expect(submitted?.comments).toBe("");
  expect(submitted?.sessionId).toBe("test-sunday");
  expect(submitted?.promotionalConsent).toBe(false);
  expect(submitted?.xHandle).toBe("personal_founder");
  expect(submitted?.projectXHandle).toBe("official_project");
  expect(submitted?.country).toBe("United Kingdom");
  expect(submitted?.website).toBe("https://Example.com");
  expect(submitted?.stage).toBe("Live");
  expect(submitted?.teamCountries).toEqual([]);
  expect(submitted?.seeking).toBe("");
  expect(submitted?.ecosystem).toBe("solana, base");
});
