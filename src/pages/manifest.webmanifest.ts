/**
 * Web app manifest: what makes the edition installable ("Install app" in Chrome,
 * "Add to Home Screen" on iPhone) and how it opens once installed. Built as an
 * endpoint so every path respects the configured base.
 */
import type { APIRoute } from "astro";
import { QUARTETS } from "../data/quartets";
import { movementUrl, url } from "../lib/url";

export const GET: APIRoute = () => {
  const manifest = {
    id: url("/"),
    name: "Four Quartets — The Still Point",
    short_name: "Four Quartets",
    description: "An interactive, annotated reading of T. S. Eliot's Four Quartets, with notes, glosses and a running commentary.",
    lang: "en",
    dir: "ltr",
    start_url: url("/"),
    scope: url("/"),
    display: "standalone",
    background_color: "#0b0d15",
    theme_color: "#0b0d15",
    categories: ["books", "education"],
    icons: [
      { src: url("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: url("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: url("/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon to open a quartet directly.
    shortcuts: QUARTETS.map((q) => ({ name: q.title, url: movementUrl(q.id, 1) })),
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
};
