/**
 * Hand-sketched place cards, drawn in code with rough.js at build time (its generator
 * needs no DOM), so the illustrations ship as plain inline SVG — no client JavaScript.
 * Seeded, so each drawing is stable. Each composition realises the place's
 * `illustrationPrompt` from a small vocabulary of primitives. No photographs.
 */
import rough from "roughjs";

type Gen = ReturnType<typeof rough.generator>;
type Drawable = ReturnType<Gen["rectangle"]>;
export type Tone = "ink" | "wash" | "accent" | "none";
export interface SketchPath {
  d: string;
  stroke: Tone;
  fill: Tone;
  width: number;
}
interface Ink {
  ink: string;
  wash: string;
  accent: string;
  seed: number;
}

const W = 320;
const H = 200;
const GROUND = 158;
export const SKETCH_VIEWBOX = `0 0 ${W} ${H}`;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Tone tokens stand in for colours; the page maps them to theme variables. */
export function sketchPaths(key: string): SketchPath[] {
  const gen = rough.generator();
  const k: Ink = { ink: "ink", wash: "wash", accent: "accent", seed: (hash(key) % 1000) + 1 };
  const out: SketchPath[] = [];
  const o = (extra: Record<string, unknown> = {}) => ({ stroke: k.ink, strokeWidth: 1.1, roughness: 1.3, bowing: 1, seed: k.seed, ...extra });
  const fill = (color: string, gap = 5, extra: Record<string, unknown> = {}) =>
    o({ fill: color, fillStyle: "hachure", hachureGap: gap, hachureAngle: -41, fillWeight: 0.7, ...extra });
  const add = (d: Drawable) => {
    for (const p of gen.toPaths(d)) {
      out.push({ d: p.d, stroke: (p.stroke as Tone) ?? "none", fill: ((p.fill as Tone) || "none") as Tone, width: p.strokeWidth });
    }
  };
  const P = new Primitives(gen, add, o, fill, k);
  (COMPOSITIONS[key] ?? COMPOSITIONS.default!)(P);
  return out;
}

class Primitives {
  constructor(
    readonly rc: Gen,
    readonly add: (d: Drawable) => void,
    readonly o: (e?: Record<string, unknown>) => Record<string, unknown>,
    readonly fill: (c: string, gap?: number, e?: Record<string, unknown>) => Record<string, unknown>,
    readonly k: Ink,
  ) {}
  ground(y = GROUND) {
    this.add(this.rc.line(8, y, W - 8, y, this.o({ roughness: 1.6 })));
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 34 + ((this.k.seed * (i + 3)) % 11);
      this.add(this.rc.line(x, y + 6, x + 10, y + 5, this.o({ strokeWidth: 0.7 })));
    }
  }
  house(x: number, w: number, h: number, roof = 0.45, windows = 3) {
    const top = GROUND - h;
    this.add(this.rc.rectangle(x, top, w, h, this.fill(this.k.wash, 7)));
    this.add(this.rc.polygon([[x - 5, top], [x + w / 2, top - h * roof], [x + w + 5, top]], this.fill(this.k.accent, 4)));
    for (let i = 0; i < windows; i++) {
      const wx = x + ((i + 0.5) * w) / windows - 5;
      this.add(this.rc.rectangle(wx, top + h * 0.3, 10, 13, this.o({ strokeWidth: 0.8 })));
    }
  }
  tower(x: number, w: number, h: number, top: "crenel" | "spire" | "round" | "cote" = "crenel") {
    const y = GROUND - h;
    if (top === "round") {
      this.add(this.rc.rectangle(x, y, w, h, this.fill(this.k.wash, 6)));
      this.add(this.rc.ellipse(x + w / 2, y, w, w * 0.35, this.o()));
      return;
    }
    this.add(this.rc.rectangle(x, y, w, h, this.fill(this.k.wash, 6)));
    if (top === "crenel") {
      for (let i = 0; i < 4; i++) this.add(this.rc.rectangle(x + i * (w / 4) + 1, y - 7, w / 8, 7, this.o({ strokeWidth: 0.9 })));
    } else if (top === "spire") {
      this.add(this.rc.polygon([[x - 2, y], [x + w / 2, y - h * 0.9], [x + w + 2, y]], this.fill(this.k.accent, 4)));
    } else {
      this.add(this.rc.rectangle(x + w / 2 - 6, y - 16, 12, 16, this.o()));
      this.add(this.rc.arc(x + w / 2, y - 6, 8, 10, Math.PI, Math.PI * 2, false, this.o({ strokeWidth: 0.8 })));
    }
    this.add(this.rc.rectangle(x + w / 2 - 4, y + h * 0.25, 8, 12, this.o({ strokeWidth: 0.8 })));
  }
  tree(x: number, h = 60, r = 26) {
    this.add(this.rc.line(x, GROUND, x, GROUND - h + r, this.o({ strokeWidth: 1.4 })));
    this.add(this.rc.circle(x, GROUND - h, r * 2, this.fill(this.k.accent, 6, { hachureAngle: 60 })));
  }
  hedge(x: number, w: number, h = 14) {
    this.add(this.rc.rectangle(x, GROUND - h, w, h, this.fill(this.k.accent, 3, { hachureAngle: 20 })));
  }
  waves(y: number, n = 4, amp = 3) {
    for (let r = 0; r < n; r++) {
      const yy = y + r * 11;
      const pts: Array<[number, number]> = [];
      for (let x = 10; x <= W - 10; x += 18) pts.push([x, yy + Math.sin(x * 0.08 + r) * amp]);
      this.add(this.rc.curve(pts, this.o({ strokeWidth: 0.8, roughness: 0.9 })));
    }
  }
  rocks(x: number, y: number) {
    this.add(this.rc.polygon([[x, y], [x + 30, y - 22], [x + 60, y - 14], [x + 88, y - 30], [x + 120, y]], this.fill(this.k.wash, 4)));
    this.add(this.rc.polygon([[x + 128, y], [x + 146, y - 12], [x + 170, y]], this.fill(this.k.wash, 4)));
  }
  sun(x: number, y: number, r = 16) {
    this.add(this.rc.circle(x, y, r * 2, this.o({ strokeWidth: 0.8 })));
  }
  cloud(x: number, y: number) {
    for (const [dx, dy, r] of [[0, 0, 26], [22, -8, 30], [46, 0, 24], [24, 8, 26]] as const)
      this.add(this.rc.circle(x + dx, y + dy, r, this.o({ strokeWidth: 0.9 })));
  }
  columns(x: number, n: number, h: number, broken = true) {
    for (let i = 0; i < n; i++) {
      const cx = x + i * 30;
      const hh = broken && i === n - 1 ? h * 0.6 : h;
      this.add(this.rc.rectangle(cx, GROUND - hh, 12, hh, this.fill(this.k.wash, 5, { hachureAngle: 90 })));
      this.add(this.rc.rectangle(cx - 3, GROUND - hh - 5, 18, 5, this.o({ strokeWidth: 0.9 })));
    }
    this.add(this.rc.rectangle(x - 4, GROUND - h - 14, (n - 1) * 30 - 10, 9, this.fill(this.k.accent, 4)));
  }
  dome(x: number, w: number, h: number) {
    const y = GROUND - h;
    this.add(this.rc.rectangle(x, y, w, h, this.fill(this.k.wash, 6)));
    this.add(this.rc.arc(x + w / 2, y, w, w * 1.1, Math.PI, Math.PI * 2, false, this.fill(this.k.accent, 4)));
    this.add(this.rc.line(x + w / 2, y - w * 0.55, x + w / 2, y - w * 0.55 - 12, this.o()));
  }
  wheel(x: number, y: number, r: number) {
    this.add(this.rc.circle(x, y, r * 2, this.o({ strokeWidth: 1.4 })));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.add(this.rc.line(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, this.o({ strokeWidth: 0.8 })));
    }
  }
  book(x: number, y: number) {
    this.add(this.rc.polygon([[x, y], [x + 70, y - 12], [x + 70, y + 40], [x, y + 52]], this.fill(this.k.wash, 7)));
    this.add(this.rc.polygon([[x + 70, y - 12], [x + 140, y], [x + 140, y + 52], [x + 70, y + 40]], this.fill(this.k.wash, 7, { hachureAngle: 41 })));
    for (let i = 0; i < 5; i++) {
      this.add(this.rc.line(x + 10, y + 4 + i * 8, x + 60, y - 6 + i * 8, this.o({ strokeWidth: 0.6 })));
      this.add(this.rc.line(x + 80, y - 6 + i * 8, x + 130, y + 4 + i * 8, this.o({ strokeWidth: 0.6 })));
    }
  }
}

const COMPOSITIONS: Record<string, (p: Primitives) => void> = {
  "manor-garden": (p) => {
    p.ground();
    p.house(28, 110, 58, 0.4, 4);
    p.tree(172, 70, 22);
    p.hedge(150, 150, 12);
    p.add(p.rc.ellipse(236, 176, 110, 20, p.o({ strokeWidth: 0.9 })));
    p.add(p.rc.rectangle(200, 168, 72, 14, p.fill(p.k.wash, 4)));
    for (const [dx, dy] of [[0, 0], [6, -5], [-5, -4], [2, 5]] as const) p.add(p.rc.circle(290 + dx, 150 + dy, 9, p.fill(p.k.accent, 2)));
  },
  "village-church": (p) => {
    p.ground();
    p.tower(120, 34, 92, "crenel");
    p.house(154, 90, 44, 0.35, 2);
    p.add(p.rc.curve([[10, 196], [70, 176], [110, GROUND]], p.o()));
    p.add(p.rc.curve([[60, 198], [100, 178], [124, GROUND]], p.o()));
    p.hedge(8, 60, 18);
    p.tree(280, 58, 20);
  },
  "rocks-beacon": (p) => {
    p.waves(150, 4);
    p.rocks(60, 150);
    p.add(p.rc.line(118, 120, 118, 78, p.o({ strokeWidth: 1.6 })));
    p.add(p.rc.polygon([[108, 80], [118, 62], [128, 80]], p.fill(p.k.accent, 3)));
    p.add(p.rc.polygon([[252, 150], [262, 112], [272, 150]], p.o({ strokeWidth: 1 })));
    p.add(p.rc.circle(262, 126, 9, p.fill(p.k.accent, 2)));
    p.add(p.rc.curve([[210, 58], [218, 52], [226, 58]], p.o({ strokeWidth: 0.9 })));
  },
  chapel: (p) => {
    p.ground();
    p.house(118, 100, 52, 0.35, 2);
    p.tower(158, 20, 64, "cote");
    p.add(p.rc.line(168, GROUND, 150, 196, p.o()));
    p.add(p.rc.line(178, GROUND, 196, 196, p.o()));
    p.tree(62, 76, 20);
    p.tree(272, 68, 18);
    p.sun(52, 48, 12);
  },
  "river-bridge": (p) => {
    p.waves(150, 4, 2);
    for (let i = 0; i < 3; i++) p.add(p.rc.arc(70 + i * 90, 132, 86, 60, Math.PI, Math.PI * 2, false, p.o({ strokeWidth: 1.3 })));
    p.add(p.rc.line(20, 102, 300, 102, p.o({ strokeWidth: 1.5 })));
    for (let i = 0; i < 4; i++) p.add(p.rc.rectangle(22 + i * 90, 102, 10, 48, p.fill(p.k.wash, 4)));
  },
  "shore-house": (p) => {
    p.rocks(20, 162);
    p.house(40, 80, 50, 0.5, 2);
    p.waves(166, 3);
    p.add(p.rc.polygon([[236, 150], [256, 92], [256, 150]], p.fill(p.k.wash, 5)));
    p.add(p.rc.line(226, 152, 270, 152, p.o({ strokeWidth: 1.4 })));
  },
  blitz: (p) => {
    for (let i = 0; i < 5; i++) p.house(12 + i * 62, 56, 60 + (i % 2) * 14, 0.3, 2);
    p.add(p.rc.line(90, 94, 40, 8, p.o({ strokeWidth: 0.7 })));
    p.add(p.rc.line(200, 90, 270, 6, p.o({ strokeWidth: 0.7 })));
    p.add(p.rc.ellipse(160, 88, 120, 24, p.fill(p.k.accent, 3, { stroke: "none" })));
  },
  columns: (p) => {
    p.ground();
    p.columns(70, 5, 96);
    p.add(p.rc.line(8, 120, 60, 120, p.o({ strokeWidth: 0.7 })));
    p.add(p.rc.line(230, 120, 312, 120, p.o({ strokeWidth: 0.7 })));
  },
  "hill-town": (p) => {
    p.add(p.rc.curve([[8, 170], [80, 120], [160, 104], [240, 120], [312, 170]], p.fill(p.k.wash, 6)));
    p.tower(128, 26, 60, "spire");
    p.tower(176, 22, 44, "crenel");
    p.house(84, 38, 22, 0.4, 1);
    p.add(p.rc.curve([[8, 188], [90, 178], [160, 192], [250, 176], [312, 186]], p.o()));
  },
  "round-tower": (p) => {
    p.ground();
    p.tower(96, 36, 90, "round");
    p.house(132, 110, 48, 0.3, 2);
    p.add(p.rc.rectangle(242, GROUND - 34, 34, 34, p.fill(p.k.wash, 5)));
    p.add(p.rc.rectangle(252, GROUND - 24, 12, 12, p.o({ strokeWidth: 0.9 })));
  },
  "cloud-fields": (p) => {
    p.cloud(118, 56);
    for (let i = 0; i < 6; i++) p.add(p.rc.line(10, 120 + i * 13, 310, 110 + i * 15, p.o({ strokeWidth: 0.7 })));
  },
  chariot: (p) => {
    p.ground();
    p.wheel(150, 118, 38);
    p.add(p.rc.line(230, GROUND, 230, 50, p.o({ strokeWidth: 1.3 })));
    p.add(p.rc.polygon([[230, 52], [290, 64], [230, 78]], p.fill(p.k.accent, 4)));
  },
  dome: (p) => {
    p.ground();
    p.dome(86, 110, 58);
    p.tower(222, 26, 118, "crenel");
    p.house(20, 60, 34, 0.3, 2);
  },
  rooftops: (p) => {
    p.ground(170);
    for (let i = 0; i < 4; i++) {
      const x = 14 + i * 78;
      p.add(p.rc.polygon([[x, 110], [x + 70, 110], [x + 64, 80], [x + 6, 80]], p.fill(p.k.accent, 4)));
      p.add(p.rc.rectangle(x, 110, 70, 60, p.fill(p.k.wash, 7)));
      p.add(p.rc.rectangle(x + 46, 62, 10, 18, p.o({ strokeWidth: 0.9 })));
    }
  },
  spire: (p) => {
    p.ground();
    p.tower(140, 34, 70, "spire");
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 20 + (i > 1 ? 180 : 0);
      p.add(p.rc.line(x, GROUND, x, GROUND - 40, p.o({ strokeWidth: 0.9 })));
      p.add(p.rc.rectangle(x - 9, GROUND - 52, 18, 12, p.o({ strokeWidth: 0.8 })));
    }
  },
  book: (p) => {
    p.add(p.rc.line(10, 160, 310, 160, p.o({ strokeWidth: 1.2 })));
    p.book(90, 86);
  },
  default: (p) => {
    p.ground();
    p.sun(160, 80, 20);
  },
};
