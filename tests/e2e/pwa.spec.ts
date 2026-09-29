import { test as base } from "@playwright/test";
import { test, expect } from "./fixtures";

// The rest of the suite blocks service workers (they hide requests from page.route()).
test.use({ serviceWorkers: "allow" });
base.use({ serviceWorkers: "allow" });

test.describe("installable app", () => {
  test("the manifest and icons make the edition installable", async ({ page, request, errors }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await request.get(href!);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ short_name: "Four Quartets", display: "standalone", start_url: "/", scope: "/" });
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual(
      expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]),
    );
    for (const i of [...m.icons.map((x: { src: string }) => x.src), await page.locator('link[rel="apple-touch-icon"]').getAttribute("href")]) {
      const r = await request.get(i);
      expect(r.ok(), i).toBe(true);
      expect(r.headers()["content-type"], i).toContain("image/png");
    }
    void errors;
  });
});

// Offline, the browser logs failed requests for things not kept (search, scene stills) as
// console errors; what must not happen is a script exception or a missing page.
base.describe("offline reading", () => {
  base("once installed, all four quartets open offline; other pages show the offline page", async ({ page, context }) => {
    const exceptions: string[] = [];
    page.on("pageerror", (e) => exceptions.push(e.message));
    await page.goto("/burnt-norton/1");
    // What the page does when it runs as an installed app: keep every quartet on the device.
    await page.evaluate(async () => (await navigator.serviceWorker.ready).active!.postMessage("cache-reader"));
    await expect
      .poll(() => page.evaluate(async () => Boolean(await caches.match(new URL("/little-gidding/5/", location.href).href))), {
        timeout: 30_000,
      })
      .toBe(true);

    // Playwright's offline switch does not reliably reach the service worker's own
    // requests, so also refuse every request at the context, which does.
    await context.setOffline(true);
    await context.route("**/*", (r) => r.abort("internetdisconnected"));
    const kept = await page.goto("/little-gidding/2");
    expect(kept?.fromServiceWorker()).toBe(true);
    await expect(page.locator("h1")).toHaveText("Little Gidding");
    await expect(page.locator("#m2 .line").first()).toBeVisible();
    const missing = await page.goto("/about");
    expect(missing?.fromServiceWorker()).toBe(true);
    await expect(page.locator("h1")).toHaveText("Offline");
    await context.unroute("**/*");
    await context.setOffline(false);
    expect(exceptions).toEqual([]);
  });
});
