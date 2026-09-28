/**
 * Import the poem from plain-text files.
 *
 *   npm run import-text                      # content/text-private/*.txt → quartets.json
 *   npm run import-text -- --dir content/text-sample --source sample
 *
 * Writes <dir>/quartets.json and reports/import-report[-sample].md. The report
 * describes shape and anomalies only; it never contains the poem's text.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describeShape, orderQuartets, parseSource, type ParseWarning } from "../src/lib/text/parse";
import type { QuartetText, TextBundle, TextSource } from "../src/lib/model";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

export function importDir(dir: string, source: TextSource): { bundle: TextBundle; warnings: ParseWarning[]; files: string[] } {
  if (!existsSync(dir)) throw new Error(`No such directory: ${dir}`);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort();
  if (!files.length) throw new Error(`No .txt files in ${dir}. See docs/TEXT-FORMAT.md.`);

  const all: QuartetText[] = [];
  const warnings: ParseWarning[] = [];
  let edition: string | undefined;
  for (const f of files) {
    const res = parseSource(readFileSync(join(dir, f), "utf8"), f);
    for (const w of res.warnings) warnings.push({ ...w, message: `${f}: ${w.message}` });
    edition ??= res.edition;
    for (const q of res.quartets) {
      if (all.some((x) => x.code === q.code)) warnings.push({ quartet: q.code, message: `${f}: ${q.title} already imported from another file; skipped.` });
      else all.push(q);
    }
  }
  const { quartets, missing } = orderQuartets(all);
  for (const c of missing) warnings.push({ quartet: c, message: `Quartet ${c} not found in any file.` });

  const bundle: TextBundle = { source, generatedAt: new Date().toISOString(), quartets };
  if (edition) bundle.edition = edition;
  return { bundle, warnings, files };
}

function main() {
  const source = arg("source", "private") as TextSource;
  const dir = arg("dir", source === "sample" ? "content/text-sample" : "content/text-private");
  const { bundle, warnings, files } = importDir(dir, source);
  const out = join(dir, "quartets.json");
  writeFileSync(out, JSON.stringify(bundle, null, source === "sample" ? 1 : 0));

  mkdirSync("reports", { recursive: true });
  const report = [
    `# Import report (${source})`,
    "",
    `Generated ${bundle.generatedAt} from ${files.map((f) => "`" + f + "`").join(", ")} in \`${relative(process.cwd(), dir)}\`.`,
    bundle.edition ? `Edition: ${bundle.edition}` : "Edition: (not specified — add `%% edition: …` to a source file)",
    "",
    "This report lists structure only; it never reproduces the text.",
    "",
    ...bundle.quartets.flatMap((q) => [
      `## ${q.title} — ${q.lineCount} lines`,
      "",
      `Front matter: ${q.frontMatter.length} line(s)${q.frontMatter.some((l) => l.lang === "grc") ? " (includes Greek)" : ""}`,
      "",
      "```",
      describeShape(q),
      "```",
      "",
      `Indented lines: ${q.movements.flatMap((m) => m.stanzas.flatMap((s) => s.lines)).filter((l) => l.indent > 0).length}; stepped lines: ${q.movements.flatMap((m) => m.stanzas.flatMap((s) => s.lines)).filter((l) => l.step).length}`,
      "",
    ]),
    "## Warnings",
    "",
    ...(warnings.length ? warnings.map((w) => `- ${w.quartet ? `[${w.quartet}] ` : ""}${w.line ? `source line ${w.line}: ` : ""}${w.message}`) : ["None."]),
    "",
  ].join("\n");
  const reportFile = join("reports", source === "sample" ? "import-report-sample.md" : "import-report.md");
  writeFileSync(reportFile, report);

  const total = bundle.quartets.reduce((a, q) => a + q.lineCount, 0);
  console.log(`Imported ${bundle.quartets.length} quartet(s), ${total} lines → ${out}`);
  console.log(`Report → ${reportFile} (${warnings.length} warning(s))`);
  if (warnings.length) for (const w of warnings) console.warn(`  ! ${w.message}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
