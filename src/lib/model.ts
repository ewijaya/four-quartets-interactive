/**
 * Shared data model for still-point. Imported by Astro pages, client modules and
 * the Node scripts in /scripts, so it must stay free of runtime dependencies.
 */

export const QUARTET_IDS = ["burnt-norton", "east-coker", "the-dry-salvages", "little-gidding"] as const;
export type QuartetId = (typeof QUARTET_IDS)[number];

export const QUARTET_CODES = ["BN", "EC", "DS", "LG"] as const;
export type QuartetCode = (typeof QUARTET_CODES)[number];

export const MOVEMENTS = [1, 2, 3, 4, 5] as const;
export type MovementN = (typeof MOVEMENTS)[number];

export type Element = "air" | "earth" | "water" | "fire";

/** One printed verse line. `id` is "BN.1.12" (quartet code, movement, line number). */
export interface Line {
  id: string;
  quartet: QuartetCode;
  movement: MovementN;
  stanza: number;
  n: number;
  text: string;
  /** Leading-space count in the source file (tabs expanded to 4). Rendered in em. */
  indent: number;
  /** A dropped ("stepped") line that begins where the previous line ended. */
  step?: boolean;
}

export interface Stanza {
  n: number;
  lines: Line[];
}

export interface Movement {
  n: MovementN;
  stanzas: Stanza[];
  lineCount: number;
}

/** Text that precedes movement I: epigraphs, headnotes. Never line-numbered. */
export interface FrontMatterLine {
  text: string;
  lang: string;
  indent: number;
  /** Paragraph index; blank lines in the source start a new paragraph. */
  para: number;
}

export interface QuartetText {
  id: QuartetId;
  code: QuartetCode;
  title: string;
  frontMatter: FrontMatterLine[];
  movements: Movement[];
  lineCount: number;
}

export type TextSource = "private" | "sample";

export interface TextBundle {
  source: TextSource;
  generatedAt: string;
  edition?: string;
  quartets: QuartetText[];
}

// ---------------------------------------------------------------------------
// Annotations

export const ANNOTATION_TYPES = [
  "allusion",
  "source",
  "place",
  "biography",
  "history",
  "prosody",
  "theme",
  "crossref",
  "textual",
] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export type Confidence = "established" | "interpretive";
export type Density = "clean" | "reader" | "scholar";
export type NoteLevel = "reader" | "scholar";

export interface Anchor {
  quartet: QuartetCode;
  /** 0 = the quartet as a whole (title / front matter). */
  movement: 0 | MovementN;
  /** Short quotation (≤ 6 words) used to locate the note in the text. */
  lemma?: string;
  /** 1-based; which match of the lemma within the movement. */
  occurrence?: number;
  lineStart?: number;
  lineEnd?: number;
  /** Approximate line: used for sample-mode placement and to break ties. */
  hint?: number;
}

export interface Citation {
  /** An id from src/data/sources.ts or src/data/bibliography.ts. */
  ref: string;
  locator?: string;
  note?: string;
  status: "verified" | "to-verify";
}

export const MOTIF_IDS = [
  "rose",
  "garden",
  "fire",
  "water",
  "dance",
  "still-point",
  "time",
  "word-silence",
  "light-dark",
  "dove",
  "bell",
  "yew",
  "sea",
  "ascent-descent",
] as const;
export type MotifId = (typeof MOTIF_IDS)[number];

export interface AnnotationMeta {
  id: string;
  anchor: Anchor;
  type: AnnotationType;
  title: string;
  sources: Citation[];
  related: string[];
  motifs: MotifId[];
  confidence: Confidence;
  level: NoteLevel;
  reviewed: boolean;
}

/** Where an anchor landed in the text. Character offsets are into `Line.text`. */
export interface ResolvedAnchor {
  kind: "lemma" | "range" | "movement" | "quartet" | "hint";
  /** Line ids covered, in order. */
  lines: string[];
  /** For lemma anchors: [lineId, start, end) character spans. */
  spans: Array<{ line: string; start: number; end: number }>;
  /** True when the anchor could not be matched exactly (placed by hint or fallback). */
  approximate: boolean;
}

export interface MotifOccurrence {
  quartet: QuartetCode;
  movement: MovementN;
  lemma: string;
  hint?: number;
  occurrence?: number;
  /** Optional annotation id that discusses this occurrence. */
  note?: string;
}

export interface Motif {
  id: MotifId;
  name: string;
  gloss: string;
  color: string;
  occurrences: MotifOccurrence[];
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  quartet?: QuartetCode;
  kind: "quartet" | "source" | "life";
  blurb: string;
  illustrationPrompt: string;
  precision: "exact" | "approximate" | "uncertain";
}

/** A literary or musical intertext (not scholarship: see BibEntry). */
export interface Source {
  id: string;
  author: string;
  work: string;
  date: string;
  note: string;
  placeId?: string;
}

export interface BibEntry {
  id: string;
  author: string;
  year: string;
  title: string;
  publisher?: string;
  note?: string;
}

/** Scene events anchored in the text, resolved like annotations. */
export interface Cue {
  id: string;
  quartet: QuartetCode;
  movement: MovementN;
  lemma: string;
  hint?: number;
  occurrence?: number;
  /** Scene-specific event name. */
  event: string;
  /** Optional: where the effect ends (another lemma in the same movement). */
  until?: { lemma: string; hint?: number; occurrence?: number };
}

export const lineId = (q: QuartetCode, m: MovementN, n: number) => `${q}.${m}.${n}`;

export function parseLineId(id: string): { quartet: QuartetCode; movement: MovementN; n: number } | null {
  const m = /^(BN|EC|DS|LG)\.([1-5])\.(\d+)$/.exec(id);
  if (!m) return null;
  return { quartet: m[1] as QuartetCode, movement: Number(m[2]) as MovementN, n: Number(m[3]) };
}
