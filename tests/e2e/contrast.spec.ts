/**
 * Contrast over the live scenes: with the text made transparent, measure the worst
 * luminance of the pixels actually behind the poem column (and the margin notes on
 * wide screens) and check that the faintest text colour still meets WCAG AA 4.5:1.
 */
import sharp from "sharp";
import { test, expect, setPrefs } from "./fixtures";

const PAGES = ["/burnt-norton/1", "/east-coker/1", "/the-dry-salvages/1", "/little-gidding/1", "/little-gidding/5"];

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hexLum = (hex: string) => {
  const h = hex.trim().replace("#", "");
  return lum(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
};

for (const theme of ["vellum", "night"] as const) {
  for (const path of PAGES) {
    test(`contrast over scene: ${path} (${theme})`, async ({ page, errors }) => {
      test.setTimeout(60_000);
      await setPrefs(page, { theme, scenes: true, density: "reader" });
      await page.goto(path);
    await page.mouse.move(40, 300); // engage: live scenes load on first interaction
      await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 30_000 });
      await page.waitForTimeout(2500);
      // Cues can brighten a scene: let the first movement's play out a little further.
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1500);
      await page.addStyleTag({
        content: `.movement__text *, .notes, .notes *, .movement-heading * { color: transparent !important; text-decoration-color: transparent !important; background: none !important; border-color: transparent !important; box-shadow: none !important; }
                  .line--ranged::after, .anchor--approx::after { display: none !important; }
                  .site-header, .movement-pips, .sample-badge { visibility: hidden !important; }`,
      });
      await page.waitForTimeout(300);
      const regions = await page.evaluate(() => {
        const vh = window.innerHeight;
        const clip = (r: DOMRect) => ({ x: Math.max(0, r.left), y: Math.max(64, r.top), w: r.width, h: Math.min(vh, r.bottom) - Math.max(64, r.top) });
        const out = [] as Array<{ x: number; y: number; w: number; h: number }>;
        const m = [...document.querySelectorAll<HTMLElement>(".movement__text")].find((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 120 && r.top < vh - 120;
        });
        if (m) out.push(clip(m.getBoundingClientRect()));
        const notes = m?.closest("section")?.querySelector<HTMLElement>("aside.notes");
        if (notes && window.innerWidth >= 1100) out.push(clip(notes.getBoundingClientRect()));
        return out.filter((r) => r.w > 20 && r.h > 20);
      });
      expect(regions.length).toBeGreaterThan(0);
      const faint = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ink-faint"));
      const textL = hexLum(faint);
      let worst = Infinity;
      for (const r of regions) {
        const png = await page.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        const ls: number[] = [];
        for (let i = 0; i < data.length; i += info.channels) ls.push(lum(data[i]!, data[i + 1]!, data[i + 2]!));
        ls.sort((a, b) => a - b);
        // Ignore the rarest 0.1 % of pixels (sub-pixel sparkles under nothing legible).
        const extreme = theme === "vellum" ? ls[Math.floor(ls.length * 0.001)]! : ls[Math.floor(ls.length * 0.999)]!;
        worst = Math.min(worst, ratio(textL, extreme));
      }
      expect(worst, `worst contrast for --ink-faint over the ${theme} scene`).toBeGreaterThanOrEqual(4.5);
      void errors;
    });
  }
}
