import { test, expect, setPrefs } from "./fixtures";

test.describe("search, notes, atlas, sound, print", () => {
  test("search finds lines and notes and navigates to a line", async ({ page, errors }) => {
    await page.goto("/burnt-norton");
    await page.keyboard.press("/");
    const input = page.locator(".search input");
    await expect(input).toBeFocused();
    await input.fill("still point");
    await expect(page.locator(".search__hit").first()).toBeVisible();
    await page.locator('.search [data-filter="Note"]').click();
    await expect(page.locator(".search__kind").first()).toHaveText("Note");
    await input.fill("BN.2 line 16");
    await page.locator('.search [data-filter="Poem"]').click();
    await page.locator(".search__hit").first().click();
    await expect(page).toHaveURL(/\/burnt-norton\/2\/?#\d+/);
    void errors;
  });

  test("bookmark and note a line, then find them on the notes page", async ({ page, errors }) => {
    await page.goto("/burnt-norton/1");
    const line = page.locator('[data-line="BN.1.10"]');
    await line.locator(".ln").click({ force: true });
    await page.locator('.line-pop [data-act="bookmark"]').click();
    await expect(line).toHaveClass(/is-bookmarked/);
    await line.locator(".ln").click({ force: true });
    await page.locator('.line-pop [data-act="note"]').click();
    await page.locator(".line-pop textarea").fill("Return to this after East Coker.");
    await page.locator('.line-pop [data-act="save"]').click();
    await expect(page.locator(".my-note__text")).toHaveText("Return to this after East Coker.");
    await page.reload();
    await expect(page.locator(".my-note__text")).toHaveText("Return to this after East Coker.");
    await page.goto("/my-notes");
    await expect(page.locator(".my-notes__item")).toHaveCount(2);
    const download = page.waitForEvent("download");
    await page.locator("[data-export]").click();
    expect((await download).suggestedFilename()).toMatch(/still-point-notes-.*\.json/);
    await page.locator(".my-notes__del").first().click();
    await expect(page.locator(".my-notes__item")).toHaveCount(1);
    void errors;
  });

  test("atlas: choosing a place shows its card and sketch", async ({ page, errors }) => {
    await page.goto("/atlas");
    await expect(page.locator(".globe")).toBeVisible();
    await page.locator('[data-place="little-gidding"]').click();
    const card = page.locator('[data-card="little-gidding"]');
    await expect(card).toBeVisible();
    await expect(card.locator("svg.sketch path").first()).toBeAttached();
    await expect(page.locator('[data-card="burnt-norton"]')).toBeHidden();
    await expect(page).toHaveURL(/#place-little-gidding$/);
    void errors;
  });

  test("soundscape toggles on and off without errors", async ({ page, errors }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 520, "the header button is desktop-only; the menu has one");
    await setPrefs(page, { scenes: false });
    await page.goto("/the-dry-salvages/1");
    const btn = page.locator(".site-header__tools [data-sound-toggle]");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1200);
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    void errors;
  });

  test("print view shows notes as endnotes and hides chrome", async ({ page, errors }) => {
    await page.goto("/burnt-norton/2");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.locator("#n-bn-still-point .note__content")).toBeVisible();
    void errors;
  });
});
