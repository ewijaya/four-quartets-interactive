import { describe, expect, it } from "vitest";
import { buildConcordance, indexable, lineLabel, relatedForms, tokens, wordKey } from "../../src/lib/concordance";

// Invented fixture verse.
const c = buildConcordance([
  { id: "EC.1.1", text: "The dancers’ rose-garden, and the roses fall;" },
  { id: "EC.1.2", text: "a dance of dancing time, a timeless dance." },
  { id: "LG.5.3", text: "Still the rose, and stillness in the rose." },
]);

describe("tokens", () => {
  it("splits compounds, keeps apostrophes inside words, records offsets", () => {
    // A trailing ’ may be a closing quotation mark, so it is not part of the word.
    const t = tokens("The dancers’ rose-garden, Adam’s ‘curse’");
    expect(t.map((x) => x.word)).toEqual(["The", "dancers", "rose", "garden", "Adam’s", "curse"]);
    expect(t[2]).toMatchObject({ key: "rose", start: 13, end: 17 });
  });
  it("normalises keys", () => {
    expect(wordKey("Adam’s")).toBe("adam");
    expect(wordKey("dancers’")).toBe("dancers");
    expect(indexable("the")).toBe(false);
    expect(indexable("still")).toBe(true);
  });
});

describe("buildConcordance", () => {
  it("indexes content words in reading order", () => {
    expect(c.index.get("rose")!.map((h) => c.lines[h.line]!.id)).toEqual(["EC.1.1", "LG.5.3", "LG.5.3"]);
    expect(c.index.has("the")).toBe(false);
    expect(c.index.get("dance")).toHaveLength(2);
  });
  it("finds related forms", () => {
    expect(relatedForms(c, "rose").map((r) => r.key)).toEqual(["roses"]);
    expect(relatedForms(c, "dance").map((r) => r.key).sort()).toEqual(["dancers", "dancing"]);
    expect(relatedForms(c, "time").map((r) => r.key)).toEqual(["timeless"]);
    expect(relatedForms(c, "still").map((r) => r.key)).toEqual(["stillness"]);
  });
  it("labels lines", () => {
    expect(lineLabel("LG.5.3")).toBe("LG V 3");
  });
});
