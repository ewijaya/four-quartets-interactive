import AxeBuilder from "@axe-core/playwright";
import { test, expect, setPrefs } from "./fixtures";

const ROUTES = ["/", "/burnt-norton", "/burnt-norton/2", "/little-gidding/5", "/notes", "/notes/bn-still-point", "/sources", "/about"];

for (const theme of ["vellum", "night"] as const) {
  for (const route of ROUTES) {
    test(`axe: ${route} (${theme})`, async ({ page, errors }) => {
      await setPrefs(page, { theme, scenes: false });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help} — ${v.nodes[0]?.target.join(" ")}`);
      expect(summary).toEqual([]);
      void errors;
    });
  }
}
