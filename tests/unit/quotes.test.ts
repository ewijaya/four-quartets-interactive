import { describe, expect, it } from "vitest";
import { parseSource } from "../../src/lib/text/parse";
import { QUOTE_MAX, longQuotes, quoteIndex } from "../../src/lib/annotations/quotes";

// Invented fixture verse.
const SRC = `East Coker
I
The lantern swings above the ‘quiet’ yard,
where Adam’s children gather in the frost;
the lantern swings—and all the road is hard,
and nothing that was given can be lost.
II
x
III
x
IV
x
V
x
`;
const index = quoteIndex(parseSource(SRC, "ec.txt").quartets);

describe("longQuotes", () => {
  it("allows phrases of up to six words", () => {
    expect(QUOTE_MAX).toBe(6);
    expect(longQuotes("It speaks of ‘Adam’s children gather in the frost’.", index)).toEqual([]);
  });

  it("reports one run per quotation, with its length and first line", () => {
    const note = "The yard, where ‘Adam’s children gather in the frost; the lantern’ swings on.";
    expect(longQuotes(note, index)).toEqual([{ line: "EC.1.1", words: 11 }]);
  });

  it("ignores punctuation and line breaks, and finds separate runs", () => {
    const note = "Quiet YARD, where Adam's children gather: ‘frost; the lantern swings—and all the road’, and ‘nothing that was given can be lost!’";
    expect(longQuotes(note, index)).toEqual([
      { line: "EC.1.2", words: 8 },
      { line: "EC.1.4", words: 8 },
    ]);
  });
});
