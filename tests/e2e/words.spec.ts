import { test, expect, setPrefs } from "./fixtures";

// Sample text: glosses cannot match placeholder lines, so they appear in each
// movement's glossary only, and the concordance explains that it needs the text.
test.describe("words: glosses and concordance", () => {
  test("a movement's glossary folds behind a button and lists its glosses", async ({ page, errors }) => {
    await page.goto("/burnt-norton/2");
    const glossary = page.locator("#m2 [data-glossary]");
    const toggle = glossary.locator(".glossary__toggle");
    await expect(toggle).toBeVisible();
    await expect(glossary.locator(".glossary__list")).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(glossary.locator("#g-bn-2-erhebung .gloss__text")).toContainText("German");
    void errors;
  });

  test("the line menu lists a line's words and opens one from the keyboard", async ({ page, errors }) => {
    await page.goto("/burnt-norton/2");
    const line = page.locator('[data-line="BN.2.16"]');
    await line.hover();
    await line.locator("a.ln").click();
    await page.locator('.line-pop [data-act="words"]').click();
    const first = page.locator(".word-pop__words button").first();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".word-pop__note")).toContainText("placeholder lines");
    await page.keyboard.press("Escape");
    await expect(page.locator(".word-pop")).toHaveCount(0);
    void errors;
  });

  test("tapping a word in the verse opens the word popover; clean density turns it off", async ({ page, errors }) => {
    await page.goto("/burnt-norton/2");
    // BN.2.4 carries no note in the sample build (hint-placed notes cover whole lines).
    const lt = page.locator('[data-line="BN.2.4"] .lt');
    await lt.click({ position: { x: 20, y: 8 } });
    await expect(page.locator(".word-pop")).toHaveCount(1);
    await expect(page.locator(".word-pop__title")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await setPrefs(page, { density: "clean" });
    await page.reload();
    await page.locator('[data-line="BN.2.4"] .lt').click({ position: { x: 20, y: 8 } });
    await expect(page.locator(".word-pop")).toHaveCount(0);
    await expect(page.locator("#m2 [data-glossary]")).toBeHidden();
    void errors;
  });
});
