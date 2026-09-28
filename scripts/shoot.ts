/**
 * Progress screenshots: every shot at 1440×900 and 390×844, in Vellum and Night.
 *
 *   npm run shoot -- --phase 1 [--only reader] [--no-build]
 *
 * Always uses the sample text (screenshots are committed; the poem is not).
 * Fails if any page logs a console error or throws.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
};

const phase = arg("phase", "0")!;
const only = arg("only");
const PORT = Number(arg("port", "4399"));
const ORIGIN = `http://localhost:${PORT}`;
const outDir = join("docs/progress", `phase-${phase}`);

export interface Shot {
  name: string;
  path: string;
  /** Prepare the page after load (click, scroll…). */
  act?: (page: Page, vp: "desktop" | "mobile") => Promise<void>;
  viewports?: Array<"desktop" | "mobile">;
  wait?: number;
}

const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);

export const SHOTS: Shot[] = [
  { name: "home", path: "/", wait: 1500 },
  { name: "bn-title", path: "/burnt-norton", wait: 1500 },
  {
    name: "bn-1",
    path: "/burnt-norton/1",
    wait: 1500,
  },
  {
    name: "bn-2-deeplink",
    path: "/burnt-norton/2#16",
    wait: 1500,
  },
  {
    name: "bn-2-note-open",
    path: "/burnt-norton/2",
    act: async (page) => {
      const a = page.locator('.anchor[href]').first();
      await a.scrollIntoViewIfNeeded();
      await a.click();
      await settle(page, 1200);
    },
  },
  {
    name: "bn-1-scholar",
    path: "/burnt-norton/1",
    act: async (page) => {
      await page.locator('[data-density-switch] input[value="scholar"]').first().evaluate((el) => (el as HTMLInputElement).click());
      await settle(page, 900);
    },
  },
  {
    name: "lg-2",
    path: "/little-gidding/2",
    wait: 1500,
  },
  {
    name: "bn-5-margin",
    path: "/burnt-norton/5",
    act: async (page, vp) => {
      if (vp === "desktop") {
        await page.locator('.anchor[data-notes~="bn-ten-stairs"]').first().hover();
        await settle(page, 900);
      }
    },
  },
  {
    name: "bn-2-tiles",
    path: "/burnt-norton/2",
    viewports: ["desktop"],
    act: async (page) => {
      await page.locator(".movement-heading.is-tiling").waitFor({ timeout: 12000 }).catch(() => {});
      await settle(page, 2100);
    },
  },
  { name: "ec-1-dance", path: "/east-coker/1", act: async (page) => {
      await page.locator('[data-cue-start~="dance"]').first().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 200);
      await settle(page, 3500);
    } },
  { name: "ds-1", path: "/the-dry-salvages/1" },
  { name: "lg-5-rose", path: "/little-gidding/5", act: async (page) => {
      await page.locator('[data-cue-start~="rose"]').first().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 300);
      await settle(page, 4000);
    } },
  { name: "map", path: "/map" },
  { name: "compare-2", path: "/compare/2" },
  { name: "spiral", path: "/spiral", wait: 1500 },
  { name: "motifs", path: "/motifs" },
  { name: "motif-rose", path: "/motifs/rose" },
  { name: "atlas", path: "/atlas" },
  {
    name: "search",
    path: "/burnt-norton/1",
    act: async (page) => {
      await page.keyboard.press("/");
      await page.locator(".search input").fill("still point");
      await settle(page, 1200);
    },
  },
  {
    name: "line-tools",
    path: "/burnt-norton/1",
    act: async (page) => {
      const l = page.locator('[data-line="BN.1.12"]');
      await l.locator(".ln").click({ force: true });
      await page.locator('.line-pop [data-act="bookmark"]').click();
      await page.locator('[data-line="BN.1.14"] .ln').click({ force: true });
      await page.locator('.line-pop [data-act="note"]').click();
      await page.locator(".line-pop textarea").fill("The door we never opened — compare East Coker's ‘way of putting it’.");
      await page.locator('.line-pop [data-act="save"]').click();
      await page.locator('[data-line="BN.1.10"] .ln').click({ force: true });
      await l.scrollIntoViewIfNeeded();
      await settle(page, 600);
    },
  },
  { name: "my-notes", path: "/my-notes" },
  { name: "notes-index", path: "/notes" },
  { name: "note-page", path: "/notes/bn-sunlight-pool" },
  { name: "sources", path: "/sources" },
  { name: "about", path: "/about" },
];

async function waitForServer(url: string, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not start at ${url}`);
}

export async function withPreview<T>(fn: () => Promise<T>, build = true): Promise<T> {
  const env = { ...process.env, STILLPOINT_TEXT: "sample" };
  if (build) execSync("npm run build", { stdio: "inherit", env });
  const server: ChildProcess = spawn("npx", ["astro", "preview", "--port", String(PORT), "--ignore-lock"], {
    env,
    stdio: "ignore",
    detached: true,
  });
  const stop = () => {
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  };
  process.once("exit", stop);
  try {
    await waitForServer(ORIGIN);
    return await fn();
  } finally {
    stop();
  }
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

async function main() {
  const shots = SHOTS.filter((s) => !only || only.split(",").some((o) => s.name.includes(o)));
  // Overwrite only the shots being taken (partial runs keep the rest).
  mkdirSync(outDir, { recursive: true });
  const problems: string[] = [];

  await withPreview(async () => {
    const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
    for (const theme of ["vellum", "night"] as const) {
      for (const vpName of ["desktop", "mobile"] as const) {
        const vp = VIEWPORTS[vpName];
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.deviceScaleFactor,
          isMobile: vp.isMobile,
          hasTouch: vp.hasTouch,
          colorScheme: theme === "night" ? "dark" : "light",
        });
        await ctx.addInitScript((t) => {
          try {
            const k = "sp:prefs:v1";
            // Every shot starts from the same preferences.
            localStorage.setItem(k, JSON.stringify({ theme: t, density: "reader", scenes: true }));
          } catch {}
        }, theme);
        for (const shot of shots) {
          if (shot.viewports && !shot.viewports.includes(vpName)) continue;
          const page = await ctx.newPage();
          page.on("console", (m) => {
            if (m.type() === "error") problems.push(`[${shot.name} ${vpName} ${theme}] console: ${m.text()}`);
          });
          page.on("pageerror", (e) => problems.push(`[${shot.name} ${vpName} ${theme}] pageerror: ${e.message}`));
          await page.goto(ORIGIN + shot.path, { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);
          await page.mouse.move(40, 300); // live scenes load on first interaction
          // Scenes load on engagement and fade in: wait for the live canvas where there is one.
          await page.locator(".stage canvas.is-live").waitFor({ state: "attached", timeout: 9000 }).catch(() => {});
          await settle(page, 1800);
          if (shot.wait) await settle(page, shot.wait);
          if (shot.act) await shot.act(page, vpName);
          await settle(page, 300);
          const file = join(outDir, `${shot.name}-${vpName}-${theme}.png`);
          await page.screenshot({ path: file });
          console.log(`  ✓ ${file}`);
          await page.close();
        }
        await ctx.close();
      }
    }
    await browser.close();
  }, arg("no-build") !== "true");

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error("  ✗ " + p);
    process.exitCode = 1;
  } else {
    console.log("\nNo console errors.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
