/**
 * Geometry and data shapes of the Time Spiral, free of three.js so they can be tested.
 *
 * The helix has one turn per quartet, and every turn is cut into fifths: movement I of
 * each quartet occupies the same 72° of arc, then II, and so on. The five movements
 * therefore line up in columns down the spiral. Inside its fifth a movement spreads its
 * lines evenly, so a long movement is a dense arc and a short one a sparse arc.
 */

export const R = 3.2;
export const PITCH = 1.7;
export const PER_TURN = 5;
/** Lights sit just outside the path: notes first, then one lane per motif. */
export const NOTE_RADIUS = R + 0.16;
const LANE_START = R + 0.32;
const LANE_STEP = 0.055;

export interface SpiralQuartet {
  code: string;
  title: string;
  element: string;
  year: number;
  start: number;
  count: number;
}

export interface SpiralMovement {
  quartet: string;
  n: number;
  roman: string;
  start: number;
  count: number;
  href: string;
  compare: string;
  notes: number;
  motifs: string[];
}

export interface SpiralNote {
  g: number;
  id: string;
  title: string;
  where: string;
  href: string;
  /** The passage the note is about, in the text. */
  lineHref: string;
  type: string;
  typeLabel: string;
  confidence: "established" | "interpretive";
  excerpt: string;
  motifs: string[];
  /** Indices into `notes`. */
  related: number[];
}

export interface SpiralMotifKind {
  id: string;
  name: string;
  color: string;
  gloss: string;
  /** Occurrences per quartet, in quartet order. */
  counts: number[];
  href: string;
  tracer: string;
}

export interface SpiralOccurrence {
  g: number;
  motif: string;
  lemma: string;
  where: string;
  href: string;
  note?: { title: string; href: string };
}

export interface SpiralData {
  total: number;
  quartets: SpiralQuartet[];
  movements: SpiralMovement[];
  notes: SpiralNote[];
  motifKinds: SpiralMotifKind[];
  motifs: SpiralOccurrence[];
  lineIds: string[];
}

export const EMPTY_SPIRAL: SpiralData = { total: 0, quartets: [], movements: [], notes: [], motifKinds: [], motifs: [], lineIds: [] };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Radius of a motif's lane: each motif has its own ring outside the notes. */
export const laneRadius = (kind: number) => LANE_START + Math.max(0, kind) * LANE_STEP;

export class SpiralLayout {
  private readonly qi: number[];

  constructor(private readonly data: Pick<SpiralData, "quartets" | "movements">) {
    this.qi = data.movements.map((m) => Math.max(0, data.quartets.findIndex((q) => q.code === m.quartet)));
  }

  /** Index of the movement holding global line g (binary search; movements are in reading order). */
  movementAt(g: number): number {
    const ms = this.data.movements;
    let lo = 0;
    let hi = ms.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ms[mid]!.start <= g) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Position along the helix in turns (0 = the start of Burnt Norton). */
  turnAt(g: number): number {
    const mi = this.movementAt(g);
    const m = this.data.movements[mi];
    if (!m) return 0;
    const u = (g - m.start + 0.5) / Math.max(1, m.count);
    return this.qi[mi]! + (m.n - 1 + Math.min(1, Math.max(0, u))) / PER_TURN;
  }

  /** Turn at which movement `mi` begins (t = 0) or ends (t = 1). */
  movementTurn(mi: number, t: number): number {
    const m = this.data.movements[mi];
    return m ? this.qi[mi]! + (m.n - 1 + t) / PER_TURN : 0;
  }

  atTurn<T extends Vec3>(turn: number, radius: number, out: T): T {
    const a = turn * Math.PI * 2 - Math.PI / 2;
    out.x = Math.cos(a) * radius;
    out.y = this.heightAt(turn);
    out.z = Math.sin(a) * radius;
    return out;
  }

  heightAt(turn: number): number {
    return turn * PITCH - (this.data.quartets.length * PITCH) / 2;
  }

  /** Position of global line g at the given radius from the axis. */
  point<T extends Vec3>(g: number, radius: number, out: T): T {
    return this.atTurn(this.turnAt(g), radius, out);
  }

  /** Flat xyz positions along movement `mi` (its whole fifth of the turn), for drawing an arc. */
  arc(mi: number, radius: number, steps = 24): Float32Array {
    const out = new Float32Array((steps + 1) * 3);
    const v: Vec3 = { x: 0, y: 0, z: 0 };
    for (let i = 0; i <= steps; i++) {
      this.atTurn(this.movementTurn(mi, i / steps), radius, v);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
    return out;
  }

  /** Flat xyz positions of every line from g0 to g1 inclusive: a thread that climbs the helix. */
  thread(g0: number, g1: number, radius: number): Float32Array {
    const from = Math.min(g0, g1);
    const to = Math.max(g0, g1);
    const out = new Float32Array((to - from + 1) * 3);
    const v: Vec3 = { x: 0, y: 0, z: 0 };
    for (let g = from; g <= to; g++) {
      this.point(g, radius, v);
      const k = (g - from) * 3;
      out[k] = v.x;
      out[k + 1] = v.y;
      out[k + 2] = v.z;
    }
    return out;
  }

  /** Vertical extent of the helix, for the axis and the column rails. */
  get halfHeight(): number {
    return (this.data.quartets.length * PITCH) / 2;
  }
}
