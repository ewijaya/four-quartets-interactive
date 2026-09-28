/**
 * The whole sequence laid out on one axis (build time): every line gets a global
 * index, movements know their spans, and notes and motif occurrences are placed.
 * Feeds the Movement Map, the Time Spiral and the Motif Tracer. Contains no text.
 */
import { loadText } from "./text/load";
import { resolveLemma, type LemmaTarget } from "./anchors/resolve";
import { getNotes } from "./reader-model";
import { MOTIFS } from "../data/motifs";
import { QUARTETS, QUARTET_BY_CODE, ROMAN } from "../data/quartets";
import type { MotifId, MovementN, QuartetCode } from "./model";

export interface SeqMovement {
  quartet: QuartetCode;
  qid: string;
  n: MovementN;
  roman: string;
  /** Global index of the movement's first line (0-based). */
  start: number;
  count: number;
  stanzas: number[];
  notes: number;
  scholarNotes: number;
  motifs: MotifId[];
}

export interface SeqPoint {
  /** Global line index (0-based). */
  g: number;
  line: string;
  quartet: QuartetCode;
  movement: MovementN;
  n: number;
}

export interface SeqNote extends SeqPoint {
  id: string;
  title: string;
  type: string;
  level: "reader" | "scholar";
}

export interface SeqMotif extends SeqPoint {
  motif: MotifId;
  lemma: string;
  note?: string;
  approximate: boolean;
}

export interface Sequence {
  source: "sample" | "private";
  total: number;
  quartets: Array<{ code: QuartetCode; id: string; title: string; element: string; year: number; start: number; count: number }>;
  movements: SeqMovement[];
  notes: SeqNote[];
  motifs: SeqMotif[];
}

let cached: Sequence | null = null;

export async function getSequence(): Promise<Sequence> {
  if (cached) return cached;
  const bundle = loadText();
  const movements: SeqMovement[] = [];
  const quartets: Sequence["quartets"] = [];
  const lineIndex = new Map<string, number>();
  let g = 0;
  for (const q of bundle.quartets) {
    const info = QUARTET_BY_CODE[q.code];
    const qStart = g;
    for (const m of q.movements) {
      const start = g;
      for (const s of m.stanzas) for (const l of s.lines) lineIndex.set(l.id, g++);
      movements.push({
        quartet: q.code,
        qid: info.id,
        n: m.n,
        roman: ROMAN[m.n]!,
        start,
        count: m.lineCount,
        stanzas: m.stanzas.map((s) => s.lines.length),
        notes: 0,
        scholarNotes: 0,
        motifs: [],
      });
    }
    quartets.push({ code: q.code, id: info.id, title: info.title, element: info.element, year: info.year, start: qStart, count: g - qStart });
  }
  const point = (lineId: string): SeqPoint | null => {
    const gi = lineIndex.get(lineId);
    if (gi === undefined) return null;
    const [q, m, n] = lineId.split(".");
    return { g: gi, line: lineId, quartet: q as QuartetCode, movement: Number(m) as MovementN, n: Number(n) };
  };
  const mv = (q: QuartetCode, m: number) => movements.find((x) => x.quartet === q && x.n === m);

  const notes: SeqNote[] = [];
  for (const n of await getNotes()) {
    const a = n.meta.anchor;
    const target = mv(a.quartet, a.movement);
    if (target) {
      if (n.meta.level === "scholar") target.scholarNotes++;
      else target.notes++;
      for (const m of n.meta.motifs) if (!target.motifs.includes(m)) target.motifs.push(m);
    }
    const first = n.resolved.lines[0];
    const p = first ? point(first) : null;
    if (!p) continue;
    notes.push({ ...p, id: n.meta.id, title: n.meta.title, type: n.meta.type, level: n.meta.level });
  }

  const motifs: SeqMotif[] = [];
  for (const motif of MOTIFS) {
    for (const occ of motif.occurrences) {
      const q = bundle.quartets.find((x) => x.code === occ.quartet);
      if (!q) continue;
      const t: LemmaTarget = { movement: occ.movement, lemma: occ.lemma };
      if (occ.hint !== undefined) t.hint = occ.hint;
      if (occ.occurrence !== undefined) t.occurrence = occ.occurrence;
      const r = resolveLemma(q, t);
      const first = r.resolved.lines[0];
      const p = first ? point(first) : null;
      if (!p) continue;
      const entry: SeqMotif = { ...p, motif: motif.id, lemma: occ.lemma, approximate: r.resolved.approximate };
      if (occ.note) entry.note = occ.note;
      motifs.push(entry);
      const target = mv(occ.quartet, occ.movement);
      if (target && !target.motifs.includes(motif.id)) target.motifs.push(motif.id);
    }
  }
  motifs.sort((a, b) => a.g - b.g);

  cached = { source: bundle.source, total: g, quartets, movements, notes, motifs };
  return cached;
}

export const QUARTET_ORDER = QUARTETS.map((q) => q.code);
