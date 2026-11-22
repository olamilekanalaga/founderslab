import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTICIPATION_TERMS,
  RETIRED_AWARD_COMMANDS,
} from "@/lib/programme-policy";
import { defaultSettings } from "@/lib/catalog";
import { readFileSync } from "node:fs";

test("current public policy requires approval and makes no founder reward promise", () => {
  assert.equal(defaultSettings.terms, PARTICIPATION_TERMS);
  assert.match(PARTICIPATION_TERMS, /review and approval/);
  assert.match(PARTICIPATION_TERMS, /does not reserve a seat/);
  assert.match(PARTICIPATION_TERMS, /does not guarantee investment/);
  assert.doesNotMatch(
    PARTICIPATION_TERMS,
    /1\s*SOL|award|prize|commission|reward/i,
  );
  assert.deepEqual(
    [...RETIRED_AWARD_COMMANDS],
    ["campaign.save", "campaign.assess", "award.save"],
  );
});
test("both review branches disable automatic deployment", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  for (const branch of [
    "refactor/feature-architecture",
    "feature/v4-public-homepage",
  ])
    assert.equal(config.git.deploymentEnabled[branch], false);
});
