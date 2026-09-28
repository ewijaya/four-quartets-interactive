import { chromium } from "@playwright/test";
const origin = process.argv[2] ?? "http://localhost:4399";
const paths = (process.argv[3] ?? "/burnt-norton/1").split(",");
const out = process.argv[4] ?? "/tmp";
const theme = process.argv[5] ?? "vellum";
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme === "night" ? "dark" : "light" });
  await ctx.addInitScript((t) => localStorage.setItem("sp:prefs:v1", JSON.stringify({ theme: t })), theme);
  for (const p of paths) {
    const page = await ctx.newPage();
    const logs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
    page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
    await page.goto(origin + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);
    const info = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(".stage canvas");
      const gl = c?.getContext("webgl2");
      const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
      return { canvas: !!c, live: c?.classList.contains("is-live"), w: c?.width, h: c?.height, renderer: dbg && gl ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, hasScene: document.body.classList.contains("has-scene") };
    });
    const name = p.replace(/\W+/g, "_") || "home";
    await page.screenshot({ path: `${out}/${name}-${theme}.png` });
    console.log(p, JSON.stringify(info), logs.length ? "\n  " + logs.join("\n  ") : "");
    await page.close();
  }
  await browser.close();
})();
