/**
 * Build-time view model for the reader: text + annotations + resolved anchors.
 * Runs inside Astro (uses astro:content); scripts use src/lib/annotations/files.ts.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import { loadText } from "./text/load";
import { resolveAnchor, resolveLemma, type LemmaTarget } from "./anchors/resolve";
import { CUES } from "../data/cues";
import { renderSegments, segmentLine, type LineMark } from "./anchors/segment";
import { toMeta } from "./annotations/schema";
import type { AnnotationMeta, Line, MovementN, QuartetCode, QuartetText, ResolvedAnchor, TextSource } from "./model";
import { QUARTET_BY_CODE, ROMAN, type QuartetInfo } from "../data/quartets";

export interface NoteVM {
  meta: AnnotationMeta;
  entry: CollectionEntry<"annotations">;
  resolved: ResolvedAnchor;
  problem?: string;
  /** Sort key within its movement. */
  order: number;
  /** First line number, if the note is attached to lines. */
  firstLine?: number;
  lastLine?: number;
}

export interface LineVM {
  id: string;
  n: number;
  html: string;
  plain: string;
  indent: number;
  step: boolean;
  /** Notes whose anchor begins on this line (lemma/hint/range). */
  startsNotes: string[];
  /** Range notes covering this line. */
  inRanges: string[];
  /** Scene cues that begin / end on this line. */
  cueStart: string[];
  cueEnd: string[];
}

export interface MovementVM {
  n: MovementN;
  roman: string;
  lineCount: number;
  stanzas: Array<{ n: number; lines: LineVM[] }>;
  notes: NoteVM[];
}

export interface QuartetView {
  info: QuartetInfo;
  text: QuartetText;
  source: TextSource;
  edition?: string;
  frontMatter: Array<{ lang: string; lines: Array<{ text: string; indent: number }> }>;
  movements: MovementVM[];
  quartetNotes: NoteVM[];
}

let notesCache: NoteVM[] | null = null;

/** All annotations, resolved against the current text. */
export async function getNotes(): Promise<NoteVM[]> {
  if (notesCache) return notesCache;
  const bundle = loadText();
  const entries = await getCollection("annotations");
  const out: NoteVM[] = [];
  for (const entry of entries) {
    const meta = toMeta(entry.id, entry.data);
    const q = bundle.quartets.find((x) => x.code === meta.anchor.quartet);
    if (!q) continue;
    const r = resolveAnchor(q, meta.anchor);
    const lines = r.resolved.lines.map((id) => Number(id.split(".")[2]));
    const vm: NoteVM = {
      meta,
      entry,
      resolved: r.resolved,
      order: lines.length ? lines[0]! * 1000 + (r.resolved.spans[0]?.start ?? 0) : -1,
    };
    if (r.problem) vm.problem = r.problem;
    if (lines.length) {
      vm.firstLine = Math.min(...lines);
      vm.lastLine = Math.max(...lines);
    }
    out.push(vm);
  }
  notesCache = out.sort((a, b) => a.order - b.order);
  return notesCache;
}

export async function getNote(id: string): Promise<NoteVM | undefined> {
  return (await getNotes()).find((n) => n.meta.id === id);
}

export async function buildQuartetView(code: QuartetCode): Promise<QuartetView> {
  const bundle = loadText();
  const text = bundle.quartets.find((q) => q.code === code);
  if (!text) throw new Error(`No text for ${code}`);
  const notes = (await getNotes()).filter((n) => n.meta.anchor.quartet === code);

  // Marks per line id
  const marks = new Map<string, LineMark[]>();
  const starts = new Map<string, string[]>();
  const ranges = new Map<string, string[]>();
  for (const n of notes) {
    const r = n.resolved;
    if (r.kind === "lemma" || r.kind === "hint") {
      for (const s of r.spans) {
        const arr = marks.get(s.line) ?? [];
        arr.push({ id: n.meta.id, start: s.start, end: s.end, approximate: r.approximate, level: n.meta.level });
        marks.set(s.line, arr);
      }
    }
    if (r.kind === "range") {
      for (const l of r.lines) ranges.set(l, [...(ranges.get(l) ?? []), n.meta.id]);
    }
    const first = r.lines[0];
    if (first) starts.set(first, [...(starts.get(first) ?? []), n.meta.id]);
  }

  // Scene cues → the lines where they begin and end.
  const cueStart = new Map<string, string[]>();
  const cueEnd = new Map<string, string[]>();
  const firstLineOf = (t: LemmaTarget) => resolveLemma(text, t).resolved.lines[0];
  for (const c of CUES.filter((x) => x.quartet === code)) {
    const t: LemmaTarget = { movement: c.movement, lemma: c.lemma };
    if (c.hint !== undefined) t.hint = c.hint;
    if (c.occurrence !== undefined) t.occurrence = c.occurrence;
    const startLine = firstLineOf(t);
    if (!startLine) continue;
    cueStart.set(startLine, [...(cueStart.get(startLine) ?? []), c.event]);
    if (c.until) {
      const u: LemmaTarget = { movement: c.movement, lemma: c.until.lemma };
      if (c.until.hint !== undefined) u.hint = c.until.hint;
      if (c.until.occurrence !== undefined) u.occurrence = c.until.occurrence;
      const endLine = firstLineOf(u);
      if (endLine) cueEnd.set(endLine, [...(cueEnd.get(endLine) ?? []), c.event]);
    }
  }

  const lineVM = (l: Line): LineVM => ({
    id: l.id,
    n: l.n,
    html: renderSegments(segmentLine(l.text, marks.get(l.id) ?? [])),
    plain: l.text,
    indent: l.indent,
    step: !!l.step,
    startsNotes: starts.get(l.id) ?? [],
    inRanges: ranges.get(l.id) ?? [],
    cueStart: cueStart.get(l.id) ?? [],
    cueEnd: cueEnd.get(l.id) ?? [],
  });

  const frontMatter: QuartetView["frontMatter"] = [];
  for (const fm of text.frontMatter) {
    let para = frontMatter[fm.para];
    if (!para) {
      para = { lang: fm.lang, lines: [] };
      frontMatter[fm.para] = para;
    }
    para.lines.push({ text: fm.text, indent: fm.indent });
  }

  const view: QuartetView = {
    info: QUARTET_BY_CODE[code],
    text,
    source: bundle.source,
    frontMatter: frontMatter.filter(Boolean),
    movements: text.movements.map((m) => ({
      n: m.n,
      roman: ROMAN[m.n]!,
      lineCount: m.lineCount,
      stanzas: m.stanzas.map((s) => ({ n: s.n, lines: s.lines.map(lineVM) })),
      notes: notes.filter((x) => x.meta.anchor.movement === m.n),
    })),
    quartetNotes: notes.filter((x) => x.meta.anchor.movement === 0),
  };
  if (bundle.edition) view.edition = bundle.edition;
  return view;
}

export const TYPE_LABEL: Record<AnnotationMeta["type"], string> = {
  allusion: "Allusion",
  source: "Source",
  place: "Place",
  biography: "Life",
  history: "History",
  prosody: "Prosody",
  theme: "Theme",
  crossref: "Echo",
  textual: "Text",
};
