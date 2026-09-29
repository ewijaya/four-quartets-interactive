import AxeBuilder from "@axe-core/playwright";
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
    await page.mouse.move(40, 300); // engage: live scenes load on first interaction
    await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 30_000 });
    const btn = page.locator("[data-fly]").first();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    void errors;
  });
});

test.describe("time spiral (no live scene)", () => {
  test("the motif chips open each motif's page and the movement list opens movements", async ({ page, errors }) => {
    await setPrefs(page, { scenes: false });
    await page.goto("/spiral");
    await expect(page.locator("#spiral-motifs-title")).toHaveText("The motifs");
    await expect(page.locator('[data-motif="rose"]')).not.toHaveAttribute("aria-pressed", /.*/);
    await page.locator('[data-motif="rose"]').click();
    await expect(page).toHaveURL(/\/motifs\/rose$/);
    await page.goBack();
    await page.locator("[data-fly]").first().click();
    await expect(page).toHaveURL(/\/burnt-norton\/1$/);
    void errors;
  });
});

test.describe("time spiral (live)", () => {
  /** The running scene, exposed by `?debug` (read-only use: a still camera and a light to point at). */
  type Debug = { __stage: { current: { camera: { position: { x: number } }; controls: { autoRotate: boolean } } } };

  async function openLive(page: import("@playwright/test").Page, query = "") {
    await setPrefs(page, { scenes: true });
    await page.goto(`/spiral?debug${query}`);
    await page.mouse.move(40, 300); // engage: live scenes load on first interaction
    await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 30_000 });
    // A still frame to point at.
    await page.evaluate(() => ((window as unknown as Debug).__stage.current.controls.autoRotate = false));
    await page.waitForTimeout(300);
  }

  /** Screen position of a note light that sits in the open part of the view (clear of the panel and card). */
  async function aNoteLight(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
      const sc = (window as unknown as Debug).__stage.current as unknown as {
        notePos: Float32Array;
        camera: unknown;
        canvas: HTMLCanvasElement;
        tmp: { set(x: number, y: number, z: number): { project(c: unknown): { x: number; y: number; z: number } } };
      };
      const r = sc.canvas.getBoundingClientRect();
      const narrow = r.width < 700;
      let best: { x: number; y: number; z: number } | null = null;
      for (let i = 0; i < sc.notePos.length / 3; i++) {
        const v = sc.tmp.set(sc.notePos[i * 3]!, sc.notePos[i * 3 + 1]!, sc.notePos[i * 3 + 2]!).project(sc.camera);
        const x = ((v.x + 1) / 2) * r.width;
        const y = ((1 - v.y) / 2) * r.height;
        const open = narrow ? x > 30 && x < r.width - 30 && y > 90 && y < r.height * 0.5 : x > 420 && x < r.width - 380 && y > 120 && y < r.height - 120;
        if (open && v.z < 1 && (!best || v.z < best.z)) best = { x, y, z: v.z };
      }
      return best!;
    });
  }

  test("the helix receives the pointer, so it can be dragged and zoomed", async ({ page, errors }) => {
    await openLive(page);
    const size = page.viewportSize()!;
    const x = size.width < 700 ? size.width / 2 : size.width * 0.75;
    const y = size.width < 700 ? 160 : size.height / 2;
    // Nothing (body, poster image) may sit between the pointer and the canvas over open space.
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName, [x, y])).toBe("CANVAS");
    const camX = () => page.evaluate(() => (window as unknown as Debug).__stage.current.camera.position.x);
    const before = await camX();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 180, y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(Math.abs((await camX()) - before)).toBeGreaterThan(3);
    void errors;
  });

  test("hovering a light previews it and choosing it opens its card", async ({ page, errors }, info) => {
    await openLive(page);
    const at = await aNoteLight(page);
    if (info.project.name === "desktop") {
      await page.mouse.move(at.x - 120, at.y - 60);
      await page.mouse.move(at.x + 3, at.y + 2, { steps: 5 });
      await expect(page.locator("[data-spiral-tip]")).toBeVisible();
      await expect(page.locator("[data-spiral-tip]")).not.toBeEmpty();
    }
    await page.mouse.click(at.x + 2, at.y - 1);
    const card = page.locator("[data-spiral-card]");
    await expect(card).toBeVisible();
    await expect(card.locator(".spiral-card__title")).not.toBeEmpty();
    await expect(card.getByRole("link", { name: "Open the note" })).toHaveAttribute("href", /\/notes\//);
    void errors;
  });

  test("the notes can be stepped through with the keyboard", async ({ page, errors }) => {
    await openLive(page);
    await page.locator('[data-cue="browse"]').click();
    const card = page.locator("[data-spiral-card]");
    await expect(card).toBeVisible();
    await expect(card.locator(".spiral-card__pos")).toHaveText(/^Note 1 of \d+$/);
    await expect(card.locator('[data-step="prev"]')).toBeDisabled();
    await expect(card.locator('[data-step="next"]')).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(card.locator(".spiral-card__pos")).toHaveText(/^Note 2 of \d+$/);
    await expect(card.locator('[data-step="next"]')).toBeFocused(); // focus survives the redraw
    await page.keyboard.press("ArrowLeft");
    await expect(card.locator(".spiral-card__pos")).toHaveText(/^Note 1 of \d+$/);
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(page.locator('[data-cue="browse"]')).toBeFocused();
    void errors;
  });

  test("following a motif shows its summary and thread, and can be shared and undone", async ({ page, errors }) => {
    await openLive(page);
    const rose = page.locator('[data-motif="rose"]');
    await expect(rose).toHaveAttribute("aria-pressed", "false");
    await rose.click();
    await expect(rose).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]motif=rose\b/);
    const card = page.locator("[data-spiral-card]");
    await expect(card.locator(".spiral-card__title")).toHaveText("Rose");
    // One count per quartet, as text as well as bars.
    await expect(card.locator(".spiral-card__meters li")).toHaveCount(4);
    // Stepping goes to the motif's first occurrence, then on along the thread.
    await card.locator('[data-step="next"]').click();
    await expect(card.locator(".spiral-card__pos")).toHaveText(/^Rose · 1 of \d+$/);
    await expect(card.locator(".spiral-card__title")).toHaveText(/^‘.+’$/);
    await card.locator('[data-step="prev"]').click();
    await expect(card.locator(".spiral-card__title")).toHaveText("Rose");
    await page.getByRole("button", { name: "Show every motif" }).click();
    await expect(rose).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/motif=/);
    await expect(card).toBeHidden();
    void errors;
  });

  test("a shared link opens with the motif already followed", async ({ page, errors }) => {
    await setPrefs(page, { scenes: true });
    await page.goto("/spiral?motif=fire");
    await expect(page.locator('[data-motif="fire"]')).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(40, 300);
    await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 30_000 });
    await expect(page.locator("[data-spiral-card] .spiral-card__title")).toHaveText("Fire");
    void errors;
  });

  test("a movement's card links to its comparison", async ({ page, errors }) => {
    await openLive(page);
    await page.locator('[data-fly="6"]').click();
    const card = page.locator("[data-spiral-card]");
    await expect(card.locator(".spiral-card__title")).toHaveText("East Coker II");
    await expect(card.getByRole("link", { name: /Compare II across the quartets/ })).toHaveAttribute("href", /\/compare\/2$/);
    await expect(card.locator('[data-step="next"]')).toBeEnabled();
    void errors;
  });

  test("an open card has no accessibility violations", async ({ page, errors }) => {
    await openLive(page);
    await page.locator('[data-motif="rose"]').click();
    await expect(page.locator("[data-spiral-card] .spiral-card__meters")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} — ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    void errors;
  });
});
