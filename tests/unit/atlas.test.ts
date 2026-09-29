import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { NOTE_PLACES } from "../../src/data/note-places";
import { PLACES, PLACE_BY_ID } from "../../src/data/places";
import { SOURCES } from "../../src/data/sources";
import { atlasLinks } from "../../src/lib/atlas";

const DIR = "content/annotations";
const notes = readdirSync(DIR).flatMap((d) =>
  readdirSync(join(DIR, d)).map((f) => {
    const fm = parse(readFileSync(join(DIR, d, f), "utf8").split(/^---$/m)[1]!) as { type: string };
    return { id: f.replace(/\.mdx$/, ""), type: fm.type };
  }),
);

describe("atlas lines", () => {
  const Q = { BN: "burnt-norton", EC: "east-coker", DS: "dry-salvages", LG: "little-gidding" } as const;
  const sources = [
    { id: "dante", placeId: "florence" },
    { id: "mallarme", placeId: "paris" },
    { id: "mallarme-2", placeId: "paris" },
    { id: "ferrar", placeId: "little-gidding" },
    { id: "unplaced" },
  ];

  it("joins a source's place to each quartet whose notes cite it, counting each note once", () => {
    const links = atlasLinks(
      [
        { id: "lg-1", quartet: "LG", sources: ["dante", "ricks-mccue-2015"] },
        { id: "lg-2", quartet: "LG", sources: ["dante"] },
        { id: "bn-1", quartet: "BN", sources: ["mallarme", "mallarme-2", "unplaced"] },
      ],
      sources,
      Q,
    );
    expect(links).toEqual([
      { id: "link-florence--little-gidding", from: "florence", to: "little-gidding", notes: ["lg-1", "lg-2"], sources: ["dante"] },
      { id: "link-paris--burnt-norton", from: "paris", to: "burnt-norton", notes: ["bn-1"], sources: ["mallarme", "mallarme-2"] },
    ]);
  });

  it("draws no line from a quartet's place to itself", () => {
    expect(atlasLinks([{ id: "lg-1", quartet: "LG", sources: ["ferrar"] }], sources, Q)).toEqual([]);
  });
});

describe("atlas data", () => {
  it("puts every source on the map, at a place that lists it", () => {
    for (const s of SOURCES) {
      expect(s.placeId, s.id).toBeDefined();
      expect(PLACE_BY_ID[s.placeId!]?.sources ?? [], s.id).toContain(s.id);
    }
  });

  it("maps every note of type place, and only those", () => {
    const placeNotes = notes.filter((n) => n.type === "place").map((n) => n.id);
    expect(NOTE_PLACES.map((n) => n.note).sort()).toEqual(placeNotes.sort());
    for (const np of NOTE_PLACES) {
      expect(np.points.length, np.note).toBeGreaterThan(0);
      if (np.place) expect(PLACE_BY_ID[np.place], np.note).toBeDefined();
      for (const pt of np.points) {
        expect(Math.abs(pt.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(pt.lng)).toBeLessThanOrEqual(180);
      }
    }
  });

  it("gives every place a unique id", () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });
});
