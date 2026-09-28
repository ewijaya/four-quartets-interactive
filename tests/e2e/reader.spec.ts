import { test, expect, setPrefs } from "./fixtures";

test.describe("reader", () => {
  test("renders the poem as text before scripts, with the sample badge", async ({ page, errors }) => {
    await page.route("**/*.js", (r) => r.abort());
    await page.goto("/burnt-norton/1");
    await expect(page.locator("h1")).toHaveText("Burnt Norton");
    await expect(page.locator('[data-line="BN.1.1"] .lt')).toContainText("BN.1 line 1");
    await expect(page.locator("section.movement")).toHaveCount(5);
    expect(errors.filter((e) => !/Failed to load|net::ERR/.test(e))).toEqual([]);
    errors.length = 0;
  });

  test("deep link highlights the line", async ({ page, errors }) => {
    await page.goto("/burnt-norton/2#16");
    const line = page.locator('[data-line="BN.2.16"]');
    await expect(line).toHaveClass(/is-target/);
    await expect(line).toBeInViewport();
    void errors;
  });

  test("line range deep link highlights several lines", async ({ page, errors }) => {
    await page.goto("/east-coker/3#4-7");
    await expect(page.locator(".line.is-target")).toHaveCount(4);
    void errors;
  });

  test("movement URL opens at that movement and scrolling updates the URL", async ({ page, errors }) => {
    await page.goto("/burnt-norton/3");
    await expect(page.locator("#m3-h")).toBeInViewport();
    await page.locator("#m4-h").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 200);
    await expect(page).toHaveURL(/\/burnt-norton\/4$/);
    void errors;
  });

  test("an anchor opens its note with Enter and closes with Escape", async ({ page, errors }) => {
    await page.goto("/burnt-norton/2");
    const anchor = page.locator('.anchor[data-notes~="bn-still-point"]').first();
    await anchor.focus();
    await page.keyboard.press("Enter");
    await expect(anchor).toHaveAttribute("aria-expanded", "true");
    const isWide = (page.viewportSize()?.width ?? 0) >= 1100;
    if (isWide) {
      await expect(page.locator("#n-bn-still-point")).toHaveClass(/is-open/);
      await expect(page.locator("#n-bn-still-point .note__content")).toBeVisible();
    } else {
      await expect(page.locator(".sheet.is-open .note__title")).toContainText("The still point");
    }
    await page.keyboard.press("Escape");
    await expect(anchor).toHaveAttribute("aria-expanded", "false");
    void errors;
  });

  test("clean density removes anchors and notes", async ({ page, errors }) => {
    await setPrefs(page, { density: "clean" });
    await page.goto("/burnt-norton/1");
    await expect(page.locator('.anchor[role="button"]')).toHaveCount(0);
    await expect(page.locator("aside.notes").first()).toBeHidden();
    void errors;
  });

  test("scholar density shows more notes than reader", async ({ page, errors }) => {
    await page.goto("/burnt-norton/1");
    const reader = await page.locator('.anchor[role="button"]').count();
    await page.evaluate(() => {
      const r = document.querySelector<HTMLInputElement>('[data-density-switch] input[value="scholar"]');
      r?.click();
    });
    await expect.poll(async () => page.locator('.anchor[role="button"]').count()).toBeGreaterThan(reader);
    void errors;
  });

  test("theme toggle switches to night and persists", async ({ page, errors }) => {
    await setPrefs(page, { theme: "vellum" });
    await page.goto("/burnt-norton");
    await page.locator("[data-theme-toggle]").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
    void errors;
  });

  test("navigating between quartets keeps working (client router)", async ({ page, errors }) => {
    await page.goto("/burnt-norton");
    await page.locator('.reader-end__next[href$="/east-coker"]').click();
    await expect(page.locator("h1")).toHaveText("East Coker");
    await expect(page.locator("html")).toHaveClass(/js/);
    void errors;
  });

  test("note permalink links back to its line", async ({ page, errors }) => {
    await page.goto("/notes/bn-still-point");
    await expect(page.locator(".note__title")).toContainText("The still point");
    await page.getByRole("link", { name: /Read in context/ }).click();
    await expect(page).toHaveURL(/\/burnt-norton\/2#\d+/);
    await expect(page.locator(".line.is-target").first()).toBeVisible();
    void errors;
  });
});
