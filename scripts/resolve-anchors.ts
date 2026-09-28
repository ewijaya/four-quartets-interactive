/**
 * Resolve every lemma anchor (annotations, motif occurrences, scene cues) against
 * the imported text and write a report for fixing by hand:
 *
 *   npm run resolve-anchors            # auto: private text if present, else sample
 *   npm run resolve-anchors -- --strict   # exit 1 if anything is unresolved
 *
 * Writes reports/unresolved-anchors.md, reports/anchors.json and
 * reports/citations-to-verify.md. Reports never quote more than six words of text.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadText } from "../src/lib/text/load";
import { resolveAnchor, resolveLemma, suggest, wordCount, type Resolution } from "../src/lib/anchors/resolve";
import { readAnnotationFiles } from "../src/lib/annotations/files";
import { MOTIFS } from "../src/data/motifs";
import { CUES } from "../src/data/cues";
import { BIB_BY_ID } from "../src/data/bibliography";
import { SOURCE_BY_ID } from "../src/data/sources";
import { ROMAN } from "../src/data/quartets";
import type { MovementN, QuartetCode, QuartetText } from "../src/lib/model";

const strict = process.argv.includes("--strict");
const bundle = loadText();
const sample = bundle.source === "sample";
const byCode = new Map(bundle.quartets.map((q) => [q.code, q]));

interface Row {
  kind: "annotation" | "motif" | "cue";
  id: string;
  quartet: QuartetCode;
  movement: number;
  lemma: string;
  file: string;
  res: Resolution;
}

const rows: Row[] = [];
const problems: string[] = [];
const files = readAnnotationFiles();
const ids = new Set(files.filter((f) => f.meta).map((f) => f.meta!.id));

for (const f of files) {
  if (f.error || !f.meta) {
    problems.push(`\`${f.file}\`: ${f.error}`);
    continue;
  }
  const a = f.meta;
  const q = byCode.get(a.anchor.quartet);
  if (!q) continue;
  const res = resolveAnchor(q, a.anchor);
  rows.push({ kind: "annotation", id: a.id, quartet: a.anchor.quartet, movement: a.anchor.movement, lemma: a.anchor.lemma ?? "", file: f.file, res });
  for (const r of a.related) if (!ids.has(r)) problems.push(`\`${a.id}\`: related note \`${r}\` does not exist (yet)`);
  for (const c of a.sources) if (!BIB_BY_ID[c.ref] && !SOURCE_BY_ID[c.ref]) problems.push(`\`${a.id}\`: unknown citation ref \`${c.ref}\``);
  if (a.anchor.lemma && wordCount(a.anchor.lemma) > 6) problems.push(`\`${a.id}\`: lemma longer than six words`);
}

const lemmaRow = (kind: Row["kind"], id: string, q: QuartetText, m: MovementN, lemma: string, file: string, hint?: number, occurrence?: number) => {
  const t: Parameters<typeof resolveLemma>[1] = { movement: m, lemma };
  if (hint !== undefined) t.hint = hint;
  if (occurrence !== undefined) t.occurrence = occurrence;
  rows.push({ kind, id, quartet: q.code, movement: m, lemma, file, res: resolveLemma(q, t) });
};

for (const motif of MOTIFS) {
  motif.occurrences.forEach((o, i) => {
    const q = byCode.get(o.quartet);
    if (q) lemmaRow("motif", `${motif.id}#${i + 1}`, q, o.movement, o.lemma, "src/data/motif-occurrences.ts", o.hint, o.occurrence);
    if (o.note && !ids.has(o.note)) problems.push(`motif \`${motif.id}\` occurrence ${i + 1}: note \`${o.note}\` does not exist`);
  });
}
for (const cue of CUES) {
  const q = byCode.get(cue.quartet);
  if (!q) continue;
  lemmaRow("cue", cue.id, q, cue.movement, cue.lemma, "src/data/cues.ts", cue.hint, cue.occurrence);
  if (cue.until) lemmaRow("cue", `${cue.id} (until)`, q, cue.movement, cue.until.lemma, "src/data/cues.ts", cue.until.hint, cue.until.occurrence);
}

const lemmaRows = rows.filter((r) => r.lemma);
const unresolved = lemmaRows.filter((r) => r.res.matches === 0);
const ambiguous = lemmaRows.filter((r) => r.res.matches > 1);
const rangeProblems = rows.filter((r) => !r.lemma && r.res.problem);

const where = (r: Row) => `${r.quartet} ${r.movement ? ROMAN[r.movement] : "—"}`;
const clip = (s: string) => s.split(" ").slice(0, 6).join(" ");

const md: string[] = [
  "# Anchor resolution report",
  "",
  `Text: **${bundle.source}**${bundle.edition ? ` (${bundle.edition})` : ""} · generated ${new Date().toISOString()}`,
  "",
];
if (sample) {
  md.push(
    "> **Sample text loaded.** Lemmas cannot match placeholder lines, so every lemma anchor is",
    "> placed at its `hint` line and listed below as unresolved. Import your own copy",
    "> (`npm run import-text`) and re-run this script to get a meaningful report.",
    "",
  );
}
md.push(
  "| | Count |",
  "|---|---|",
  `| Annotations | ${files.length} |`,
  `| Lemma anchors (annotations, motifs, cues) | ${lemmaRows.length} |`,
  `| Resolved exactly | ${lemmaRows.length - unresolved.length} |`,
  `| **Unresolved** | **${unresolved.length}** |`,
  `| Ambiguous (matched more than once, disambiguated by hint) | ${ambiguous.length} |`,
  `| Range / schema / reference problems | ${rangeProblems.length + problems.length} |`,
  "",
);

md.push("## Unresolved", "");
if (!unresolved.length) md.push("None. ✓", "");
else {
  md.push("Fix the `lemma` (or add `hint`/`occurrence`) in the listed file.", "", "| Anchor | Where | Lemma | Nearest in text | File |", "|---|---|---|---|---|");
  for (const r of unresolved) {
    const q = byCode.get(r.quartet)!;
    const sug = sample || !r.movement ? [] : suggest(q, r.movement as MovementN, r.lemma, 2);
    const near = sug.length ? sug.map((s) => `\`${s.line}\` “${clip(s.window)}” (Δ${s.distance})`).join("<br>") : "—";
    md.push(`| \`${r.id}\` (${r.kind}) | ${where(r)} | “${r.lemma}” | ${near} | \`${r.file}\` |`);
  }
  md.push("");
}

md.push("## Ambiguous", "");
if (!ambiguous.length) md.push("None.", "");
else {
  md.push("These lemmas occur more than once in their movement. The match nearest the `hint` was used; add `occurrence:` to make it explicit.", "", "| Anchor | Where | Lemma | Matches | Chosen |", "|---|---|---|---|---|");
  for (const r of ambiguous) md.push(`| \`${r.id}\` | ${where(r)} | “${r.lemma}” | ${r.res.matches} | ${r.res.resolved.lines[0] ?? "—"} |`);
  md.push("");
}

md.push("## Other problems", "");
const other = [...rangeProblems.map((r) => `\`${r.id}\`: ${r.res.problem}`), ...problems];
md.push(...(other.length ? other.map((p) => `- ${p}`) : ["None."]), "");

mkdirSync("reports", { recursive: true });
writeFileSync("reports/unresolved-anchors.md", md.join("\n"));
writeFileSync(
  "reports/anchors.json",
  JSON.stringify(
    {
      source: bundle.source,
      counts: { annotations: files.length, lemmas: lemmaRows.length, unresolved: unresolved.length, ambiguous: ambiguous.length, problems: other.length },
      unresolved: unresolved.map((r) => ({ id: r.id, kind: r.kind, where: where(r), lemma: r.lemma, file: r.file })),
    },
    null,
    2,
  ),
);

// Citations to verify
const cites = new Map<string, string[]>();
for (const f of files) {
  if (!f.meta) continue;
  for (const c of f.meta.sources) {
    if (c.status !== "to-verify") continue;
    const arr = cites.get(c.ref) ?? [];
    arr.push(`\`${f.meta.id}\`${c.locator ? ` (${c.locator})` : ""}${c.note ? ` — ${c.note}` : ""}`);
    cites.set(c.ref, arr);
  }
}
const cmd = [
  "# Citations to verify",
  "",
  "Each citation below names a real work, but its relevance or locator has not yet been",
  "checked against the source. Verify, add a page/section `locator`, and set `status: verified`.",
  "",
  ...[...cites.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .flatMap(([ref, uses]) => {
      const b = BIB_BY_ID[ref];
      const s = SOURCE_BY_ID[ref];
      const label = b ? `${b.author}, *${b.title}* (${b.year})` : s ? `${s.author}, *${s.work}*` : ref;
      return [`## ${label}`, "", `${uses.length} use(s): ${uses.join(", ")}`, ""];
    }),
];
writeFileSync("reports/citations-to-verify.md", cmd.join("\n"));

console.log(
  `resolve-anchors (${bundle.source}): ${lemmaRows.length} lemma anchors, ${unresolved.length} unresolved, ${ambiguous.length} ambiguous, ${other.length} other problem(s).`,
);
console.log("→ reports/unresolved-anchors.md, reports/anchors.json, reports/citations-to-verify.md");
if (strict && !sample && (unresolved.length || other.length)) process.exit(1);
