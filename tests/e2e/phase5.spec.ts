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

  test("atlas: the globe zooms, and a chosen place is framed with the places joined to it", async ({ page, errors, isMobile }) => {
    await page.goto("/atlas");
    const globe = page.locator("[data-globe]");
    const zoom = async () => Number(await globe.getAttribute("data-zoom"));
    await expect(globe).toHaveAttribute("data-zoom", "1.00");
    await expect(page.locator("[data-scale]")).toBeHidden();
    await page.locator('[data-view="in"]').click();
    await expect.poll(zoom).toBeCloseTo(2, 1);
    await expect(page.locator("[data-scale]")).toBeVisible();
    await page.locator('[data-view="whole"]').click();
    await expect(globe).toHaveAttribute("data-zoom", "1.00");
    // Little Gidding's sources are all in western Europe, so the globe closes in on them.
    await page.locator('[data-place="little-gidding"]').click();
    await expect.poll(zoom).toBeGreaterThan(3);
    // Kurukshetra is joined to Cape Ann, half a world away: the whole globe again.
    await page.locator('[data-place="kurukshetra"]').click();
    await expect(globe).toHaveAttribute("data-zoom", "1.00");
    if (!isMobile) {
      const box = (await globe.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // A plain scroll is left to the page; Ctrl + scroll (or a trackpad pinch) zooms.
      await page.mouse.wheel(0, -100);
      await expect(page.locator("[data-globe-nudge]")).toHaveClass(/is-on/);
      await expect(globe).toHaveAttribute("data-zoom", "1.00");
      const moved = (await globe.boundingBox())!;
      await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -100);
      await page.keyboard.up("Control");
      await expect.poll(zoom).toBeGreaterThan(1.2);
    }
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
