import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";

const fs = (pkg, file) => `./node_modules/@fontsource/${pkg}/files/${file}`;
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const GREEK = "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF";
const GREEK_EXT = "U+1F00-1FFF";

/** @param {string} pkg @param {string} prefix @param {Array<[number, "normal" | "italic"]>} cuts */
const latinVariants = (pkg, prefix, cuts) =>
  cuts.map(([weight, style]) => ({
    src: [fs(pkg, `${prefix}-latin-${weight}-${style}.woff2`)],
    weight,
    style,
    unicodeRange: /** @type {[string]} */ ([LATIN]),
  }));

// Base path lets the same build run on Vercel ("/") or a GitHub Pages project site ("/repo/").
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://still-point.vercel.app",
  base,
  output: "static",
  trailingSlash: "ignore",
  // v7 defaults to JSX-style whitespace stripping; poetry needs HTML whitespace semantics.
  compressHTML: true,
  build: { format: "directory" },
  integrations: [mdx()],
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  devToolbar: { enabled: false },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "EB Garamond",
      cssVariable: "--font-poem",
      fallbacks: ["Georgia", "serif"],
      options: {
        variants: [
          ...latinVariants("eb-garamond", "eb-garamond", [
            [400, "normal"],
            [400, "italic"],
            [500, "normal"],
            [600, "normal"],
          ]),
          {
            src: [fs("eb-garamond", "eb-garamond-greek-400-normal.woff2")],
            weight: 400,
            style: "normal",
            unicodeRange: [GREEK],
          },
          {
            src: [fs("eb-garamond", "eb-garamond-greek-ext-400-normal.woff2")],
            weight: 400,
            style: "normal",
            unicodeRange: [GREEK_EXT],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Cormorant Garamond",
      cssVariable: "--font-display",
      fallbacks: ["Georgia", "serif"],
      options: {
        variants: latinVariants("cormorant-garamond", "cormorant-garamond", [
          [300, "normal"],
          [400, "normal"],
          [500, "normal"],
          [400, "italic"],
        ]),
      },
    },
    {
      provider: fontProviders.local(),
      name: "Alegreya Sans",
      cssVariable: "--font-ui",
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        variants: latinVariants("alegreya-sans", "alegreya-sans", [
          [400, "normal"],
          [400, "italic"],
          [500, "normal"],
          [700, "normal"],
        ]),
      },
    },
  ],
  vite: {
    build: {
      assetsInlineLimit: 0,
      rolldownOptions: {
        // Astro's MDX output carries a harmless module-level directive that Rolldown warns about.
        onLog(level, log, handler) {
          if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
          handler(level, log);
        },
      },
    },
  },
});
