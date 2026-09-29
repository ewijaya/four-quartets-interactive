import { describe, expect, it } from "vitest";
import { PER_TURN, PITCH, R, SpiralLayout, laneRadius, type SpiralData } from "../../src/lib/viz/spiral-layout";
import { cardFor, occurrencesOf } from "../../src/lib/viz/spiral-card";

/** Two quartets of five movements each; movement lengths differ so evenness is tested. */
function fixture(): SpiralData {
  const lengths = [[10, 40, 20, 8, 30], [12, 30, 25, 10, 40]];
  const quartets: SpiralData["quartets"] = [];
  const movements: SpiralData["movements"] = [];
  let g = 0;
  lengths.forEach((ls, q) => {
    const code = q ? "EC" : "BN";
    const start = g;
    ls.forEach((count, i) => {
      movements.push({ quartet: code, n: i + 1, roman: ["I", "II", "III", "IV", "V"][i]!, start: g, count, href: `/${code}/${i + 1}`, compare: `/compare/${i + 1}`, notes: 2, motifs: ["rose"] });
      g += count;
    });
    quartets.push({ code, title: q ? "East Coker" : "Burnt Norton", element: q ? "earth" : "air", year: q ? 1940 : 1936, start, count: g - start });
  });
  const note = (i: number, related: number[] = []): SpiralData["notes"][number] => ({
    g: i * 20,
    id: `n${i}`,
    title: `Note ${i}`,
    where: `Somewhere ${i}`,
    href: `/notes/n${i}`,
    lineHref: `/line/${i}`,
    type: "theme",
    typeLabel: "Theme",
    confidence: "interpretive",
    excerpt: `About ${i}.`,
    motifs: ["rose"],
    related,
  });
  return {
    total: g,
    quartets,
    movements,
    notes: [note(0, [1, 2]), note(1), note(2), note(3, [0, 1, 2, 0])],
    motifKinds: [
      { id: "rose", name: "Rose", color: "#b5475f", gloss: "A flower.", counts: [2, 1], href: "/motifs/rose", tracer: "/motifs?m=rose" },
      { id: "fire", name: "Fire", color: "#c8541e", gloss: "A flame.", counts: [0, 1], href: "/motifs/fire", tracer: "/motifs?m=fire" },
    ],
    motifs: [
      { g: 5, motif: "rose", lemma: "rose garden", where: "BN I", href: "/l/5" },
      { g: 30, motif: "fire", lemma: "fire", where: "BN II", href: "/l/30" },
      { g: 60, motif: "rose", lemma: "rose again", where: "BN III", href: "/l/60", note: { title: "The rose", href: "/notes/rose" } },
      { g: 130, motif: "rose", lemma: "last rose", where: "EC I", href: "/l/130" },
      { g: 140, motif: "fire", lemma: "flame", where: "EC II", href: "/l/140" },
    ],
    lineIds: [],
  };
}

const at = (layout: SpiralLayout, g: number) => layout.atTurn(layout.turnAt(g), 1, { x: 0, y: 0, z: 0 });
const angle = (v: { x: number; z: number }) => (((Math.atan2(v.z, v.x) + Math.PI / 2) / (Math.PI * 2)) % 1 + 1) % 1;

describe("SpiralLayout", () => {
  const data = fixture();
  const layout = new SpiralLayout(data);

  it("gives every movement the same fifth of a turn, whatever its length", () => {
    for (const [mi, m] of data.movements.entries()) {
      const a = layout.movementTurn(mi, 0) % 1;
      expect(a).toBeCloseTo(((m.n - 1) / PER_TURN) % 1, 10);
      expect(layout.movementTurn(mi, 1) - layout.movementTurn(mi, 0)).toBeCloseTo(1 / PER_TURN, 10);
    }
  });

  it("stacks the same movement of each quartet in one column", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const cols = data.movements.filter((m) => m.n === n).map((m) => angle(at(layout, m.start + Math.floor(m.count / 2))));
      // Mid-movement lines of movements with different lengths sit at the same angle.
      expect(Math.abs(cols[0]! - cols[1]!)).toBeLessThan(0.02);
    }
  });

  it("keeps every line inside its own movement's fifth", () => {
    data.movements.forEach((m, mi) => {
      for (const g of [m.start, m.start + m.count - 1]) {
        expect(layout.turnAt(g)).toBeGreaterThan(layout.movementTurn(mi, 0));
        expect(layout.turnAt(g)).toBeLessThan(layout.movementTurn(mi, 1));
      }
    });
  });

  it("rises monotonically from the first line to the last", () => {
    let last = -Infinity;
    for (let g = 0; g < data.total; g++) {
      const t = layout.turnAt(g);
      expect(t).toBeGreaterThan(last);
      last = t;
    }
    expect(layout.turnAt(data.total - 1)).toBeLessThan(data.quartets.length);
  });

  it("finds the movement that holds a line", () => {
    expect(layout.movementAt(0)).toBe(0);
    expect(layout.movementAt(9)).toBe(0);
    expect(layout.movementAt(10)).toBe(1);
    expect(layout.movementAt(data.total - 1)).toBe(data.movements.length - 1);
  });

  it("places points at the requested radius and pitch", () => {
    const p = layout.point(25, R, { x: 0, y: 0, z: 0 });
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(R, 10);
    const a = layout.atTurn(0, R, { x: 0, y: 0, z: 0 });
    const b = layout.atTurn(1, R, { x: 0, y: 0, z: 0 });
    expect(b.y - a.y).toBeCloseTo(PITCH, 10);
  });

  it("draws an arc and a thread with the right number of points", () => {
    expect(layout.arc(0, R, 12)).toHaveLength(13 * 3);
    expect(layout.thread(5, 60, R)).toHaveLength(56 * 3);
    expect(layout.thread(60, 5, R)).toHaveLength(56 * 3);
  });

  it("gives each motif its own lane, outside the notes", () => {
    expect(laneRadius(1)).toBeGreaterThan(laneRadius(0));
    expect(laneRadius(0)).toBeGreaterThan(R + 0.16);
  });
});

describe("cardFor", () => {
  const data = fixture();

  it("describes a note with its neighbours and at most three related notes", () => {
    const c = cardFor(data, { kind: "note", i: 3 })!;
    expect(c.title).toBe("Note 3");
    expect(c.eyebrow).toBe("Theme · interpretive");
    expect(c.body).toBe("About 3.");
    expect(c.related).toHaveLength(3);
    expect(c.step).toMatchObject({ prev: { kind: "note", i: 2 }, next: null, label: "Note 4 of 4" });
    expect(c.links.map((l) => l.href)).toEqual(["/notes/n3", "/line/3"]);
  });

  it("steps along the occurrences of one motif only", () => {
    expect(occurrencesOf(data, "rose")).toEqual([0, 2, 3]);
    const c = cardFor(data, { kind: "motif", i: 2 })!;
    expect(c.quoted).toBe(true);
    expect(c.title).toBe("rose again");
    expect(c.step).toMatchObject({ prev: { kind: "motif", i: 0 }, next: { kind: "motif", i: 3 }, label: "Rose · 2 of 3" });
    expect(c.links.map((l) => l.label)).toEqual(["Read the line", "Open the note"]);
  });

  it("returns from a motif's first occurrence to its summary", () => {
    expect(cardFor(data, { kind: "motif", i: 0 })!.step!.prev).toEqual({ kind: "thread", i: 0 });
    expect(cardFor(data, { kind: "motif", i: 1 })!.step!.prev).toEqual({ kind: "thread", i: 1 });
  });

  it("offers to follow a motif unless it is already followed", () => {
    expect(cardFor(data, { kind: "motif", i: 0 }, -1)!.chips).toHaveLength(1);
    expect(cardFor(data, { kind: "motif", i: 0 }, 0)!.chips).toHaveLength(0);
  });

  it("summarises a motif thread with per-quartet counts", () => {
    const c = cardFor(data, { kind: "thread", i: 0 })!;
    expect(c.title).toBe("Rose");
    expect(c.where).toBe("3 occurrences");
    expect(c.meters).toEqual([
      { label: "Burnt Norton", value: 2, max: 2 },
      { label: "East Coker", value: 1, max: 2 },
    ]);
    expect(c.step).toMatchObject({ prev: null, next: { kind: "motif", i: 0 } });
  });

  it("describes a movement and links its comparison", () => {
    const c = cardFor(data, { kind: "movement", i: 6 })!;
    expect(c.title).toBe("East Coker II");
    expect(c.where).toBe("30 lines · 2 notes");
    expect(c.links[1]).toEqual({ label: "Compare II across the quartets", href: "/compare/2" });
    expect(c.step!.prev).toEqual({ kind: "movement", i: 5 });
  });

  it("returns null for a selection that does not exist", () => {
    expect(cardFor(data, { kind: "note", i: 99 })).toBeNull();
    expect(cardFor(data, { kind: "thread", i: 99 })).toBeNull();
  });
});
