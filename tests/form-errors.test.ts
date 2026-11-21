import test from "node:test";
import assert from "node:assert/strict";
import { applicationSchema } from "../lib/validation";
import { formError } from "../lib/form-errors";
test("validation errors return a readable field message instead of raw issue JSON", () => {
  const result = applicationSchema.safeParse({
    founderName: "Founder",
    companyName: "Company",
    xHandle: "bad handle",
    website: "https://example.invalid",
    country: "Nigeria",
    description: "Pay",
    focus: "AI",
    speakers: 1,
    teamSize: "1",
    stage: "MVP",
    sector: "Payments",
    privacyConsent: true,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const error = formError(result.error, "Unable to submit");
  assert.equal(error.field, "xHandle");
  assert.match(error.message, /X username:/);
  assert.ok(!error.message.includes('"code"'));
  assert.ok(!error.message.includes('"path"'));
});
