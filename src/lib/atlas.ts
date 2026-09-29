/**
 * The Atlas's lines, drawn from the notes' citations rather than listed by hand: a line
 * joins the place a source came from to each quartet whose notes cite that source, and
 * carries those notes. Kept free of Astro imports so it can be unit-tested.
 */
import type { QuartetCode } from "./model";

export interface CitingNote {
  id: string;
  quartet: QuartetCode;
  /** Citation refs (source or bibliography ids). */
  sources: string[];
}
export interface AtlasLink {
  /** "link-<from>--<to>". */
  id: string;
  from: string;
  to: string;
  /** Ids of the notes that cite a source from `from` in the quartet at `to`, in the order given. */
  notes: string[];
  /** The sources at `from` those notes cite. */
  sources: string[];
}

export function atlasLinks(
  notes: CitingNote[],
  sources: Array<{ id: string; placeId?: string }>,
  quartetPlace: Record<QuartetCode, string>,
): AtlasLink[] {
  const placeOf = new Map(sources.flatMap((s) => (s.placeId ? [[s.id, s.placeId] as const] : [])));
  const links = new Map<string, AtlasLink>();
  for (const n of notes) {
    const to = quartetPlace[n.quartet];
    for (const ref of n.sources) {
      const from = placeOf.get(ref);
      // A source at the quartet's own place (Ferrar's household at Little Gidding) needs no line.
      if (!from || from === to) continue;
      const id = `link-${from}--${to}`;
      const link = links.get(id) ?? { id, from, to, notes: [], sources: [] };
      links.set(id, link);
      if (!link.notes.includes(n.id)) link.notes.push(n.id);
      if (!link.sources.includes(ref)) link.sources.push(ref);
    }
  }
  return [...links.values()].sort((a, b) => b.notes.length - a.notes.length || a.id.localeCompare(b.id));
}
