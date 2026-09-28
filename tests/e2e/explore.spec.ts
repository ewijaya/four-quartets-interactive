import { test, expect, setPrefs } from "./fixtures";

test.describe("explore", () => {
  test("movement map links every movement and each column to its comparison", async ({ page, errors }) => {
    await page.goto("/map");
    await expect(page.locator("a.mm__cell")).toHaveCount(20);
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      await page.locator('a.mm__colhead[href$="/compare/3"]').click();
    } else {
      await page.locator('.mm__mobile-compare a[href$="/compare/3"]').click();
    }
    await expect(page).toHaveURL(/\/compare\/3$/);
    await expect(page.locator("[data-col]")).toHaveCount(4);
    void errors;
  });

  test("compare columns scroll together on wide screens", async ({ page, errors }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, "desktop layout");
    await page.goto("/compare/2");
    const cols = page.locator(".compare__text");
    await cols.nth(0).evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect.poll(async () => cols.nth(3).evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    void errors;
  });

  test("motif tracer draws arcs and toggles motifs", async ({ page, errors }) => {
    await page.goto("/motifs");
    await expect(page.locator(".tracer__arcs")).toHaveCount(2);
    await page.locator('[data-motif="bell"]').click();
    await expect(page.locator(".tracer__arcs")).toHaveCount(3);
    await expect(page).toHaveURL(/m=rose,fire,bell/);
    // The accessible list is always present.
    await expect(page.locator('[data-list="bell"] li').first()).toBeVisible();
    void errors;
  });

  test("time spiral renders and its movement list is operable", async ({ page, errors }) => {
    await setPrefs(page, { scenes: true });
    await page.goto("/spiral");
    await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 30_000 });
    const btn = page.locator("[data-fly]").first();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    void errors;
  });
});
