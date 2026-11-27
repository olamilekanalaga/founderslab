import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationSchema,
  publicApplicationSchema,
} from "@/lib/validation/application";
import { applyCommand } from "@/lib/domain";
import { makeSeed } from "@/server/db/seed-data";
import { reportData, blankFilters } from "@/features/reports/lib/selectors";
import { reportRows } from "@/features/reports/lib/export";
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

test("simplified public intake omits retired questions, retaining required chain and optional email", () => {
  const input = {
    ...application,
    contact: "",
    founderRole: "Founder",
    stage: undefined,
    ecosystem: " SOLANA , Base, solana ",
    hiring: false,
  };
  assert.equal(publicApplicationSchema.safeParse(input).success, true);
  const parsed = publicApplicationSchema.parse(input);
  assert.equal(parsed.stage, "Live");
  assert.deepEqual(parsed.teamCountries, []);
  assert.equal(parsed.seeking, "");
  const simplified = publicApplicationSchema.parse({
    ...input,
    focus: undefined,
    comments: undefined,
  });
  assert.equal(simplified.focus, "");
  assert.equal(simplified.comments, "");
  assert.equal(
    publicApplicationSchema.safeParse({
      ...input,
      projectLogo: "data:image/png;base64,PHN2Zy8+",
    }).success,
    false,
  );
  assert.equal(parsed.ecosystem, "solana, base");
  let state = approved(parsed);
  const company = state.companies.at(-1)!;
  assert.equal(company.stage, "Live");
  assert.deepEqual(company.chains, ["solana", "base"]);
  // Live remains editable under the existing active-taxonomy checks.
  state = applyCommand(
    state,
    {
      type: "company.save",
      payload: {
        ...company,
        founderIds: [state.founders.at(-1)!.id],
        labelIds: [],
      },
    },
    demoViewer(),
  );
  assert.equal(state.companies.at(-1)!.stage, "Live");
  assert.equal(
    publicApplicationSchema.safeParse({ ...input, contact: undefined }).success,
    true,
  );
  for (const field of [
    "projectXHandle",
    "founderRole",
    "ecosystem",
    "hiring",
  ]) {
    assert.equal(
      publicApplicationSchema.safeParse({ ...input, [field]: undefined })
        .success,
      false,
      field,
    );
  }
  assert.equal(
    publicApplicationSchema.safeParse({ ...input, ecosystem: " , " }).success,
    false,
  );
});

test("chain reports and exports count each company once per chain across casing and duplicate memberships", () => {
  const state = makeSeed();
  // Historical chain arrays stay intact; reporting normalizes them without writes.
  for (const company of state.companies) company.chains = [];
  state.companies[0].chains = [" Solana ", "SOLANA", "Base"];
  state.companies[1].chains = ["solana"];
  state.memberships.push({ ...state.memberships[0] });
  const before = structuredClone(state.companies);
  const report = reportData(state, blankFilters);
  assert.deepEqual(report.chains, [
    { name: "solana", value: 2 },
    { name: "base", value: 1 },
  ]);
  assert.ok(
    reportRows(state, blankFilters, true).some(
      (row) => row.join("|") === "Chain|solana|2",
    ),
  );
  assert.deepEqual(state.companies, before);
});
