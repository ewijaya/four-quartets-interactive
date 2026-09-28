/**
 * Lighthouse audit of the production build (sample text), mobile and desktop.
 *   npm run lighthouse [-- --no-build]
 * Writes reports/lighthouse/*.json and reports/lighthouse/summary.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { withPreview } from "./shoot";

const ROUTES = ["/", "/burnt-norton/1", "/east-coker/3", "/little-gidding/5", "/map", "/motifs", "/atlas", "/spiral", "/notes/bn-still-point"];
const ORIGIN = "http://localhost:4399";
const OUT = "reports/lighthouse";

interface Scores {
  performance: number;
  accessibility: number;
  "best-practices": number;
  seo: number;
  lcp: number;
  tbt: number;
  cls: number;
}

function run(url: string, preset: "mobile" | "desktop"): Scores {
  const file = `${OUT}/${preset}${url === "/" ? "-home" : url.replace(/\W+/g, "-")}.json`;
  const args = [
    "lighthouse",
    ORIGIN + url,
    `--chrome-path=${chromium.executablePath()}`,
    "--chrome-flags=--headless=new --no-sandbox",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=${file}`,
    "--quiet",
    ...(preset === "desktop" ? ["--preset=desktop"] : []),
  ];
  execFileSync("npx", args, { stdio: "inherit" });
  const r = JSON.parse(readFileSync(file, "utf8"));
  const c = r.categories;
  const a = r.audits;
  return {
    performance: Math.round(c.performance.score * 100),
    accessibility: Math.round(c.accessibility.score * 100),
    "best-practices": Math.round(c["best-practices"].score * 100),
    seo: Math.round(c.seo.score * 100),
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const rows: string[] = [];
  await withPreview(async () => {
    for (const preset of ["mobile", "desktop"] as const) {
      for (const url of ROUTES) {
        const s = run(url, preset);
        const line = `| ${preset} | \`${url}\` | ${s.performance} | ${s.accessibility} | ${s["best-practices"]} | ${s.seo} | ${(s.lcp / 1000).toFixed(2)} s | ${Math.round(s.tbt)} ms | ${s.cls.toFixed(3)} |`;
        console.log(line);
        rows.push(line);
      }
    }
  }, !process.argv.includes("--no-build"));
  const md = [
    "# Lighthouse",
    "",
    `Production build with the sample text, served locally; Lighthouse ${JSON.parse(readFileSync("node_modules/lighthouse/package.json", "utf8")).version}, ${new Date().toISOString()}.`,
    "Mobile uses Lighthouse's default simulated throttling (Moto G Power, slow 4G).",
    "",
    "| Preset | Route | Perf | A11y | Best practices | SEO | LCP | TBT | CLS |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(`${OUT}/summary.md`, md);
}

void main();
