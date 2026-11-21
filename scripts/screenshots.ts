import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const origin = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
const errors: string[] = [];
try {
  for (const [label, width, height] of [
    ["desktop", 1536, 1024],
    ["mobile", 393, 852],
  ] as const) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [name, path] of [
      ["overview", "/demo"],
      ["founders", "/demo/founders"],
      ["founder", "/demo/founders/f1"],
      ["companies", "/demo/companies"],
      ["campaigns", "/demo/campaigns"],
      ["settings", "/demo/settings"],
      ["spaces", "/demo/spaces"],
      ["reports", "/demo/reports"],
      ["application", "/apply?mode=demo"],
      ["booking", "/book?mode=demo"],
    ] as const) {
      await page.goto(origin + path);
      await page.locator("h1").first().waitFor();
      if (name === "application")
        await page.locator(".public-header[data-ready=true]").waitFor();
      if (name === "overview" || name === "reports")
        await page.locator(".recharts-surface").first().waitFor();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error(`Overflow: ${path} at ${width}`);
      await page.screenshot({
        path: `artifacts/${name}-${label}.png`,
        fullPage: true,
      });
    }
    await context.close();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Captured 20 screenshots at 1536×1024 and 393×852; no runtime errors or horizontal page overflow.",
  );
} finally {
  await browser.close();
}
