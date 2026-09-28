import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { annotationFrontmatter } from "./lib/annotations/schema";

const annotations = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.mdx",
    base: "./content/annotations",
    // The file name (without extension) is the annotation id: "bn-still-point".
    generateId: ({ entry }) => entry.replace(/^.*\//, "").replace(/\.mdx$/, ""),
  }),
  schema: annotationFrontmatter,
});

export const collections = { annotations };
