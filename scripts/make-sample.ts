/**
 * Generate the committed placeholder text:
 *   content/text-sample/<quartet>.txt   (importer input format)
 *   content/text-sample/quartets.json   (via the real importer)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_SHAPE, renderSampleSource } from "../src/lib/text/sample-shape";
import { importDir } from "./import-text";

const dir = "content/text-sample";
mkdirSync(dir, { recursive: true });
for (const q of SAMPLE_SHAPE) {
  writeFileSync(join(dir, `${q.id}.txt`), renderSampleSource(q) + "\n");
}
const { bundle, warnings } = importDir(dir, "sample");
// Keep the committed sample stable across runs.
bundle.generatedAt = "sample";
writeFileSync(join(dir, "quartets.json"), JSON.stringify(bundle));
const total = bundle.quartets.reduce((a, q) => a + q.lineCount, 0);
console.log(`Sample: ${bundle.quartets.length} quartets, ${total} lines → ${dir}/quartets.json`);
for (const q of bundle.quartets) console.log(`  ${q.code}: ${q.movements.map((m) => m.lineCount).join(" / ")} = ${q.lineCount}`);
if (warnings.length) {
  for (const w of warnings) console.error(`  ! ${w.message}`);
  process.exit(1);
}
