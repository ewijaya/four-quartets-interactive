/**
 * Frame time and allocation checks for the live scenes (desktop project only).
 * p95 frame interval must stay near 60 fps; the JS heap must not grow while a
 * scene animates (no allocations in the loop). A 4× CPU-throttled run reports
 * numbers as a rough stand-in for a mid-range phone (the GPU is not emulated).
 */
import { test, expect, setPrefs } from "./fixtures";

const SCENES = ["/", "/burnt-norton/1", "/east-coker/1", "/the-dry-salvages/1", "/little-gidding/1"];

async function sampleFrames(page: import("@playwright/test").Page, ms: number) {
  return page.evaluate(
    (dur) =>
      new Promise<number[]>((resolve) => {
        const out: number[] = [];
        let last = performance.now();
        const t0 = last;
        const step = (now: number) => {
          out.push(now - last);
          last = now;
          if (now - t0 < dur) requestAnimationFrame(step);
          else resolve(out.slice(3));
        };
        requestAnimationFrame(step);
      }),
    ms,
  );
}
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;

for (const path of SCENES) {
  test(`frames and heap: ${path}`, async ({ page, errors }, info) => {
    test.skip(info.project.name !== "desktop", "desktop GPU measurement");
    test.setTimeout(60_000);
    await setPrefs(page, { theme: "night", scenes: true });
    await page.goto(path);
    await page.mouse.move(40, 300); // engage: live scenes load on first interaction
    await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(2000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.collectGarbage");
    const before = (await cdp.send("Runtime.getHeapUsage")).usedSize;
    const frames = await sampleFrames(page, 4000);
    await cdp.send("HeapProfiler.collectGarbage");
    const after = (await cdp.send("Runtime.getHeapUsage")).usedSize;
    const growthKb = (after - before) / 1024;
    const p = p95(frames);
    console.log(`${path}: p95 frame ${p.toFixed(1)} ms over ${frames.length} frames; heap Δ ${growthKb.toFixed(0)} KB`);
    expect(p, "p95 frame interval (ms)").toBeLessThan(20);
    expect(growthKb, "retained heap growth while animating (KB)").toBeLessThan(512);

    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.waitForTimeout(1000);
    const slow = await sampleFrames(page, 3000);
    console.log(`${path}: with 4× CPU throttle p95 ${p95(slow).toFixed(1)} ms`);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    void errors;
  });
}
