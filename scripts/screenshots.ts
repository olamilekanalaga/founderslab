import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const origin = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
try {
  for (const [label, width, height] of [
    ["desktop", 1536, 1024],
    ["mobile", 393, 852],
  ] as const) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    for (const [name, path] of [
      ["v4-homepage", "/"],
      ["application", "/apply"],
      ["booking", "/book"],
      ["signin", "/signin"],
      ["manager-signin", "/manager/spaces"],
    ]) {
      await page.goto(origin + path);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `artifacts/${name}-${label}.png`,
        fullPage: true,
      });
    }
    await context.close();
  }
  console.log("Captured backend-backed public and sign-in screens.");
} finally {
  await browser.close();
}
