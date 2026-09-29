import { describe, expect, it } from "vitest";
import { excerpt, sentences } from "../../src/lib/excerpt";

describe("sentences", () => {
  it("keeps initials and abbreviations inside a sentence", () => {
    expect(sentences("T. S. Eliot visited St. Michael's in 1937. He wrote of it later.")).toEqual([
      "T. S. Eliot visited St. Michael's in 1937.",
      "He wrote of it later.",
    ]);
  });

  it("does not split on a full stop followed by lower case", () => {
    expect(sentences("See vol. I of the edition. Then read on.")).toEqual(["See vol. I of the edition.", "Then read on."]);
  });

  it("keeps a closing quotation mark with its sentence", () => {
    expect(sentences("It recalls ‘the still point.’ The phrase recurs.")).toEqual(["It recalls ‘the still point.’", "The phrase recurs."]);
  });
});

describe("excerpt", () => {
  it("strips markup and returns the opening sentence", () => {
    const body = "The governing image of the whole sequence: a *point* that does not move, as [Dante](https://example.org) has it.\n\nA second paragraph.";
    expect(excerpt(body)).toBe("The governing image of the whole sequence: a point that does not move, as Dante has it.");
  });

  it("adds a second sentence when the first is short", () => {
    expect(excerpt("A grimpen is a bog. Doyle's *Hound of the Baskervilles* made the word familiar.")).toBe(
      "A grimpen is a bog. Doyle's Hound of the Baskervilles made the word familiar.",
    );
  });

  it("stops before running past the limit", () => {
    const long = `${"Short one. ".repeat(3)}${"word ".repeat(60)}end.`;
    expect(excerpt(long, 60, 40).length).toBeLessThanOrEqual(60);
  });

  it("cuts an over-long first sentence at a word", () => {
    const out = excerpt(`${"alpha beta ".repeat(40)}omega.`, 50);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out).not.toMatch(/\s…$/);
  });

  it("is empty for an empty body", () => {
    expect(excerpt("")).toBe("");
  });
});
