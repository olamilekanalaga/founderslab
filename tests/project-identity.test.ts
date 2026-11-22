import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationSchema,
  publicApplicationSchema,
} from "@/lib/validation/application";
import { applyCommand } from "@/lib/domain";
import { makeSeed } from "@/server/db/seed-data";
import {
  createLocalApplication,
  demoViewer,
} from "@/tests/fixtures/application-state";

const application = {
  founderName: "Identity Test Founder",
  companyName: "Identity Test Project",
  xHandle: "@Personal_Founder",
  projectXHandle: "@Official_Project",
  contact: "private@example.invalid",
  website: "example.com",
  country: "United Kingdom",
  description: "A test product",
  speakers: 1,
  teamSize: "2–5",
  stage: "MVP",
  sector: "Payments",
  focus: "A customer problem",
  privacyConsent: true,
};
function approved(input: unknown) {
  const state = createLocalApplication(makeSeed(), input);
  return applyCommand(
    state,
    {
      type: "application.review",
      payload: { id: state.applications.at(-1)!.id, status: "Approved" },
    },
    demoViewer(),
  );
}
test("personal and official project usernames are normalized and owned independently on approval", () => {
  const parsed = applicationSchema.parse(application);
  assert.equal(parsed.xHandle, "personal_founder");
  assert.equal(parsed.projectXHandle, "official_project");
  let state = approved(application);
  const a = state.applications.at(-1)!;
  const founder = state.founders.find((f) => f.id === a.founderId)!;
  const company = state.companies.find((c) => c.id === a.companyId)!;
  assert.equal(founder.xHandle, "personal_founder");
  assert.equal(founder.contact, "private@example.invalid");
  assert.equal(company.xHandle, "official_project");
  state = applyCommand(
    state,
    {
      type: "company.save",
      payload: {
        ...company,
        xHandle: "@Corrected_Project",
        founderIds: [founder.id],
        labelIds: [],
      },
    },
    demoViewer(),
  );
  assert.equal(
    state.companies.find((c) => c.id === company.id)!.xHandle,
    "corrected_project",
  );
  assert.equal(
    state.founders.find((f) => f.id === founder.id)!.xHandle,
    "personal_founder",
  );
  const { xHandle: ignored, ...legacyPayload } = state.companies.find(
    (c) => c.id === company.id,
  )!;
  void ignored;
  state = applyCommand(
    state,
    {
      type: "company.save",
      payload: { ...legacyPayload, founderIds: [founder.id], labelIds: [] },
    },
    demoViewer(),
  );
  assert.equal(
    state.companies.find((c) => c.id === company.id)!.xHandle,
    "corrected_project",
  );
  state = applyCommand(
    state,
    {
      type: "founder.save",
      payload: {
        ...founder,
        xHandle: "@Corrected_Personal",
        companyIds: [company.id],
      },
    },
    demoViewer(),
  );
  assert.equal(
    state.founders.find((f) => f.id === founder.id)!.xHandle,
    "corrected_personal",
  );
  assert.equal(
    state.companies.find((c) => c.id === company.id)!.xHandle,
    "corrected_project",
  );
  state = applyCommand(
    state,
    { type: "application.review", payload: { id: a.id, status: "Approved" } },
    demoViewer(),
  );
  assert.equal(
    state.founders.find((f) => f.id === founder.id)!.xHandle,
    "corrected_personal",
  );
  assert.equal(
    state.companies.find((c) => c.id === company.id)!.xHandle,
    "corrected_project",
  );
});
test("legacy applications and projects without an official X account remain valid", () => {
  for (const projectXHandle of [undefined, null, "", "   "]) {
    const state = approved({ ...application, projectXHandle });
    assert.equal(state.applications.at(-1)!.projectXHandle, null);
    assert.equal(state.companies.at(-1)!.xHandle, null);
  }
  assert.equal(
    applicationSchema.safeParse({
      ...application,
      projectXHandle: "https://x.com/project",
    }).success,
    false,
  );
  assert.equal(
    applicationSchema.safeParse({ ...application, xHandle: "" }).success,
    false,
  );
});

test("optional contact and normalized typing do not block valid founder applications", () => {
  const parsed = applicationSchema.parse({
    ...application,
    contact: "",
    xHandle: " @ Personal_Founder ",
    projectXHandle: " @ Official_Project ",
    country: "  uNiTeD   kInGdOm  ",
    companyName: "  Mixed CASE Project  ",
  });
  assert.equal(parsed.contact, "");
  assert.equal(parsed.xHandle, "personal_founder");
  assert.equal(parsed.projectXHandle, "official_project");
  assert.equal(parsed.country, "United Kingdom");
  assert.equal(parsed.companyName, "Mixed CASE Project");
  for (const field of [
    "founderName",
    "companyName",
    "xHandle",
    "website",
    "country",
    "stage",
    "sector",
    "teamSize",
    "description",
    "focus",
    "founderRole",
  ]) {
    assert.equal(
      applicationSchema.safeParse({ ...application, [field]: "   " }).success,
      false,
      field,
    );
  }
});

test("new public applications require every programme answer except email while legacy snapshots remain valid", () => {
  const input = {
    ...application,
    contact: "",
    founderRole: "Founder",
    teamCountries: ["United Kingdom"],
    ecosystem: "None",
    hiring: false,
    seeking: "None",
    comments: "None",
  };
  assert.equal(publicApplicationSchema.safeParse(input).success, true);
  assert.equal(
    publicApplicationSchema.safeParse({ ...input, contact: undefined }).success,
    true,
  );
  for (const field of [
    "projectXHandle",
    "founderRole",
    "teamCountries",
    "ecosystem",
    "hiring",
    "seeking",
    "comments",
  ]) {
    assert.equal(
      publicApplicationSchema.safeParse({ ...input, [field]: undefined })
        .success,
      false,
      field,
    );
  }
});
