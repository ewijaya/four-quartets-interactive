/**
 * Social share cards (Open Graph / X): 1200×630, in the night palette with the
 * site's own type. One for the site and one per quartet, bearing its element sign.
 * No poem text appears on a card.
 *
 *   npm run og        # writes public/og/*.jpg (CHROMIUM_PATH picks a browser binary)
 */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { QUARTETS } from "../src/data/quartets";
import type { Element } from "../src/lib/model";

const OUT = "public/og";
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString("base64")}`;
const FONTS = `
@font-face { font-family: "Cormorant"; font-weight: 400; src: url(${font("cormorant-garamond", "cormorant-garamond-latin-400-normal.woff2")}); }
@font-face { font-family: "Cormorant"; font-weight: 400; font-style: italic; src: url(${font("cormorant-garamond", "cormorant-garamond-latin-400-italic.woff2")}); }
@font-face { font-family: "Alegreya Sans"; font-weight: 400; src: url(${font("alegreya-sans", "alegreya-sans-latin-400-normal.woff2")}); }
@font-face { font-family: "Alegreya Sans"; font-weight: 500; src: url(${font("alegreya-sans", "alegreya-sans-latin-500-normal.woff2")}); }`;

const INK = { air: "#a9cde4", earth: "#e0b57e", water: "#8fd3cd", fire: "#f4a676", still: "#dcb870" } as const;
const GLOW = { air: "#9cc3dc", earth: "#d6a468", water: "#7cc7c1", fire: "#f0995a", still: "#c9a24f" } as const;

/** The site's emblem (src/components/chrome/Emblem.astro) as markup. */
function emblem(el: Element | "still", color: string): string {
  const inner =
    el === "still"
      ? `<circle cx="24" cy="24" r="12" fill="none" stroke="${color}" stroke-width="1" opacity="0.85"/><circle cx="24" cy="24" r="3.2" fill="${color}"/>`
      : (() => {
          const up = el === "air" || el === "fire";
          const bar = el === "air" || el === "earth";
          const tri = up ? "24,9.5 37,32.5 11,32.5" : "24,38.5 37,15.5 11,15.5";
          const y = up ? 24.5 : 23.5;
          return `<polygon points="${tri}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"/>${
            bar ? `<line x1="15" x2="33" y1="${y}" y2="${y}" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>` : ""
          }`;
        })();
  return `<svg viewBox="0 0 48 48" width="300" height="300"><circle cx="24" cy="24" r="21.5" fill="none" stroke="${color}" stroke-width="0.9" opacity="0.6"/>${inner}</svg>`;
}

/** A fixed scatter of faint stars, as behind the reader. */
function stars(seed: number): string {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 90 }, () => {
    const r = rnd() * 1.3 + 0.4;
    return `<circle cx="${(rnd() * 1200).toFixed(1)}" cy="${(rnd() * 630).toFixed(1)}" r="${r.toFixed(2)}" fill="#ebe4d3" opacity="${(rnd() * 0.35 + 0.08).toFixed(2)}"/>`;
  }).join("");
}

interface Card {
  file: string;
  el: Element | "still";
  kicker: string;
  title: string;
  sub: string;
}

function html(c: Card): string {
  const ink = INK[c.el];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0b0d15; color: #ebe4d3; position: relative; }
  .bg { position: absolute; inset: 0; background:
      radial-gradient(ellipse 620px 520px at 300px 315px, ${GLOW[c.el]}26, transparent 70%),
      radial-gradient(ellipse 900px 500px at 900px 700px, #1a1f30, transparent 70%); }
  svg.stars { position: absolute; inset: 0; }
  .emblem { position: absolute; left: 110px; top: 165px; }
  .text { position: absolute; left: 490px; right: 64px; top: 0; bottom: 70px; display: flex; flex-direction: column; justify-content: center; }
  .kicker { font: 500 22px/1 "Alegreya Sans"; letter-spacing: 0.32em; text-transform: uppercase; color: ${ink}; }
  h1 { font: 400 96px/1 "Cormorant"; margin: 22px 0 0; white-space: nowrap; }
  .rule { width: 88px; height: 2px; background: ${ink}; opacity: 0.7; margin: 30px 0 28px; }
  .sub { font: 400 29px/1.35 "Alegreya Sans"; color: #c3baa8; max-width: 620px; }
  .site { position: absolute; left: 490px; bottom: 56px; font: 400 21px/1 "Alegreya Sans"; letter-spacing: 0.08em; color: #9d9483; }
  </style></head><body><div class="bg"></div><svg class="stars" viewBox="0 0 1200 630" width="1200" height="630">${stars(
    c.file.length * 7919,
  )}</svg><div class="emblem">${emblem(c.el, ink)}</div>
  <div class="text"><div class="kicker">${c.kicker}</div><h1>${c.title}</h1><div class="rule"></div><div class="sub">${c.sub}</div></div>
  <div class="site">four-quartets-interactive.pages.dev</div></body></html>`;
}

const CARDS: Card[] = [
  {
    file: "four-quartets",
    el: "still",
    kicker: "T. S. Eliot",
    title: "Four Quartets",
    sub: "An interactive, annotated reading, with notes, glosses and a running commentary.",
  },
  ...QUARTETS.map((q) => ({
    file: q.id,
    el: q.element,
    kicker: `Four Quartets · ${q.ordinal}`,
    title: q.title,
    sub: `${q.year} · ${q.place}`,
  })),
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const c of CARDS) {
  await page.setContent(html(c));
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  // JPEG keeps each card small (WhatsApp is picky about size) at full quality for text.
  await sharp(png).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(`${OUT}/${c.file}.jpg`);
  console.log(`${OUT}/${c.file}.jpg`);
}
await browser.close();
