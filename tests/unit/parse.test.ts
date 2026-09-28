import { describe, expect, it } from "vitest";
import { identifyQuartet, normaliseSource, parseSource } from "../../src/lib/text/parse";
import { SAMPLE_SHAPE, renderSampleSource } from "../../src/lib/text/sample-shape";

// Fixture verse is invented for testing; it is not Eliot's text.
const FIXTURE = [
  "﻿%% edition: test fixture",
  "Burnt Norton",
  "",
  "ὁ λόγος fixture",
  "",
  "I",
  "",
  "The orchard keeps its counsel in the rain,",
  "\tand every gate stands open to the lane.",
  "A thrush",
  "                    replies from somewhere near",
  "",
  "Second stanza, one line.",
  "",
  "II",
  "Only line of two.",
  "",
  "III",
  "",
  "Three.",
  "II",
  "",
  "IV",
  "",
  "Four.",
  "",
  "V",
  "",
  "%% nostep",
  "                        Not a step, forced.",
  "Five.\r",
].join("\r\n");

describe("normaliseSource", () => {
  it("strips BOM, CRLF and expands tabs", () => {
    const lines = normaliseSource("﻿a\r\n\tb  ");
    expect(lines).toEqual(["a", "    b"]);
  });
});

describe("identifyQuartet", () => {
  it("matches titles and file names loosely", () => {
    expect(identifyQuartet("THE DRY SALVAGES")).toBe("the-dry-salvages");
    expect(identifyQuartet("dry-salvages")).toBe("the-dry-salvages");
    expect(identifyQuartet("little_gidding")).toBe("little-gidding");
    expect(identifyQuartet("Four Quartets")).toBeNull();
  });
});

describe("parseSource", () => {
  const res = parseSource(FIXTURE, "whatever.txt");
  const q = res.quartets[0]!;

  it("reads edition directive and the title", () => {
    expect(res.edition).toBe("test fixture");
    expect(q.code).toBe("BN");
    expect(q.title).toBe("Burnt Norton");
  });

  it("collects front matter with language detection", () => {
    expect(q.frontMatter).toHaveLength(1);
    expect(q.frontMatter[0]!.lang).toBe("grc");
  });

  it("finds five movements and stanza breaks", () => {
    expect(q.movements.map((m) => m.n)).toEqual([1, 2, 3, 4, 5]);
    expect(q.movements[0]!.stanzas.map((s) => s.lines.length)).toEqual([4, 1]);
  });

  it("numbers lines per movement with stable ids", () => {
    const m1 = q.movements[0]!.stanzas.flatMap((s) => s.lines);
    expect(m1.map((l) => l.id)).toEqual(["BN.1.1", "BN.1.2", "BN.1.3", "BN.1.4", "BN.1.5"]);
    expect(m1[4]!.stanza).toBe(2);
  });

  it("keeps indentation and detects stepped lines", () => {
    const m1 = q.movements[0]!.stanzas.flatMap((s) => s.lines);
    expect(m1[1]!.indent).toBe(4);
    expect(m1[3]!.step).toBe(true);
    expect(m1[3]!.indent).toBe(0);
  });

  it("treats an out-of-sequence numeral as verse, and warns", () => {
    const m3 = q.movements[2]!.stanzas.flatMap((s) => s.lines);
    expect(m3.map((l) => l.text)).toEqual(["Three.", "II"]);
    expect(res.warnings.some((w) => /Unexpected movement numeral "II"/.test(w.message))).toBe(true);
  });

  it("honours %% nostep", () => {
    const m5 = q.movements[4]!.stanzas.flatMap((s) => s.lines);
    expect(m5[0]!.step).toBeUndefined();
    expect(m5[0]!.indent).toBe(24);
    expect(m5[1]!.text).toBe("Five.");
  });

  it("splits a combined file at title lines", () => {
    const both = "Burnt Norton\nI\na\nII\nb\nIII\nc\nIV\nd\nV\ne\n\nEast Coker\nI\nf\nII\ng\nIII\nh\nIV\ni\nV\nj\n";
    const r = parseSource(both, "four-quartets.txt");
    expect(r.quartets.map((x) => x.code)).toEqual(["BN", "EC"]);
    expect(r.warnings).toEqual([]);
  });

  it("warns when movements are missing", () => {
    const r = parseSource("East Coker\nI\nonly one\n", "x.txt");
    expect(r.warnings.some((w) => /Found 1 movements/.test(w.message))).toBe(true);
  });
});

describe("sample shape round-trips through the importer", () => {
  for (const shape of SAMPLE_SHAPE) {
    it(`${shape.code} matches its shape`, () => {
      const r = parseSource(renderSampleSource(shape), `${shape.id}.txt`);
      expect(r.warnings).toEqual([]);
      const q = r.quartets[0]!;
      expect(q.movements.map((m) => m.stanzas.map((s) => s.lines.length))).toEqual(
        shape.movements.map((mv) => mv.map((s) => s.n)),
      );
      const steps = q.movements.flatMap((m) => m.stanzas.flatMap((s) => s.lines)).filter((l) => l.step).length;
      expect(steps).toBe(shape.movements.flat().reduce((a, s) => a + (s.step?.length ?? 0), 0));
    });
  }
});
