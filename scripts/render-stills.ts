/**
 * Render the static illustrated stills used for prefers-reduced-motion, for
 * browsers without WebGL2, and as posters while the live scene loads. Each still
 * is a deterministic frame of the real scene (fixed time, movement, progress and
 * cues), captured in headless Chromium and encoded as WebP.
 *
 *   npm run stills            # builds with the sample text, renders, updates src/data/stills.json
 *   npm run stills -- --no-build --only air
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { withPreview } from "./shoot";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : (process.argv[i + 1] ?? "true");
};
const only = arg("only");
const PORT = 4399;
const OUT = "public/stills";

interface Still {
  scene: string;
  path: string;
  movement: number;
  progress: number;
  time: number;
  cues?: string[];
}

const Q: Array<{ scene: string; id: string; plan: Array<Omit<Still, "scene" | "path">> }> = [
  {
    scene: "air",
    id: "burnt-norton",
    plan: [
      { movement: 0, progress: 0, time: 14 },
      { movement: 1, progress: 0.8, time: 22, cues: ["pool"] },
      { movement: 2, progress: 0.4, time: 30 },
      { movement: 3, progress: 0.4, time: 40 },
      { movement: 4, progress: 0.8, time: 18, cues: ["kingfisher"] },
      { movement: 5, progress: 0.85, time: 26, cues: ["shaft"] },
    ],
  },
  {
    scene: "earth",
    id: "east-coker",
    plan: [
      { movement: 0, progress: 0, time: 40 },
      { movement: 1, progress: 0.6, time: 55, cues: ["dance"] },
      { movement: 2, progress: 0.2, time: 70, cues: ["wind"] },
      { movement: 3, progress: 0.2, time: 80, cues: ["dark"] },
      { movement: 4, progress: 0.5, time: 90 },
      { movement: 5, progress: 0.9, time: 100, cues: ["sea"] },
    ],
  },
  {
    scene: "water",
    id: "the-dry-salvages",
    plan: [
      { movement: 0, progress: 0, time: 12 },
      { movement: 1, progress: 0.08, time: 20 },
      { movement: 2, progress: 0.5, time: 28, cues: ["sea"] },
      { movement: 3, progress: 0.5, time: 36, cues: ["sea", "fog"] },
      { movement: 4, progress: 0.5, time: 44, cues: ["sea", "shrine"] },
      { movement: 5, progress: 0.6, time: 52, cues: ["sea"] },
    ],
  },
  {
    scene: "fire",
    id: "little-gidding",
    plan: [
      { movement: 0, progress: 0, time: 20 },
      { movement: 1, progress: 0.3, time: 24, cues: ["midwinter"] },
      { movement: 2, progress: 0.5, time: 32, cues: ["darkdove"] },
      { movement: 3, progress: 0.5, time: 40 },
      { movement: 4, progress: 0.5, time: 48, cues: ["dove"] },
      { movement: 5, progress: 0.95, time: 56, cues: ["rose"] },
    ],
  },
];

const ALL: Still[] = [
  { scene: "home", path: "/", movement: 0, progress: 0, time: 30 },
  ...Q.flatMap((q) => q.plan.map((p) => ({ ...p, scene: q.scene, path: p.movement ? `/${q.id}/${p.movement}` : `/${q.id}` }))),
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, string> = {};
  const list = ALL.filter((s) => !only || s.scene === only);
  await withPreview(async () => {
    const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
    for (const theme of ["vellum", "night"] as const) {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: theme === "night" ? "dark" : "light" });
      await ctx.addInitScript((t) => localStorage.setItem("sp:prefs:v1", JSON.stringify({ theme: t, scenes: true })), theme);
      for (const s of list) {
        const page = await ctx.newPage();
        const q = new URLSearchParams({ still: String(s.movement), t: String(s.time), p: String(s.progress) });
        if (s.cues?.length) q.set("cues", s.cues.join(","));
        await page.goto(`http://localhost:${PORT}${s.path}?${q}`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => (window as unknown as { __stillReady?: boolean }).__stillReady === true, null, { timeout: 30000 });
        // Let cue easing settle (the still clock is frozen, but eased values are not).
        await page.waitForTimeout(4200);
        const png = await page.screenshot({ type: "png" });
        const key = `${s.scene}-${s.movement}-${theme}`;
        await sharp(png).resize(1440, 900).webp({ quality: 58, effort: 6 }).toFile(join(OUT, `${key}.webp`));
        manifest[key] = `/stills/${key}.webp`;
        console.log(`  ✓ ${key}`);
        await page.close();
      }
      await ctx.close();
    }
    await browser.close();
  }, arg("no-build") !== "true");

  // Merge with any stills rendered earlier (e.g. with --only).
  let existing: Record<string, string> = {};
  try {
    existing = (await import("../src/data/stills.json", { with: { type: "json" } })).default as Record<string, string>;
  } catch {
    /* none yet */
  }
  const merged = Object.fromEntries(Object.entries({ ...existing, ...manifest }).sort());
  writeFileSync("src/data/stills.json", JSON.stringify(merged, null, 2) + "\n");
  console.log(`stills: ${Object.keys(manifest).length} rendered → ${OUT}; manifest has ${Object.keys(merged).length}`);
}

void main();
