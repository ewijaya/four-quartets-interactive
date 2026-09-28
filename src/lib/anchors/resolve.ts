/**
 * Lemma → text resolution, shared by the Astro build and scripts/resolve-anchors.ts.
 *
 * Matching is case-, punctuation-, quote-, dash- and whitespace-insensitive, respects
 * word boundaries, and may span line breaks within a movement.
 */
import type { Anchor, Line, MovementN, QuartetText, ResolvedAnchor } from "../model";

// ---------------------------------------------------------------------------
// Normalisation with an offset map back to the original characters.

const FOLD: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "′": "'",
  "“": '"',
  "”": '"',
  "æ": "ae",
  "œ": "oe",
};

/** Normalise a phrase for comparison: lower case, letters/digits only, single spaces. */
export function normalise(s: string): string {
  return foldString(s).text;
}

function foldString(s: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let lastSpace = true;
  const decomposed = [...s];
  let orig = 0;
  for (const ch of decomposed) {
    const len = ch.length;
    let c = FOLD[ch] ?? ch;
    c = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const cc of c) {
      if (/[\p{L}\p{N}]/u.test(cc)) {
        out.push(cc);
        map.push(orig);
        lastSpace = false;
      } else if (cc === "'") {
        // Drop apostrophes entirely: "Adam's" ≈ "adams".
      } else if (!lastSpace) {
        out.push(" ");
        map.push(orig);
        lastSpace = true;
      }
    }
    orig += len;
  }
  while (out.length && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }
  return { text: out.join(""), map };
}

// ---------------------------------------------------------------------------
// Movement streams

interface Stream {
  text: string;
  /** For each stream char: [line index, char offset in original line text]. */
  lineOf: Int32Array;
  charOf: Int32Array;
  lines: Line[];
}

const streamCache = new WeakMap<object, Stream>();

function movementLines(q: QuartetText, m: MovementN): Line[] {
  const mv = q.movements.find((x) => x.n === m);
  return mv ? mv.stanzas.flatMap((s) => s.lines) : [];
}

function streamFor(q: QuartetText, m: MovementN): Stream {
  const mv = q.movements.find((x) => x.n === m);
  const key = mv ?? q;
  const hit = streamCache.get(key);
  if (hit) return hit;
  const lines = movementLines(q, m);
  let text = "";
  const lineOf: number[] = [];
  const charOf: number[] = [];
  lines.forEach((l, li) => {
    const f = foldString(l.text);
    if (!f.text) return;
    if (text) {
      text += " ";
      lineOf.push(li);
      charOf.push(-1);
    }
    text += f.text;
    for (const c of f.map) {
      lineOf.push(li);
      charOf.push(c);
    }
  });
  const s: Stream = { text, lineOf: Int32Array.from(lineOf), charOf: Int32Array.from(charOf), lines };
  streamCache.set(key, s);
  return s;
}

/** All word-bounded matches of a normalised needle in a stream, as [start, end). */
function findAll(hay: string, needle: string): Array<[number, number]> {
  const res: Array<[number, number]> = [];
  if (!needle) return res;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const before = i === 0 || hay[i - 1] === " ";
    const after = i + needle.length === hay.length || hay[i + needle.length] === " ";
    if (before && after) res.push([i, i + needle.length]);
    i = hay.indexOf(needle, i + 1);
  }
  return res;
}

function spansFor(s: Stream, start: number, end: number): ResolvedAnchor["spans"] {
  const byLine = new Map<number, { start: number; end: number }>();
  for (let k = start; k < end; k++) {
    const li = s.lineOf[k]!;
    const c = s.charOf[k]!;
    if (c < 0) continue;
    const cur = byLine.get(li);
    // The char offset is the start of the (possibly multi-unit) original character.
    const ch = s.lines[li]!.text.codePointAt(c)!;
    const w = ch > 0xffff ? 2 : 1;
    if (!cur) byLine.set(li, { start: c, end: c + w });
    else {
      cur.start = Math.min(cur.start, c);
      cur.end = Math.max(cur.end, c + w);
    }
  }
  return [...byLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([li, r]) => ({ line: s.lines[li]!.id, start: r.start, end: r.end }));
}

// ---------------------------------------------------------------------------

export interface Resolution {
  resolved: ResolvedAnchor;
  /** Exact lemma matches found (0 = unresolved). */
  matches: number;
  problem?: string;
  /** Set when the lemma matched only approximately (edit distance), e.g. an edition's variant spelling. */
  fuzzy?: { distance: number; window: string };
}

export interface LemmaTarget {
  movement: MovementN;
  lemma: string;
  occurrence?: number;
  hint?: number;
  lineStart?: number;
  lineEnd?: number;
}

/** Resolve a lemma within a movement. Falls back to the hint line when unmatched. */
export function resolveLemma(q: QuartetText, t: LemmaTarget): Resolution {
  const s = streamFor(q, t.movement);
  const needle = normalise(t.lemma);
  let all = findAll(s.text, needle);
  // Constrain to an explicit range when given (with a little slack).
  if (t.lineStart) {
    const lo = t.lineStart - 3;
    const hi = (t.lineEnd ?? t.lineStart) + 3;
    all = all.filter(([a]) => {
      const n = s.lines[s.lineOf[a]!]!.n;
      return n >= lo && n <= hi;
    });
  }
  let pick: [number, number] | undefined;
  let problem: string | undefined;
  if (all.length) {
    if (t.occurrence) {
      pick = all[t.occurrence - 1];
      if (!pick) problem = `occurrence ${t.occurrence} requested but only ${all.length} match(es)`;
    } else if (t.hint && all.length > 1) {
      pick = [...all].sort(
        (a, b) => Math.abs(s.lines[s.lineOf[a[0]]!]!.n - t.hint!) - Math.abs(s.lines[s.lineOf[b[0]]!]!.n - t.hint!),
      )[0];
    } else {
      pick = all[0];
    }
  }
  if (pick) {
    const spans = spansFor(s, pick[0], pick[1]);
    return { resolved: { kind: "lemma", lines: spans.map((x) => x.line), spans, approximate: false }, matches: all.length };
  }
  // Editions differ in small ways (a hyphen, a plural, a misprint): accept a close match.
  if (!problem) {
    const fz = fuzzyWindow(s, needle, t.hint);
    if (fz) {
      const spans = spansFor(s, fz.start, fz.end);
      return {
        resolved: { kind: "lemma", lines: spans.map((x) => x.line), spans, approximate: false },
        matches: 1,
        fuzzy: { distance: fz.distance, window: s.text.slice(fz.start, fz.end) },
      };
    }
  }
  return { resolved: fallback(q, t.movement, t.hint ?? t.lineStart), matches: 0, problem: problem ?? "lemma not found" };
}

/** Best same-length word window within a small edit distance of the lemma (≥ 3 words only). */
function fuzzyWindow(s: Stream, needle: string, hint?: number): { start: number; end: number; distance: number } | null {
  const k = needle.split(" ").length;
  if (k < 3) return null;
  const limit = Math.min(2, Math.max(1, Math.floor(needle.length / 12)));
  const words: Array<{ at: number; end: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.text))) words.push({ at: m.index, end: m.index + m[0].length });
  let best: { start: number; end: number; distance: number } | null = null;
  for (let i = 0; i + k <= words.length; i++) {
    const start = words[i]!.at;
    const end = words[i + k - 1]!.end;
    const d = levenshtein(needle, s.text.slice(start, end));
    if (d > limit) continue;
    const near = (x: { start: number }) => (hint ? Math.abs(s.lines[s.lineOf[x.start]!]!.n - hint) : 0);
    if (!best || d < best.distance || (d === best.distance && near({ start }) < near(best))) best = { start, end, distance: d };
  }
  return best;
}

function fallback(q: QuartetText, m: MovementN, hint?: number): ResolvedAnchor {
  const lines = movementLines(q, m);
  if (!lines.length) return { kind: "movement", lines: [], spans: [], approximate: true };
  const n = Math.min(Math.max(1, hint ?? 1), lines.length);
  const line = lines[n - 1]!;
  return {
    kind: "hint",
    lines: [line.id],
    spans: [{ line: line.id, start: 0, end: line.text.length }],
    approximate: true,
  };
}

/** Resolve any annotation anchor. */
export function resolveAnchor(q: QuartetText, a: Anchor): Resolution {
  if (a.movement === 0) return { resolved: { kind: "quartet", lines: [], spans: [], approximate: false }, matches: 1 };
  const m = a.movement;
  if (a.lemma) {
    const t: LemmaTarget = { movement: m, lemma: a.lemma };
    if (a.occurrence !== undefined) t.occurrence = a.occurrence;
    if (a.hint !== undefined) t.hint = a.hint;
    if (a.lineStart !== undefined) t.lineStart = a.lineStart;
    if (a.lineEnd !== undefined) t.lineEnd = a.lineEnd;
    return resolveLemma(q, t);
  }
  const lines = movementLines(q, m);
  if (a.lineStart) {
    const end = a.lineEnd ?? a.lineStart;
    if (a.lineStart > lines.length) {
      return { resolved: fallback(q, m, lines.length), matches: 0, problem: `line ${a.lineStart} beyond movement length ${lines.length}` };
    }
    const ids = lines.slice(a.lineStart - 1, Math.min(end, lines.length)).map((l) => l.id);
    return { resolved: { kind: "range", lines: ids, spans: [], approximate: false }, matches: 1 };
  }
  return { resolved: { kind: "movement", lines: [], spans: [], approximate: false }, matches: 1 };
}

// ---------------------------------------------------------------------------
// Suggestions for unresolved lemmas (used only by the CLI report).

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n]!;
}

export interface Suggestion {
  line: string;
  window: string;
  distance: number;
}

/** Nearest word windows (≤ 6 words) to an unmatched lemma. */
export function suggest(q: QuartetText, m: MovementN, lemma: string, limit = 3): Suggestion[] {
  const s = streamFor(q, m);
  const needle = normalise(lemma);
  const k = Math.min(6, Math.max(1, needle.split(" ").length));
  const words: Array<{ w: string; at: number }> = [];
  const re = /\S+/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(s.text))) words.push({ w: mm[0], at: mm.index });
  const out: Suggestion[] = [];
  for (const size of new Set([k, Math.max(1, k - 1), Math.min(6, k + 1)])) {
    for (let i = 0; i + size <= words.length; i++) {
      const win = words
        .slice(i, i + size)
        .map((x) => x.w)
        .join(" ");
      const d = levenshtein(needle, win);
      if (d <= Math.max(3, Math.ceil(needle.length * 0.35))) {
        out.push({ line: s.lines[s.lineOf[words[i]!.at]!]!.id, window: win, distance: d });
      }
    }
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.distance - b.distance)
    .filter((x) => (seen.has(x.window) ? false : (seen.add(x.window), true)))
    .slice(0, limit);
}

export const wordCount = (s: string) => normalise(s).split(" ").filter(Boolean).length;
