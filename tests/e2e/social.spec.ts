import { test, expect } from "./fixtures";

// Link previews on X, WhatsApp, Facebook, LinkedIn and iMessage read these tags.
test.describe("share cards", () => {
  for (const [path, card] of [
    ["/", "four-quartets"],
    ["/east-coker/1", "east-coker"],
    ["/notes/lg-strange-meeting", "little-gidding"],
  ] as const) {
    test(`${path} carries a large share card`, async ({ page, request, errors }) => {
      await page.goto(path);
      const meta = (sel: string) => page.locator(sel).first().getAttribute("content");
      const image = await meta('meta[property="og:image"]');
      expect(image).toMatch(new RegExp(`^https://.+/og/${card}\\.jpg$`));
      expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
      expect(await meta('meta[name="twitter:image"]')).toBe(image);
      expect(await meta('meta[property="og:image:alt"]')).toBeTruthy();
      expect(await meta('meta[property="og:url"]')).toMatch(/^https:\/\//);
      // The absolute URL points at production; fetch the same file from this build.
      const res = await request.get(new URL(image!).pathname);
      expect(res.ok()).toBe(true);
      expect(res.headers()["content-type"]).toContain("image/jpeg");
      expect((await res.body()).length, "small enough for WhatsApp previews").toBeLessThan(300_000);
      void errors;
    });
  }
});

test.describe("touch screens", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile", "phone layout only"));

  test("no page scrolls sideways on a phone", async ({ page, errors }) => {
    for (const path of ["/", "/burnt-norton/1", "/little-gidding/2", "/notes/", "/notes/lg-strange-meeting", "/atlas", "/map", "/spiral", "/motifs", "/compare/1", "/sources", "/about"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    void errors;
  });

  test("motif dots are at least 24px to tap", async ({ page, errors }) => {
    await page.goto("/motifs");
    const hit = page.locator(".tracer__hit").first();
    await expect(hit).toBeAttached();
    const box = await hit.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    void errors;
  });
});
