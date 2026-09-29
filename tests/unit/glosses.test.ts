import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { glossHtml, loadGlosses } from "../../src/lib/annotations/glosses";

let dir = "";
afterEach(() => {
  vi.restoreAllMocks();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function fixture(files: Record<string, string>) {
  dir = mkdtempSync(join(tmpdir(), "stillpoint-glosses-"));
  mkdirSync(join(dir, "g"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, "g", name), body);
  vi.spyOn(process, "cwd").mockReturnValue(dir);
}

describe("loadGlosses", () => {
  it("validates entries and gives stable, unique ids", () => {
    fixture({
      "bn.yaml": `
- movement: 2
  lemma: "Erhebung"
  hint: 28
  kind: foreign
  gloss: "German, *elevation*."
- movement: 2
  lemma: "Erhebung"
  hint: 30
  gloss: "Again."
`,
    });
    const { glosses, errors } = loadGlosses("g");
    expect(errors).toEqual([]);
    expect(glosses.map((g) => g.id)).toEqual(["bn-2-erhebung", "bn-2-erhebung-2"]);
    expect(glosses[1]!.kind).toBe("sense");
    expect(glosses[0]!.reviewed).toBe(false);
  });

  it("reports bad entries without dropping good ones", () => {
    fixture({
      "ec.yaml": `
- movement: 7
  lemma: "x"
  hint: 1
  gloss: "Bad movement."
- movement: 1
  lemma: "one two three four five six seven"
  hint: 1
  gloss: "Too long."
- movement: 1
  lemma: "grimpen"
  hint: 41
  gloss: "A bog."
`,
      "xx.yaml": "[]",
    });
    const { glosses, errors } = loadGlosses("g");
    expect(glosses.map((g) => g.id)).toEqual(["ec-1-grimpen"]);
    expect(errors).toHaveLength(3);
  });
});

describe("glossHtml", () => {
  it("escapes and allows italics only", () => {
    expect(glossHtml("<b>x</b> *Paradiso* & more")).toBe("&lt;b&gt;x&lt;/b&gt; <i>Paradiso</i> &amp; more");
  });
});
