/** Dev utility: capture a timed sequence of the tile transition on arrival at a movement URL. */
import { chromium } from "@playwright/test";
const [origin = "http://localhost:4399", path = "/burnt-norton/2", out = "/tmp", theme = "vellum"] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("sp:prefs:v1", JSON.stringify({ theme: t })), theme);
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(origin + path, { waitUntil: "networkidle" });
  // Wait until tiles start (heading gets .is-tiling), then sample the flight.
  await page.waitForSelector(".movement-heading.is-tiling", { timeout: 15000 });
  const t0 = Date.now();
  for (const ms of [300, 1200, 2200, 3000, 4000, 5200]) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
    await page.screenshot({ path: `${out}/tiles-${theme}-${ms}.png`, clip: { x: 220, y: 60, width: 640, height: 420 } });
  }
  const still = await page.evaluate(() => document.querySelector(".movement-heading.is-tiling") !== null);
  console.log("tiling after 5.2s:", still, "errors:", errs);
  await browser.close();
})();
