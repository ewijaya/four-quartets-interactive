/**
 * The lines the word popover indexes. Only a build that publishes the poem's text
 * (the hosted edition) carries them; sample builds ship an empty list, so the
 * concordance never becomes a way to reassemble text that is not already on the page.
 */
import type { APIRoute } from "astro";
import { loadText } from "../lib/text/load";

export const GET: APIRoute = () => {
  const bundle = loadText();
  const publish = bundle.source === "private";
  const lines = publish
    ? bundle.quartets.flatMap((q) => q.movements.flatMap((m) => m.stanzas.flatMap((s) => s.lines.map((l) => [l.id, l.text]))))
    : [];
  return new Response(JSON.stringify({ source: bundle.source, lines }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
