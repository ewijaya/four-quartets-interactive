/**
 * One place's sketch as its own SVG file. The Atlas shows one card at a time, so it
 * fetches the sketch when a card opens and inlines it (so the page's theme colours
 * apply), rather than carrying every drawing in the page.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { PLACES } from "../../../data/places";
import { SKETCH_VIEWBOX, sketchPaths } from "../../../lib/viz/sketch";

export const getStaticPaths: GetStaticPaths = () => [...new Set(PLACES.map((p) => p.sketch))].map((key) => ({ params: { key } }));

export const GET: APIRoute = ({ params }) => {
  const paths = sketchPaths(params.key!)
    .map((p) => `<path d="${p.d}" class="sk-s-${p.stroke} sk-f-${p.fill}" stroke-width="${p.width.toFixed(2)}"/>`)
    .join("");
  return new Response(`<svg xmlns="http://www.w3.org/2000/svg" class="sketch" viewBox="${SKETCH_VIEWBOX}" aria-hidden="true">${paths}</svg>`, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
  });
};
