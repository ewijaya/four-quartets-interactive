/**
 * Rights guard. After a build, make sure the private text did not leak into dist/
 * (HTML, JS, JSON and the gzip-compressed Pagefind index) when the build is meant
 * to be public. Local builds with the private text only get a warning.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { PRIVATE_JSON, textMode } from "../src/lib/text/load";
import type { TextBundle } from "../src/lib/model";

const DIST = "dist";
const isPublic = process.env.STILLPOINT_PUBLIC === "1";

function* walk(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function readMaybeGzip(p: string): string {
  const buf = readFileSync(p);
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      return gunzipSync(buf).toString("utf8");
    } catch {
      return "";
    }
  }
  return buf.toString("utf8");
}

function main() {
  if (!existsSync(DIST)) throw new Error("dist/ not found — run astro build first.");
  const mode = textMode();
  if (!existsSync(PRIVATE_JSON)) {
    console.log(`check-dist: no private text present; build used the ${mode} text. OK.`);
    return;
  }
  if (mode === "private" && !isPublic) {
    console.warn("check-dist: ⚠ this build contains the PRIVATE text. Do not deploy it publicly (see RIGHTS.md).");
    return;
  }
  const bundle = JSON.parse(readFileSync(PRIVATE_JSON, "utf8")) as TextBundle;
  const needles = bundle.quartets
    .flatMap((q) => q.movements.flatMap((m) => m.stanzas.flatMap((s) => s.lines.map((l) => l.text))))
    .filter((t) => t.length >= 24);
  const hits: string[] = [];
  for (const file of walk(DIST)) {
    if (!/\.(html|js|mjs|json|txt|xml|css|pf_fragment|pf_index|pf_meta|pagefind)$/.test(file)) continue;
    const body = readMaybeGzip(file);
    for (const n of needles) {
      if (body.includes(n)) {
        hits.push(`${file}: contains a private line (${n.slice(0, 12)}…)`);
        break;
      }
    }
  }
  if (hits.length) {
    console.error(`check-dist: ✗ private text found in ${hits.length} file(s):`);
    hits.slice(0, 20).forEach((h) => console.error("  " + h));
    process.exit(1);
  }
  console.log(`check-dist: ✓ scanned dist/ — no private text (${needles.length} lines checked).`);
}

main();
