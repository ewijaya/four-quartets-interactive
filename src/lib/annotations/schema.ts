import { z } from "astro/zod";
import { ANNOTATION_TYPES, MOTIF_IDS, QUARTET_CODES, type AnnotationMeta, type AnnotationType, type NoteLevel } from "../model";

const MAX_LEMMA_WORDS = 6;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Types that default to the Scholar density level. */
const SCHOLAR_TYPES: AnnotationType[] = ["prosody", "textual", "crossref"];
export const defaultLevel = (t: AnnotationType): NoteLevel => (SCHOLAR_TYPES.includes(t) ? "scholar" : "reader");

export const citationSchema = z.object({
  ref: z.string(),
  locator: z.string().optional(),
  note: z.string().optional(),
  status: z.enum(["verified", "to-verify"]).default("to-verify"),
});

/** Frontmatter as written in content/annotations/**\/*.mdx (anchor fields flattened). */
export const annotationFrontmatter = z
  .object({
    quartet: z.enum(QUARTET_CODES),
    movement: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    lemma: z
      .string()
      .refine((s) => words(s) <= MAX_LEMMA_WORDS, { message: `Lemma must be ${MAX_LEMMA_WORDS} words or fewer.` })
      .optional(),
    occurrence: z.number().int().positive().optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    hint: z.number().int().positive().optional(),
    type: z.enum(ANNOTATION_TYPES),
    title: z.string().min(2).max(90),
    confidence: z.enum(["established", "interpretive"]),
    level: z.enum(["reader", "scholar"]).optional(),
    motifs: z.array(z.enum(MOTIF_IDS)).default([]),
    related: z.array(z.string()).default([]),
    sources: z.array(citationSchema).default([]),
    reviewed: z.boolean().default(false),
  })
  .refine((a) => a.movement !== 0 || (!a.lemma && !a.lineStart), {
    message: "Quartet-level notes (movement 0) cannot carry a lemma or lines.",
  })
  .refine((a) => !a.lineEnd || (a.lineStart !== undefined && a.lineEnd >= a.lineStart), {
    message: "lineEnd requires lineStart and must not precede it.",
  });

export type AnnotationFrontmatter = z.infer<typeof annotationFrontmatter>;

export function toMeta(id: string, fm: AnnotationFrontmatter): AnnotationMeta {
  const anchor: AnnotationMeta["anchor"] = { quartet: fm.quartet, movement: fm.movement };
  if (fm.lemma !== undefined) anchor.lemma = fm.lemma;
  if (fm.occurrence !== undefined) anchor.occurrence = fm.occurrence;
  if (fm.lineStart !== undefined) anchor.lineStart = fm.lineStart;
  if (fm.lineEnd !== undefined) anchor.lineEnd = fm.lineEnd;
  if (fm.hint !== undefined) anchor.hint = fm.hint;
  return {
    id,
    anchor,
    type: fm.type,
    title: fm.title,
    sources: fm.sources.map((c) => {
      const out: AnnotationMeta["sources"][number] = { ref: c.ref, status: c.status };
      if (c.locator !== undefined) out.locator = c.locator;
      if (c.note !== undefined) out.note = c.note;
      return out;
    }),
    related: fm.related,
    motifs: fm.motifs,
    confidence: fm.confidence,
    level: fm.level ?? defaultLevel(fm.type),
    reviewed: fm.reviewed,
  };
}
