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
    await page.locator('.atlas__list [data-place="little-gidding"]').click();
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
    await page.locator('.atlas__list [data-place="little-gidding"]').click();
    await expect.poll(zoom).toBeGreaterThan(3);
    // Kurukshetra is joined to Cape Ann, half a world away: the whole globe again.
    await page.locator('.atlas__list [data-place="kurukshetra"]').click();
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

  test("atlas: a line lists the notes behind it, and the places in the notes are on the map", async ({ page, errors }) => {
    await page.goto("/atlas#place-florence");
    const globe = page.locator("[data-globe]");
    await expect(globe).toHaveAttribute("data-zoom", /\d/);
    // Lines are weighted by the notes behind them: Dante's line to Little Gidding outweighs Vienna's to Burnt Norton.
    const w = (style: string | null) => parseFloat((style ?? "").replace(/^[^\d]*/, ""));
    const heavy = w(await page.locator('.globe__arcs path[data-link="link-florence--little-gidding"]').getAttribute("style"));
    const light = w(await page.locator('.globe__arcs path[data-link="link-vienna--burnt-norton"]').getAttribute("style"));
    expect(heavy).toBeGreaterThan(light * 2);
    const card = page.locator('[data-card="florence"]');
    await expect(card).toBeVisible();
    await card.locator('[data-place="link-florence--little-gidding"]').click();
    const line = page.locator('[data-card="link-florence--little-gidding"]');
    await expect(line).toBeVisible();
    expect(await line.locator(".place-card__notes li").count()).toBeGreaterThan(5);
    await expect(line.locator('a[href$="/notes/lg-compound-ghost"]')).toBeVisible();
    await expect(page).toHaveURL(/#place-link-florence--little-gidding$/);
    // A place in the notes: its card opens and its mark is drawn on the globe.
    await page.locator('.atlas__list [data-place="note-ds-lady-shrine"]').click();
    const note = page.locator('[data-card="note-ds-lady-shrine"]');
    await expect(note).toBeVisible();
    await expect(note.locator('a[href$="/notes/ds-lady-shrine"]')).toBeVisible();
    await expect(page.locator(".globe__place--note.is-selected").first()).toBeAttached();
    // Turning the layer off hides the other notes' marks but keeps the chosen one.
    await page.locator('[data-layer="notes"]').uncheck();
    await expect(page.locator(".globe__place--note:not(.is-selected)")).toHaveCount(0);
    void errors;
  });

  test("sources: a source followed from a note leads back to the note in the poem", async ({ page, errors }) => {
    // Every source link in a note says where it was followed from.
    await page.goto("/burnt-norton/2");
    const cite = page.locator('#n-bn-still-point .citations a[href*="#dante"]');
    await expect(cite).toHaveAttribute("href", /\/sources\?from=%2Fburnt-norton%2F2%23n-bn-still-point#dante$/);
    await page.goto((await cite.getAttribute("href"))!);
    const back = page.locator("[data-return-link]");
    await expect(back).toBeVisible();
    await expect(back).toHaveText(/Back to Burnt Norton II · The still point/);
    await expect(page.locator('#dante .source__uses a[data-note="bn-still-point"]')).toHaveAttribute("aria-current", "true");
    // "Cited in" goes to the passage, not only to the note's own page.
    await expect(page.locator('#dante a[data-note="lg-compound-ghost"]')).toHaveAttribute("href", /\/little-gidding\/2#n-lg-compound-ghost$/);
    await back.click();
    await expect(page).toHaveURL(/\/burnt-norton\/2\/?#n-bn-still-point$/);
    // Only this site's pages are offered as a way back.
    await page.goto("/sources?from=%2F%2Fexample.com%2F#dante");
    await expect(page.locator("[data-return]")).toBeHidden();
    await page.goto("/sources#dante");
    await expect(page.locator("[data-return]")).toBeHidden();
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
