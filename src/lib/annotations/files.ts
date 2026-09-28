/**
 * Read annotation MDX files directly (Node only) — used by scripts that run outside
 * Astro. Validates frontmatter with the same schema as the content collection.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";
import { annotationFrontmatter, toMeta } from "./schema";
import type { AnnotationMeta } from "../model";

export interface AnnotationFile {
  file: string;
  meta?: AnnotationMeta;
  body: string;
  error?: string;
}

function* walk(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (f.endsWith(".mdx") && !f.startsWith("_")) yield p;
  }
}

export function readAnnotationFiles(dir = "content/annotations"): AnnotationFile[] {
  const out: AnnotationFile[] = [];
  for (const path of walk(dir)) {
    const file = relative(process.cwd(), path);
    const raw = readFileSync(path, "utf8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
    if (!m) {
      out.push({ file, body: raw, error: "missing frontmatter" });
      continue;
    }
    try {
      const data = YAML.parse(m[1]!);
      const parsed = annotationFrontmatter.safeParse(data);
      if (!parsed.success) {
        out.push({ file, body: m[2]!, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        continue;
      }
      const id = path.replace(/^.*\//, "").replace(/\.mdx$/, "");
      out.push({ file, body: m[2]!, meta: toMeta(id, parsed.data) });
    } catch (e) {
      out.push({ file, body: m[2]!, error: `YAML: ${(e as Error).message}` });
    }
  }
  return out;
}
