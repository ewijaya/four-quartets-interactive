/**
 * Split a line's text into non-overlapping segments, each carrying the set of
 * annotation ids whose lemma covers it. Rendering is plain escaped HTML so it is
 * immune to template whitespace handling.
 */

export interface LineMark {
  id: string;
  start: number;
  end: number;
  approximate: boolean;
  level: "reader" | "scholar";
}

export interface Segment {
  text: string;
  ids: string[];
  approximate: boolean;
  /** Lowest density level at which any covering note is visible. */
  level: "reader" | "scholar" | null;
}

export function segmentLine(text: string, marks: LineMark[]): Segment[] {
  if (!marks.length) return [{ text, ids: [], approximate: false, level: null }];
  const cuts = new Set<number>([0, text.length]);
  for (const m of marks) {
    cuts.add(Math.max(0, Math.min(text.length, m.start)));
    cuts.add(Math.max(0, Math.min(text.length, m.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (a === b) continue;
    const covering = marks.filter((m) => m.start <= a && m.end >= b);
    const level = covering.length ? (covering.some((m) => m.level === "reader") ? "reader" : "scholar") : null;
    segs.push({
      text: text.slice(a, b),
      ids: covering.map((m) => m.id),
      approximate: covering.length > 0 && covering.every((m) => m.approximate),
      level,
    });
  }
  // Merge adjacent segments with identical id sets.
  const merged: Segment[] = [];
  for (const s of segs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.ids.join(" ") === s.ids.join(" ")) prev.text += s.text;
    else merged.push({ ...s });
  }
  return merged;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Render segments. Annotated segments become hyperlinks to their notes
 * (<a class="anchor" href="#n-…">), which work without JavaScript by jumping to the
 * endnote; client code turns them into disclosures that open the note in place, and
 * removes the link at densities where the note is hidden.
 */
export function renderSegments(segs: Segment[]): string {
  return segs
    .map((s) => {
      const t = escapeHtml(s.text);
      if (!s.ids.length) return t;
      const cls = `anchor${s.approximate ? " anchor--approx" : ""}`;
      return `<a class="${cls}" href="#n-${s.ids[0]}" data-notes="${s.ids.join(" ")}" data-level="${s.level}">${t}</a>`;
    })
    .join("");
}
