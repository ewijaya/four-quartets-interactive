/**
 * Word glosses: short, dictionary-style notes on single words and short phrases
 * (a sense, a register, a pronunciation), lighter than a full annotation. One YAML
 * file per quartet in content/glosses/ (bn.yaml, ec.yaml, ds.yaml, lg.yaml).
 * Read with fs at build time and by the Node scripts, like the text bundle.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "astro/zod";
import { QUARTET_CODES, type Gloss, type QuartetCode } from "../model";
import { citationSchema } from "./schema";

export const GLOSS_DIR = "content/glosses";
export const GLOSS_KINDS = ["sense", "archaic", "rare", "dialect", "technical", "foreign", "name", "coinage"] as const;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export const glossEntry = z.object({
  movement: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  lemma: z.string().min(1).refine((s) => words(s) <= 6, { message: "Lemma must be six words or fewer." }),
  hint: z.number().int().positive(),
  occurrence: z.number().int().positive().optional(),
  kind: z.enum(GLOSS_KINDS).default("sense"),
  /** The gloss itself: one or two sentences, *italics* allowed. */
  gloss: z.string().min(2).refine((s) => words(s) <= 70, { message: "Keep a gloss under 70 words; write a note instead." }),
  /** How Eliot pronounced the word in his recordings, when that is documented. */
  say: z.string().optional(),
  sources: z.array(citationSchema).default([]),
  reviewed: z.boolean().default(false),
});

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface GlossFileResult {
  glosses: Gloss[];
  errors: string[];
}

let cache: GlossFileResult | null = null;

/** All glosses, validated. Ids are "bn-2-erhebung" (quartet, movement, lemma); repeats get "-2". */
export function loadGlosses(dir = GLOSS_DIR, { fresh = false } = {}): GlossFileResult {
  if (cache && !fresh && dir === GLOSS_DIR) return cache;
  const out: GlossFileResult = { glosses: [], errors: [] };
  const root = join(process.cwd(), dir);
  if (!existsSync(root)) return out;
  const seen = new Set<string>();
  for (const f of readdirSync(root).filter((x) => x.endsWith(".yaml")).sort()) {
    const code = f.replace(/\.yaml$/, "").toUpperCase() as QuartetCode;
    if (!QUARTET_CODES.includes(code)) {
      out.errors.push(`${dir}/${f}: file name must be bn, ec, ds or lg`);
      continue;
    }
    let data: unknown;
    try {
      data = YAML.parse(readFileSync(join(root, f), "utf8")) ?? [];
    } catch (e) {
      out.errors.push(`${dir}/${f}: YAML: ${(e as Error).message}`);
      continue;
    }
    if (!Array.isArray(data)) {
      out.errors.push(`${dir}/${f}: expected a list of glosses`);
      continue;
    }
    data.forEach((raw, i) => {
      const parsed = glossEntry.safeParse(raw);
      if (!parsed.success) {
        out.errors.push(`${dir}/${f} #${i + 1}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
        return;
      }
      const g = parsed.data;
      let id = `${code.toLowerCase()}-${g.movement}-${slug(g.lemma)}`;
      for (let k = 2; seen.has(id); k++) id = `${code.toLowerCase()}-${g.movement}-${slug(g.lemma)}-${k}`;
      seen.add(id);
      const gloss: Gloss = {
        id,
        quartet: code,
        movement: g.movement,
        lemma: g.lemma,
        hint: g.hint,
        kind: g.kind,
        gloss: g.gloss,
        sources: g.sources,
        reviewed: g.reviewed,
      };
      if (g.occurrence !== undefined) gloss.occurrence = g.occurrence;
      if (g.say !== undefined) gloss.say = g.say;
      out.glosses.push(gloss);
    });
  }
  if (dir === GLOSS_DIR) cache = out;
  return out;
}

/** Minimal inline markup for gloss text: *italic*, with everything else escaped. */
export function glossHtml(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return esc.replace(/\*([^*]+)\*/g, "<i>$1</i>");
}
