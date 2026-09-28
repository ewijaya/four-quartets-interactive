import { test as base, expect, type Page } from "@playwright/test";

/** Every test fails if the page logs a console error or throws. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await use(errors);
    expect(errors, "console errors").toEqual([]);
  },
});
export { expect };

export async function setPrefs(page: Page, prefs: Record<string, unknown>) {
  // Apply once per tab so that reloads observe what the app itself persisted.
  await page.addInitScript((p) => {
    if (sessionStorage.getItem("sp:test-prefs")) return;
    localStorage.setItem("sp:prefs:v1", JSON.stringify(p));
    sessionStorage.setItem("sp:test-prefs", "1");
  }, prefs);
}
