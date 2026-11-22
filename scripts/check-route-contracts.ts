/** Compare local route contracts with the audited pre-refactor application. No login or writes. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const baseline = JSON.parse(
  await readFile("docs/saas/route-contracts.json", "utf8"),
) as {
  path: string;
  status: number;
  location: string | null;
  headings: string[];
}[];
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const actual = [];
  for (const previous of baseline) {
    const response = await fetch(new URL(previous.path, origin), {
      redirect: "manual",
    });
    const html = await response.text();
    let headings: string[] = [];
    if (
      response.headers.get("content-type")?.includes("text/html") &&
      !response.headers.get("location")
    ) {
      await page.setContent(html);
      headings = await page.locator("h1").allTextContents();
    }
    const location = response.headers.get("location");
    actual.push({
      path: previous.path,
      status: response.status,
      location: location?.startsWith(origin)
        ? location.slice(origin.length)
        : location,
      headings,
    });
  }
  await writeFile(
    "docs/saas/routes-after.json",
    JSON.stringify(actual, null, 2) + "\n",
  );
  assert.deepEqual(actual, baseline);
  console.log(
    `PASS: ${actual.length} route status, redirect and heading contracts match the reviewed SaaS public upgrade.`,
  );
} finally {
  await browser.close();
}
