/**
 * Plain-text → structured quartet parser.
 *
 * Input conventions (see docs/TEXT-FORMAT.md):
 *  - optional title line (a quartet title, any case, "The" optional)
 *  - lines before movement I are front matter (epigraphs, headnotes)
 *  - a line holding only a Roman numeral I–V starts the next movement
 *  - blank lines separate stanzas
 *  - leading spaces are preserved as indentation (tab = 4 spaces)
 *  - a line indented ≥ STEP_MIN_INDENT directly after a verse line is a stepped line
 *  - lines beginning "%%" are directives: `%% step`, `%% nostep`, `%% edition: …`,
 *    anything else is a comment
 */
import {
  QUARTET_CODES,
  QUARTET_IDS,
  lineId,
  type FrontMatterLine,
  type Line,
  type Movement,
  type MovementN,
  type QuartetCode,
  type QuartetId,
  type QuartetText,
  type Stanza,
} from "../model";

export const STEP_MIN_INDENT = 16;

const TITLES: Record<QuartetId, string> = {
  "burnt-norton": "Burnt Norton",
  "east-coker": "East Coker",
  "the-dry-salvages": "The Dry Salvages",
  "little-gidding": "Little Gidding",
};
const CODE_OF: Record<QuartetId, QuartetCode> = {
  "burnt-norton": "BN",
  "east-coker": "EC",
  "the-dry-salvages": "DS",
  "little-gidding": "LG",
};
const ROMAN = ["I", "II", "III", "IV", "V"] as const;

export interface ParseWarning {
  quartet?: QuartetCode;
  line?: number; // 1-based source line
  message: string;
}

export interface ParseResult {
  quartets: QuartetText[];
  edition?: string;
  warnings: ParseWarning[];
}

/** Normalise line endings, BOM, tabs and exotic spaces without touching typography. */
export function normaliseSource(raw: string): string[] {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => {
      // Expand tabs and turn leading NBSP / thin spaces into plain spaces for indent counting.
      const expanded = l.replace(/\t/g, "    ");
      const lead = /^[\s  -  ]*/.exec(expanded)?.[0] ?? "";
      return " ".repeat(lead.length) + expanded.slice(lead.length).replace(/[\s ]+$/, "");
    });
}

const simplify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/^the/, "");

/** Identify a quartet from a title line or a file name. */
export function identifyQuartet(text: string): QuartetId | null {
  const s = simplify(text);
  if (!s) return null;
  for (const id of QUARTET_IDS) {
    if (simplify(TITLES[id]) === s || simplify(id) === s) return id;
  }
  return null;
}

const isBlank = (l: string) => l.trim() === "";
const isDirective = (l: string) => l.trimStart().startsWith("%%");
const romanIndex = (l: string): number => {
  const m = /^\s*(I|II|III|IV|V)\.?\s*$/.exec(l);
  return m ? ROMAN.indexOf(m[1] as (typeof ROMAN)[number]) : -1;
};
const hasGreek = (s: string) => /[Ͱ-Ͽἀ-῿]/.test(s);

/**
 * Parse a source file. A file may contain one quartet (identified by its title line
 * or, failing that, by `fileHint`) or several quartets each introduced by a title line.
 */
export function parseSource(raw: string, fileHint = ""): ParseResult {
  const lines = normaliseSource(raw);
  const warnings: ParseWarning[] = [];
  let edition: string | undefined;

  // Split into quartet chunks at title lines.
  type Chunk = { id: QuartetId; start: number; lines: string[] };
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;
  const fileQuartet = identifyQuartet(fileHint.replace(/\.[a-z]+$/i, "").replace(/^.*\//, ""));

  lines.forEach((l, i) => {
    if (isDirective(l)) {
      const m = /^\s*%%\s*edition\s*:\s*(.+)$/i.exec(l);
      if (m) edition = m[1]!.trim();
    }
    const titled = !isDirective(l) && !isBlank(l) && romanIndex(l) < 0 ? identifyQuartet(l) : null;
    if (titled) {
      current = { id: titled, start: i + 1, lines: [] };
      chunks.push(current);
      return;
    }
    if (!current) {
      if (isBlank(l) || isDirective(l)) return;
      if (!fileQuartet) {
        warnings.push({ line: i + 1, message: `Text before any quartet title and no quartet in file name "${fileHint}".` });
        return;
      }
      current = { id: fileQuartet, start: i + 1, lines: [] };
      chunks.push(current);
    }
    (current as Chunk).lines.push(l);
  });

  const seen = new Set<QuartetId>();
  const quartets: QuartetText[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.id)) {
      warnings.push({ quartet: CODE_OF[chunk.id], line: chunk.start, message: `Duplicate quartet "${TITLES[chunk.id]}" ignored.` });
      continue;
    }
    seen.add(chunk.id);
    quartets.push(parseQuartet(chunk.id, chunk.lines, chunk.start, warnings));
  }
  return edition === undefined ? { quartets, warnings } : { quartets, edition, warnings };
}

function parseQuartet(id: QuartetId, src: string[], startLine: number, warnings: ParseWarning[]): QuartetText {
  const code = CODE_OF[id];
  const frontMatter: FrontMatterLine[] = [];
  const movements: Movement[] = [];

  let movement: Movement | null = null;
  let stanza: Stanza | null = null;
  let para = 0;
  let prevBlank = true;
  let forceStep: boolean | null = null;

  const closeStanza = () => {
    if (movement && stanza && stanza.lines.length) movement.stanzas.push(stanza);
    stanza = null;
  };

  src.forEach((raw, idx) => {
    const srcLine = startLine + idx + 1;
    if (isDirective(raw)) {
      const d = raw.trim().slice(2).trim().toLowerCase();
      if (d === "step") forceStep = true;
      else if (d === "nostep") forceStep = false;
      return;
    }
    if (isBlank(raw)) {
      if (movement) closeStanza();
      else if (frontMatter.length && !prevBlank) para++;
      prevBlank = true;
      return;
    }

    const r = romanIndex(raw);
    const expected = movements.length + (movement ? 1 : 0);
    if (r >= 0 && r === expected) {
      closeStanza();
      if (movement) movements.push(finishMovement(movement));
      movement = { n: (r + 1) as MovementN, stanzas: [], lineCount: 0 };
      prevBlank = true;
      return;
    }
    if (r >= 0 && r !== expected) {
      warnings.push({ quartet: code, line: srcLine, message: `Unexpected movement numeral "${raw.trim()}" (expected ${ROMAN[expected] ?? "none"}); treated as verse.` });
    }

    const indent = raw.length - raw.trimStart().length;
    const text = raw.trim();

    if (!movement) {
      frontMatter.push({ text, lang: hasGreek(text) ? "grc" : "en", indent, para });
      prevBlank = false;
      return;
    }

    const m: Movement = movement;
    if (!stanza) stanza = { n: m.stanzas.length + 1, lines: [] };
    const s: Stanza = stanza;
    const prev = s.lines[s.lines.length - 1];
    const heuristicStep = !!prev && indent >= STEP_MIN_INDENT && indent > prev.indent;
    const step = forceStep ?? heuristicStep;
    forceStep = null;

    m.lineCount++;
    const line: Line = {
      id: lineId(code, m.n, m.lineCount),
      quartet: code,
      movement: m.n,
      stanza: s.n,
      n: m.lineCount,
      text,
      indent: step ? 0 : indent,
    };
    if (step) line.step = true;
    if (text.length > 96) {
      warnings.push({ quartet: code, line: srcLine, message: `Very long line (${text.length} chars) at ${line.id}; check for merged lines.` });
    }
    s.lines.push(line);
    prevBlank = false;
  });

  closeStanza();
  if (movement) movements.push(finishMovement(movement));

  if (movements.length !== 5) {
    warnings.push({ quartet: code, message: `Found ${movements.length} movements (expected 5).` });
  }
  for (const mv of movements) {
    if (!mv.lineCount) warnings.push({ quartet: code, message: `Movement ${ROMAN[mv.n - 1]} is empty.` });
  }

  return {
    id,
    code,
    title: TITLES[id],
    frontMatter,
    movements,
    lineCount: movements.reduce((a, mv) => a + mv.lineCount, 0),
  };
}

function finishMovement(m: Movement): Movement {
  // Renumber stanzas densely (closeStanza may skip empty ones).
  m.stanzas.forEach((s, i) => {
    s.n = i + 1;
    s.lines.forEach((l) => (l.stanza = i + 1));
  });
  return m;
}

/** Sort quartets into sequence order and report any that are missing. */
export function orderQuartets(qs: QuartetText[]): { quartets: QuartetText[]; missing: QuartetCode[] } {
  const byCode = new Map(qs.map((q) => [q.code, q]));
  const quartets = QUARTET_CODES.map((c) => byCode.get(c)).filter((q): q is QuartetText => !!q);
  const missing = QUARTET_CODES.filter((c) => !byCode.has(c));
  return { quartets, missing };
}

/** A shape summary that is safe to publish (contains no text). */
export function describeShape(q: QuartetText): string {
  return q.movements
    .map((m) => `${ROMAN[m.n - 1]}: ${m.lineCount} lines in ${m.stanzas.length} stanza(s) [${m.stanzas.map((s) => s.lines.length).join(", ")}]`)
    .join("\n");
}
