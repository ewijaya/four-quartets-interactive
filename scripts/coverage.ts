/**
 * How much of the poem is annotated, and what is still waiting for review.
 *
 *   npm run coverage            # private text if present, else sample (placed by hint)
 *
 * Writes reports/coverage.md, reports/coverage.json and reports/review-queue.md.
 * Structure only: line numbers, counts and ids — never the text.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadText } from "../src/lib/text/load";
import { resolveAnchor, resolveLemma, type LemmaTarget } from "../src/lib/anchors/resolve";
import { readAnnotationFiles } from "../src/lib/annotations/files";
import { loadGlosses } from "../src/lib/annotations/glosses";
import { QUARTET_BY_CODE, ROMAN } from "../src/data/quartets";
import { ANNOTATION_TYPES, QUARTET_CODES, type AnnotationMeta, type Gloss, type MovementN, type QuartetCode } from "../src/lib/model";

const BARE_MIN = 8;
const bundle = loadText();
const sample = bundle.source === "sample";
const files = readAnnotationFiles().filter((f) => f.meta);
const notes = files.map((f) => f.meta!);
const { glosses } = loadGlosses();

interface Cov {
  code: QuartetCode;
  m: MovementN;
  lines: number;
  notes: AnnotationMeta[];
  glosses: Gloss[];
  /** Line numbers touched by a note (not commentary) or a gloss. */
  glossed: Set<number>;
  /** Line numbers inside a commentary passage. */
  commented: Set<number>;
}

const lineNo = (id: string) => Number(id.split(".")[2]);
const cov: Cov[] = [];
for (const q of bundle.quartets) {
  for (const mv of q.movements) {
    const c: Cov = { code: q.code, m: mv.n, lines: mv.lineCount, notes: [], glosses: [], glossed: new Set(), commented: new Set() };
    for (const a of notes.filter((x) => x.anchor.quartet === q.code && x.anchor.movement === mv.n)) {
      c.notes.push(a);
      const r = resolveAnchor(q, a.anchor).resolved;
      const target = a.type === "commentary" ? c.commented : c.glossed;
      for (const id of r.lines) target.add(lineNo(id));
    }
    for (const g of glosses.filter((x) => x.quartet === q.code && x.movement === mv.n)) {
      c.glosses.push(g);
      const t: LemmaTarget = { movement: g.movement, lemma: g.lemma, hint: g.hint };
      if (g.occurrence) t.occurrence = g.occurrence;
      for (const id of resolveLemma(q, t).resolved.lines) c.glossed.add(lineNo(id));
    }
    cov.push(c);
  }
}

/** Runs of consecutive line numbers in 1..n not in `have`, at least `min` long. */
function bare(n: number, have: Set<number>, min: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = 0;
  for (let i = 1; i <= n + 1; i++) {
    const miss = i <= n && !have.has(i);
    if (miss && !start) start = i;
    if (!miss && start) {
      if (i - start >= min) out.push([start, i - 1]);
      start = 0;
    }
  }
  return out;
}
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const where = (c: Pick<Cov, "code" | "m">) => `${c.code} ${ROMAN[c.m]}`;
const nonCommentary = (c: Cov) => c.notes.filter((n) => n.type !== "commentary");
const commentary = (c: Cov) => c.notes.filter((n) => n.type === "commentary");

const md: string[] = [
  "# Annotation coverage",
  "",
  `Text: **${bundle.source}**${bundle.edition ? ` (${bundle.edition})` : ""} · generated ${new Date().toISOString()}`,
  "",
];
if (sample) {
  md.push("> **Sample text loaded:** lemma anchors are placed at their `hint` lines, so line coverage is approximate.", "");
}
md.push(
  "A line counts as *annotated* when a note's lemma or range, or a word gloss, touches it;",
  "*commentary* is the running paraphrase (`type: commentary`), which aims to cover every line.",
  "",
  "## Summary",
  "",
  "| Quartet | Lines | Notes | Glosses | Commentary passages | Lines annotated | Lines with commentary |",
  "|---|---:|---:|---:|---:|---:|---:|",
);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const totals = { lines: 0, notes: 0, glosses: 0, comm: 0, glossed: 0, commented: 0 };
for (const code of QUARTET_CODES) {
  const cs = cov.filter((c) => c.code === code);
  const quartetNotes = notes.filter((n) => n.anchor.quartet === code && n.anchor.movement === 0).length;
  const row = {
    lines: sum(cs.map((c) => c.lines)),
    notes: sum(cs.map((c) => nonCommentary(c).length)) + quartetNotes,
    glosses: sum(cs.map((c) => c.glosses.length)),
    comm: sum(cs.map((c) => commentary(c).length)),
    glossed: sum(cs.map((c) => c.glossed.size)),
    commented: sum(cs.map((c) => c.commented.size)),
  };
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] += row[k];
  md.push(
    `| ${QUARTET_BY_CODE[code].title} | ${row.lines} | ${row.notes} | ${row.glosses} | ${row.comm} | ${row.glossed} (${pct(row.glossed, row.lines)}) | ${row.commented} (${pct(row.commented, row.lines)}) |`,
  );
}
md.push(
  `| **All** | **${totals.lines}** | **${totals.notes}** | **${totals.glosses}** | **${totals.comm}** | **${totals.glossed} (${pct(totals.glossed, totals.lines)})** | **${totals.commented} (${pct(totals.commented, totals.lines)})** |`,
  "",
  "## By movement",
  "",
  "| Movement | Lines | Notes (reader / scholar) | Glosses | Annotated | Commentary | Longest stretch with no note or gloss |",
  "|---|---:|---:|---:|---:|---:|---|",
);
for (const c of cov) {
  const nn = nonCommentary(c);
  const r = nn.filter((n) => n.level === "reader").length;
  const longest = bare(c.lines, c.glossed, 1).sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  md.push(
    `| ${where(c)} | ${c.lines} | ${nn.length} (${r} / ${nn.length - r}) | ${c.glosses.length} | ${pct(c.glossed.size, c.lines)} | ${pct(c.commented.size, c.lines)} | ${longest ? `${longest[0]}–${longest[1]} (${longest[1] - longest[0] + 1})` : "—"} |`,
  );
}

md.push("", `## Bare stretches`, "", `Runs of ${BARE_MIN} or more lines with no note or gloss, longest first: the places to write next.`, "");
const stretches = cov
  .flatMap((c) => bare(c.lines, c.glossed, BARE_MIN).map(([a, b]) => ({ c, a, b })))
  .sort((x, y) => y.b - y.a - (x.b - x.a));
md.push(...(stretches.length ? stretches.map((s) => `- ${where(s.c)} ${s.a}–${s.b} (${s.b - s.a + 1} lines)`) : ["None. ✓"]), "");

md.push("## Lines without commentary", "");
const uncommented = cov.flatMap((c) => bare(c.lines, c.commented, 1).map(([a, b]) => `${where(c)} ${a === b ? a : `${a}–${b}`}`));
md.push(uncommented.length ? uncommented.join(" · ") : "None. ✓", "");

md.push("## Note types", "", `| Type | ${QUARTET_CODES.join(" | ")} | All |`, `|---|${QUARTET_CODES.map(() => "---:").join("|")}|---:|`);
for (const t of ANNOTATION_TYPES) {
  const per = QUARTET_CODES.map((code) => notes.filter((n) => n.type === t && n.anchor.quartet === code).length);
  md.push(`| ${t} | ${per.join(" | ")} | ${sum(per)} |`);
}
md.push("", "Glosses by kind:", "");
const kinds = [...new Set(glosses.map((g) => g.kind))].sort();
md.push(kinds.length ? kinds.map((k) => `${k} ${glosses.filter((g) => g.kind === k).length}`).join(" · ") : "None yet.", "");

// Review status
const cites = [...notes.flatMap((n) => n.sources), ...glosses.flatMap((g) => g.sources)];
const verified = cites.filter((c) => c.status === "verified").length;
md.push(
  "## Review",
  "",
  "| | Signed off | Waiting |",
  "|---|---:|---:|",
  `| Notes | ${notes.filter((n) => n.reviewed).length} | ${notes.filter((n) => !n.reviewed).length} |`,
  `| Glosses | ${glosses.filter((g) => g.reviewed).length} | ${glosses.filter((g) => !g.reviewed).length} |`,
  `| Citations | ${verified} verified | ${cites.length - verified} to verify |`,
  "",
  "The checklist is in `reports/review-queue.md`; citations by work in `reports/citations-to-verify.md`.",
  "",
);

mkdirSync("reports", { recursive: true });
writeFileSync("reports/coverage.md", md.join("\n"));
writeFileSync(
  "reports/coverage.json",
  JSON.stringify(
    {
      source: bundle.source,
      totals,
      movements: cov.map((c) => ({
        movement: where(c),
        lines: c.lines,
        notes: nonCommentary(c).length,
        glosses: c.glosses.length,
        commentary: commentary(c).length,
        annotatedLines: c.glossed.size,
        commentedLines: c.commented.size,
      })),
    },
    null,
    2,
  ),
);

// ---------------------------------------------------------------- review queue
const rq: string[] = [
  "# Review queue",
  "",
  "Everything not yet signed off, in reading order. Read each item against its sources, then",
  "set `reviewed: true` (notes: frontmatter; glosses: the YAML entry) and `status: verified` on",
  "each citation whose locator you have checked. Re-run `npm run coverage` to refresh this list.",
  "",
];
const toVerify = (xs: { status: string }[]) => xs.filter((c) => c.status === "to-verify").length;
for (const code of QUARTET_CODES) {
  const qn = notes.filter((n) => n.anchor.quartet === code && !n.reviewed);
  const qg = glosses.filter((g) => g.quartet === code && !g.reviewed);
  if (!qn.length && !qg.length) continue;
  rq.push(`## ${QUARTET_BY_CODE[code].title}`, "");
  for (const m of [0, 1, 2, 3, 4, 5] as const) {
    const mn = qn
      .filter((n) => n.anchor.movement === m)
      .sort((a, b) => (a.anchor.hint ?? a.anchor.lineStart ?? 0) - (b.anchor.hint ?? b.anchor.lineStart ?? 0));
    const mg = qg.filter((g) => g.movement === m).sort((a, b) => a.hint - b.hint);
    if (!mn.length && !mg.length) continue;
    rq.push(`### ${m ? ROMAN[m] : "Whole quartet"}`, "");
    for (const n of mn) {
      const at = n.anchor.lineStart ? `ll. ${n.anchor.lineStart}${n.anchor.lineEnd ? `–${n.anchor.lineEnd}` : ""}` : n.anchor.hint ? `l. ${n.anchor.hint}` : "";
      const v = toVerify(n.sources);
      rq.push(`- [ ] \`${n.id}\` · ${n.type} · ${n.confidence}${at ? ` · ${at}` : ""}${v ? ` · ${v} citation${v > 1 ? "s" : ""} to verify` : ""}`);
    }
    for (const g of mg) {
      const v = toVerify(g.sources);
      rq.push(`- [ ] gloss \`${g.id}\` · ${g.kind} · l. ${g.hint}${v ? ` · ${v} citation${v > 1 ? "s" : ""} to verify` : ""}`);
    }
    rq.push("");
  }
}
writeFileSync("reports/review-queue.md", rq.join("\n"));

console.log(
  `coverage (${bundle.source}): ${totals.glossed}/${totals.lines} lines annotated (${pct(totals.glossed, totals.lines)}), ` +
    `${totals.commented} with commentary; ${stretches.length} bare stretch(es) of ${BARE_MIN}+ lines.`,
);
console.log("→ reports/coverage.md, reports/coverage.json, reports/review-queue.md");
