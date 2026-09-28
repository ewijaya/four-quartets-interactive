import { describe, expect, it } from "vitest";
import { parseSource } from "../../src/lib/text/parse";
import { normalise, resolveAnchor, resolveLemma, suggest } from "../../src/lib/anchors/resolve";
import { renderSegments, segmentLine } from "../../src/lib/anchors/segment";

// Invented fixture verse.
const SRC = `East Coker
I
The lantern swings above the ‘quiet’ yard,
where Adam’s children gather in the frost;
the lantern swings—and all the road is hard,
and nothing that was given can be lost.

A rose, a rose; arose the morning mist.
II
x
III
x
IV
x
V
x
`;
const q = parseSource(SRC, "ec.txt").quartets[0]!;

describe("normalise", () => {
  it("folds quotes, dashes, case and punctuation", () => {
    expect(normalise("The “Quiet” Yard—and")).toBe("the quiet yard and");
    expect(normalise("Adam’s")).toBe("adams");
  });
});

describe("resolveLemma", () => {
  it("finds a lemma despite curly quotes and punctuation", () => {
    const r = resolveLemma(q, { movement: 1, lemma: "the 'quiet' yard" });
    expect(r.matches).toBe(1);
    expect(r.resolved.spans).toEqual([{ line: "EC.1.1", start: 25, end: 41 }]);
    expect(q.movements[0]!.stanzas[0]!.lines[0]!.text.slice(25, 41)).toBe("the ‘quiet’ yard");
  });

  it("matches across a line break", () => {
    const r = resolveLemma(q, { movement: 1, lemma: "yard, where Adam's children" });
    expect(r.resolved.lines).toEqual(["EC.1.1", "EC.1.2"]);
    expect(r.resolved.spans[1]).toEqual({ line: "EC.1.2", start: 0, end: 21 });
  });

  it("respects word boundaries", () => {
    const r = resolveLemma(q, { movement: 1, lemma: "rose" });
    expect(r.matches).toBe(2); // "A rose, a rose" but not "arose"
  });

  it("chooses by occurrence, then by hint", () => {
    const second = resolveLemma(q, { movement: 1, lemma: "the lantern swings", occurrence: 2 });
    expect(second.resolved.lines).toEqual(["EC.1.3"]);
    const near = resolveLemma(q, { movement: 1, lemma: "the lantern swings", hint: 3 });
    expect(near.resolved.lines).toEqual(["EC.1.3"]);
  });

  it("falls back to the hint line and reports a problem", () => {
    const r = resolveLemma(q, { movement: 1, lemma: "the lamplit yard", hint: 2 });
    expect(r.matches).toBe(0);
    expect(r.problem).toBeDefined();
    expect(r.resolved.kind).toBe("hint");
    expect(r.resolved.approximate).toBe(true);
    expect(r.resolved.lines).toEqual(["EC.1.2"]);
  });

  it("accepts a close variant spelling and reports it", () => {
    const r = resolveLemma(q, { movement: 1, lemma: "nothing that was givven can" });
    expect(r.matches).toBe(1);
    expect(r.fuzzy?.distance).toBe(1);
    expect(r.resolved.lines).toEqual(["EC.1.4"]);
  });

  it("does not fuzzy-match short lemmas", () => {
    expect(resolveLemma(q, { movement: 1, lemma: "a rise" }).matches).toBe(0);
  });

  it("suggests near windows", () => {
    const s = suggest(q, 1, "the lantern swung");
    expect(s[0]!.window).toBe("the lantern swings");
    expect(s[0]!.window.split(" ").length).toBeLessThanOrEqual(6);
  });
});

describe("resolveAnchor", () => {
  it("handles ranges, movements and quartet-level notes", () => {
    expect(resolveAnchor(q, { quartet: "EC", movement: 1, lineStart: 2, lineEnd: 3 }).resolved.lines).toEqual(["EC.1.2", "EC.1.3"]);
    expect(resolveAnchor(q, { quartet: "EC", movement: 2 }).resolved.kind).toBe("movement");
    expect(resolveAnchor(q, { quartet: "EC", movement: 0 }).resolved.kind).toBe("quartet");
  });
});

describe("segmentLine", () => {
  it("splits overlapping marks into non-overlapping segments", () => {
    const segs = segmentLine("abcdefghij", [
      { id: "a", start: 0, end: 6, approximate: false, level: "scholar" },
      { id: "b", start: 3, end: 10, approximate: false, level: "reader" },
    ]);
    expect(segs.map((s) => [s.text, s.ids.join("+"), s.level])).toEqual([
      ["abc", "a", "scholar"],
      ["def", "a+b", "reader"],
      ["ghij", "b", "reader"],
    ]);
  });

  it("escapes text and emits anchor spans", () => {
    const html = renderSegments(segmentLine("a < b & c", [{ id: "n1", start: 4, end: 5, approximate: true, level: "reader" }]));
    expect(html).toBe('a &lt; <a class="anchor anchor--approx" href="#n-n1" data-notes="n1" data-level="reader">b</a> &amp; c');
  });
});
