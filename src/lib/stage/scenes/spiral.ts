/**
 * The Time Spiral: the whole sequence as a helix — one turn per quartet, rising from
 * Burnt Norton (1936) to Little Gidding (1942). Every turn is cut into the same five
 * movements, so movement II of each quartet sits directly above the last. Every line is
 * a faint point; notes and motif occurrences are lights (each motif on a lane of its
 * own); the reader's last position glows. A still axis runs through the centre.
 *
 * Interactive: orbit/zoom (OrbitControls), hover a light for a preview, choose one for its
 * card, follow a motif as a thread up the helix. The page provides its data as JSON and
 * the DOM for labels, the tooltip and the card; geometry and card text live in lib/viz.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeTree, rgb, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, writeCommon } from "./base";
import { EMPTY_SPIRAL, NOTE_RADIUS, PER_TURN, R, SpiralLayout, laneRadius, type SpiralData } from "../../viz/spiral-layout";
import { cardFor, occurrencesOf, type Selection } from "../../viz/spiral-card";
import { renderCard } from "../../viz/spiral-card-dom";
import { SPIRAL_EVENT, type SpiralEventDetail } from "../../viz/spiral-events";

export type { SpiralData } from "../../viz/spiral-layout";

const ELEMENT_COLOR: Record<string, [number, number]> = {
  air: [0x34617c, 0xa9cde4],
  earth: [0x744a1d, 0xe0b57e],
  water: [0x1c6464, 0x8fd3cd],
  fire: [0x9a3a18, 0xf4a676],
};

/** Screen-space reach for choosing a light, by input device (CSS pixels). */
const REACH = { mouse: 14, pen: 20, touch: 30 } as const;
const HOME_CAMERA = new Vector3(0, 2.4, 13.5);

const BG = /* glsl */ `
uniform vec3 cPaper, cInk, cGlow;
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  vec3 col = mix(cPaper, cGlow, exp(-dot(p, p) * 5.0) * 0.18);
  col = mix(col, cInk, 0.1 * smoothstep(0.5, 1.2, length(p)));
  gl_FragColor = vec4(col, 1.0);
}
`;

const PT_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uScale, uTime, uHover;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = 1.0;
  gl_PointSize = aSize * uScale * (10.0 / max(1.0, -mv.z));
}
`;
const PT_FRAG = /* glsl */ `
uniform float uAlpha;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d);
  gl_FragColor = vec4(vColor, a * vAlpha * uAlpha);
}
`;
/** A thin ring, for the halo around the light being read or pointed at. */
const RING_FRAG = /* glsl */ `
uniform float uAlpha;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.44, d) * smoothstep(0.32, 0.4, d);
  gl_FragColor = vec4(vColor, a * vAlpha * uAlpha);
}
`;

const hex = (s: string) => parseInt(s.slice(1), 16);

class SpiralScene implements StageScene {
  readonly key = "spiral";
  readonly renderScale = 1;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.1, 200);
  private palette = new Palette({ cPaper: 0xf4eee1, cInk: 0x3a3226, cGlow: 0xfff1c9 }, { cPaper: 0x0b0d15, cInk: 0x020306, cGlow: 0x3a2e18 });
  private u = { ...commonUniforms() };
  private data: SpiralData = EMPTY_SPIRAL;
  private layout!: SpiralLayout;
  private controls!: OrbitControls;
  private lines!: Points;
  private noteLights!: Points;
  private motifLights!: Points;
  private here: Points | null = null;
  private ticks!: Points;
  private pathLine!: Line;
  private axis!: Line;
  private rails!: LineSegments;
  /** The selected movement's arc (bright) and the same movement in the other quartets (softer). */
  private arcs!: Points;
  /** Ring around the light being read, and around the one under the pointer. */
  private halo!: Points;
  private hoverHalo!: Points;
  /** The followed motif: a thread up the helix, its beads, and its occurrences drawn large. */
  private thread!: Line;
  private beads!: Points;
  private focusLights!: Points;
  private mats: ShaderMaterial[] = [];
  private night = false;
  private readonly tmp = new Vector3();
  private readonly tmp2 = new Vector3();
  private readonly flyTarget = new Vector3();
  private readonly flyCam = new Vector3();
  private flying = 0;
  private labels: HTMLElement[] = [];
  private labelPos: Vector3[] = [];
  private mvLabels: HTMLElement[] = [];
  private mvLabelPos: Vector3[] = [];
  private card: HTMLElement | null = null;
  private tip: HTMLElement | null = null;
  private canvas!: HTMLCanvasElement;
  private width = 1;
  private height = 1;
  private layers = { notes: true, motifs: true };
  private notePos = new Float32Array(0);
  private motifPos = new Float32Array(0);
  /** Kind index (into data.motifKinds) of every occurrence. */
  private occKind: number[] = [];
  private focus = -1;
  private dim = 0;
  private sel: Selection | null = null;
  private selMovement = -1;

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    const el = document.querySelector<HTMLScriptElement>("[data-spiral-data]");
    this.data = el ? (JSON.parse(el.textContent ?? "{}") as SpiralData) : EMPTY_SPIRAL;
    this.night = env.night;
    this.canvas = env.renderer.domElement;
    this.scene.add(backgroundMesh(BG, { ...this.u, ...this.palette.uniforms }));

    const d = this.data;
    const layout = (this.layout = new SpiralLayout(d));
    // Layers as the page shows them (the reader may have switched one before the scene loaded).
    for (const key of ["notes", "motifs"] as const) {
      const box = document.querySelector<HTMLInputElement>(`[data-layer="${key}"]`);
      if (box) this.layers[key] = box.checked;
    }
    const kinds = new Map(d.motifKinds.map((k, i) => [k.id, i]));
    this.occKind = d.motifs.map((o) => kinds.get(o.motif) ?? -1);

    // Every line: a faint point, tinted by its quartet's element.
    const pos = new Float32Array(d.total * 3);
    const size = new Float32Array(d.total).fill(1);
    for (let g = 0; g < d.total; g++) {
      layout.point(g, R, this.tmp);
      pos.set([this.tmp.x, this.tmp.y, this.tmp.z], g * 3);
    }
    this.lines = this.points(pos, new Float32Array(d.total * 3), size, 0.55);
    this.colourLines();

    // The path itself.
    const pathGeo = new BufferGeometry().setAttribute("position", new BufferAttribute(pos.slice(), 3));
    this.pathLine = new Line(pathGeo, new LineBasicMaterial({ transparent: true, opacity: 0.18 }));
    this.scene.add(this.pathLine);

    // Movement boundaries: five rails down the cylinder and a small point where the path crosses each.
    const half = layout.halfHeight;
    const rail: number[] = [];
    for (let k = 0; k < PER_TURN; k++) {
      const turn = k / PER_TURN;
      layout.atTurn(turn, R, this.tmp);
      const x = this.tmp.x;
      const z = this.tmp.z;
      rail.push(x, -half, z, x, half, z);
    }
    this.rails = new LineSegments(
      new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(rail), 3)),
      new LineBasicMaterial({ transparent: true, opacity: 0.13 }),
    );
    this.scene.add(this.rails);
    const boundaries: number[] = [];
    d.movements.forEach((_m, mi) => {
      layout.atTurn(layout.movementTurn(mi, 0), R, this.tmp);
      boundaries.push(this.tmp.x, this.tmp.y, this.tmp.z);
    });
    layout.atTurn(d.quartets.length, R, this.tmp);
    boundaries.push(this.tmp.x, this.tmp.y, this.tmp.z);
    this.ticks = this.points(new Float32Array(boundaries), new Float32Array(boundaries.length), new Float32Array(boundaries.length / 3).fill(2), 0.9);
    this.colourLines();

    // Notes: gold lights just outside the path.
    this.notePos = new Float32Array(d.notes.length * 3);
    const ns = new Float32Array(d.notes.length).fill(3.2);
    d.notes.forEach((n, i) => {
      layout.point(n.g, NOTE_RADIUS, this.tmp);
      this.notePos.set([this.tmp.x, this.tmp.y, this.tmp.z], i * 3);
    });
    this.noteLights = this.points(this.notePos, new Float32Array(d.notes.length * 3), ns, 1);

    // Motifs: coloured lights, each motif on a lane of its own outside the notes.
    this.motifPos = new Float32Array(d.motifs.length * 3);
    const mc = new Float32Array(d.motifs.length * 3);
    const ms = new Float32Array(d.motifs.length).fill(2.6);
    d.motifs.forEach((m, i) => {
      layout.point(m.g, laneRadius(this.occKind[i]!), this.tmp);
      this.motifPos.set([this.tmp.x, this.tmp.y, this.tmp.z], i * 3);
      mc.set(rgb(hex(d.motifKinds[this.occKind[i]!]?.color ?? "#888888")), i * 3);
    });
    this.motifLights = this.points(this.motifPos, mc, ms, 1);
    this.noteLights.visible = this.layers.notes;
    this.motifLights.visible = this.layers.motifs;

    // Where the reader last was.
    try {
      const last = JSON.parse(localStorage.getItem("sp:last") ?? "null") as { line?: string } | null;
      const g = last?.line ? d.lineIds.indexOf(last.line) : -1;
      if (g >= 0) {
        layout.point(g, R, this.tmp);
        this.here = this.points(new Float32Array([this.tmp.x, this.tmp.y, this.tmp.z]), new Float32Array(3), new Float32Array([9]), 1);
        const hereLabel = document.querySelector<HTMLElement>("[data-spiral-here]");
        if (hereLabel) {
          hereLabel.hidden = false;
          this.labels.push(hereLabel);
          this.labelPos.push(this.tmp.clone());
        }
      }
    } catch {
      /* no position yet */
    }

    // The still axis through the centre.
    this.axis = new Line(
      new BufferGeometry().setFromPoints([new Vector3(0, -half - 0.8, 0), new Vector3(0, half + 0.8, 0)]),
      new LineBasicMaterial({ transparent: true, opacity: 0.35 }),
    );
    this.scene.add(this.axis);

    // The followed motif (empty until one is chosen) and the highlights, drawn above the rest.
    this.thread = new Line(new BufferGeometry(), new LineBasicMaterial({ transparent: true, opacity: 0 }));
    this.thread.visible = false;
    this.thread.frustumCulled = false;
    this.scene.add(this.thread);
    this.beads = this.points(new Float32Array(0), new Float32Array(0), new Float32Array(0), 0);
    this.focusLights = this.points(new Float32Array(0), new Float32Array(0), new Float32Array(0), 0);
    this.arcs = this.points(new Float32Array(0), new Float32Array(0), new Float32Array(0), 0.95);
    this.halo = this.points(new Float32Array(3), new Float32Array(3), new Float32Array([10]), 1, RING_FRAG);
    this.hoverHalo = this.points(new Float32Array(3), new Float32Array(3), new Float32Array([7]), 0.7, RING_FRAG);
    for (const p of [this.beads, this.focusLights, this.arcs, this.halo, this.hoverHalo]) {
      p.visible = false;
      p.frustumCulled = false;
    }
    this.colourLines();

    // Quartet labels at the start of each turn; movement numerals in the middle of each fifth.
    document.querySelectorAll<HTMLElement>("[data-spiral-label]").forEach((lab) => {
      const qi = Number(lab.dataset.spiralLabel);
      const q = d.quartets[qi];
      if (!q) return;
      this.labels.push(lab);
      // Lifted a little so a label clears the movement numeral that falls just below it in narrow views.
      const at = layout.point(q.start, R + 1.7, new Vector3());
      at.y += 0.55;
      this.labelPos.push(at);
    });
    document.querySelectorAll<HTMLElement>("[data-spiral-mv]").forEach((lab) => {
      const mi = Number(lab.dataset.spiralMv);
      if (!d.movements[mi]) return;
      layout.atTurn(layout.movementTurn(mi, 0.5), R + 1.2, this.tmp);
      this.mvLabels.push(lab);
      this.mvLabelPos.push(this.tmp.clone());
    });
    this.card = document.querySelector<HTMLElement>("[data-spiral-card]");
    this.card?.setAttribute("tabindex", "-1");
    this.card?.addEventListener("keydown", this.onCardKey);
    this.tip = document.querySelector<HTMLElement>("[data-spiral-tip]");

    this.camera.position.copy(HOME_CAMERA);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 26;
    this.controls.enablePan = false;
    this.controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.target.set(0, 0, 0);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("pointerdown", this.onDown);

    this.setNight(env.night);
    this.resize(env.width, env.height);

    // A shared link can ask for a motif to be followed (?motif=rose).
    const wanted = new URLSearchParams(location.search).get("motif");
    const kind = wanted ? kinds.get(wanted) : undefined;
    if (kind !== undefined) {
      this.setFocus(kind);
      this.select({ kind: "thread", i: kind }, false);
    }
  }

  private points(pos: Float32Array, col: Float32Array, size: Float32Array, alpha: number, frag = PT_FRAG): Points {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aColor", new BufferAttribute(col, 3));
    g.setAttribute("aSize", new BufferAttribute(size, 1));
    const m = new ShaderMaterial({
      vertexShader: PT_VERT,
      fragmentShader: frag,
      uniforms: { uScale: { value: 2 }, uTime: this.u.uTime, uHover: { value: 0 }, uAlpha: { value: alpha } },
      transparent: true,
      depthWrite: false,
    });
    this.mats.push(m);
    const p = new Points(g, m);
    this.scene.add(p);
    return p;
  }

  private fill(points: Points | null | undefined, hexColour: number) {
    const attr = points?.geometry.getAttribute("aColor") as BufferAttribute | undefined;
    if (!attr) return;
    const c = rgb(hexColour);
    for (let i = 0; i < attr.count; i++) attr.setXYZ(i, c[0], c[1], c[2]);
    attr.needsUpdate = true;
  }

  private colourLines() {
    const col = this.lines.geometry.getAttribute("aColor") as BufferAttribute;
    for (const q of this.data.quartets) {
      const [v, n] = ELEMENT_COLOR[q.element] ?? [0x888888, 0xcccccc];
      const c = rgb(this.night ? n : v);
      for (let g = q.start; g < q.start + q.count; g++) col.setXYZ(g, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
    this.fill(this.noteLights, this.night ? 0xdcb870 : 0x806119);
    this.fill(this.here, this.night ? 0xfff1c9 : 0x962a1f);
    this.fill(this.ticks, this.night ? 0xb59f6c : 0x806119);
    this.fill(this.halo, this.night ? 0xfff1c9 : 0x221d17);
    this.fill(this.hoverHalo, this.night ? 0xebe4d3 : 0x4a4136);
    this.fill(this.arcs, this.night ? 0xfff1c9 : 0x962a1f);
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 58 : 42;
    // Portrait: the control panel covers the lower screen, so lift the helix into the upper part.
    if (w / h < 0.9) this.camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    (this.u.uRes.value as Vector2).set(w, h);
    const s = Math.min(window.devicePixelRatio || 1, 2) * (w < 700 ? 1.4 : 2);
    for (const m of this.mats) m.uniforms.uScale!.value = s;
  }

  setNight(night: boolean) {
    this.night = night;
    this.palette.apply(night);
    this.u.uNight.value = night ? 1 : 0;
    for (const m of this.mats) {
      m.blending = night ? AdditiveBlending : NormalBlending;
      m.needsUpdate = true;
    }
    if (this.lines) this.colourLines();
    const ink = new Color().setRGB(...rgb(night ? 0x8a7a55 : 0x9c8454));
    for (const l of [this.pathLine, this.axis, this.rails]) (l?.material as LineBasicMaterial | undefined)?.color.copy(ink);
  }

  setTier(_tier: Tier) {
    /* few points: every tier draws them all */
  }

  update(t: number, dt: number, r: Reading) {
    writeCommon(this.u, t, r);
    if (this.flying > 0) {
      this.flying = Math.max(0, this.flying - dt);
      this.controls.target.x = damp(this.controls.target.x, this.flyTarget.x, dt, 0.35);
      this.controls.target.y = damp(this.controls.target.y, this.flyTarget.y, dt, 0.35);
      this.controls.target.z = damp(this.controls.target.z, this.flyTarget.z, dt, 0.35);
      this.camera.position.x = damp(this.camera.position.x, this.flyCam.x, dt, 0.45);
      this.camera.position.y = damp(this.camera.position.y, this.flyCam.y, dt, 0.45);
      this.camera.position.z = damp(this.camera.position.z, this.flyCam.z, dt, 0.45);
    }
    this.controls.update(dt);

    // Following a motif dims everything else and brings its thread forward.
    this.dim = damp(this.dim, this.focus >= 0 ? 1 : 0, dt, 0.3);
    const dim = this.dim;
    const alpha = (p: Points, v: number) => ((p.material as ShaderMaterial).uniforms.uAlpha!.value = v);
    alpha(this.lines, 0.55 * (1 - 0.45 * dim));
    alpha(this.noteLights, 1 - 0.75 * dim);
    alpha(this.motifLights, 1 - 0.92 * dim);
    const followed = this.focus >= 0 && this.layers.motifs;
    const shown = followed || dim > 0.02;
    this.thread.visible = shown && this.thread.geometry.attributes.position !== undefined;
    (this.thread.material as LineBasicMaterial).opacity = 0.6 * dim;
    this.beads.visible = this.focusLights.visible = this.thread.visible;
    alpha(this.beads, 0.85 * dim);
    alpha(this.focusLights, dim);

    // A slow breath on the "you are here" light (period ≈ 5 s).
    if (this.here) alpha(this.here, 0.75 + 0.25 * Math.sin(t * 1.25));
    if (this.halo.visible) alpha(this.halo, 0.8 + 0.2 * Math.sin(t * 2.4));

    // Labels follow their anchors.
    this.project(this.labels, this.labelPos, false);
    this.project(this.mvLabels, this.mvLabelPos, true);
  }

  private project(labels: HTMLElement[], anchors: Vector3[], numerals: boolean) {
    // Movement numerals are text, so they are either fully there or gone (a dimmed label cannot keep
    // its contrast): shown on the near half of the helix, hidden on the far half and when the view
    // has pulled far back, with only a narrow band between.
    const toCam = this.tmp2.set(this.camera.position.x - this.controls.target.x, 0, this.camera.position.z - this.controls.target.z).normalize();
    const near = numerals ? Math.min(1, Math.max(0, (24 - this.camera.position.distanceTo(this.controls.target)) / 2)) : 1;
    for (let i = 0; i < labels.length; i++) {
      const a = anchors[i]!;
      let visible = 1;
      if (numerals) {
        const len = Math.hypot(a.x, a.z) || 1;
        const facing = (a.x / len) * toCam.x + (a.z / len) * toCam.z;
        visible = near * Math.min(1, Math.max(0, (facing + 0.25) / 0.2));
      }
      this.tmp.copy(a).project(this.camera);
      const lab = labels[i]!;
      lab.style.transform = `translate(${((this.tmp.x + 1) / 2) * this.width}px, ${((1 - this.tmp.y) / 2) * this.height}px)`;
      lab.style.opacity = this.tmp.z > 1 ? "0" : String(visible);
    }
  }

  // ------------------------------------------------------------------ cues

  cue(name: string, on: boolean) {
    if (name === "notes" || name === "motifs") {
      this.layers[name] = on;
      (name === "notes" ? this.noteLights : this.motifLights).visible = on;
      if (!on && name === "motifs" && this.focus >= 0) this.setFocus(-1);
      const kind = this.sel?.kind;
      if (!on && this.sel && (name === "notes" ? kind === "note" : kind === "motif" || kind === "thread")) this.select(null);
      this.announce();
    } else if (name === "zoom-in" && on) this.dolly(0.8);
    else if (name === "zoom-out" && on) this.dolly(1.25);
    else if (name === "reset" && on) {
      this.setFocus(-1);
      this.select(null);
      this.flyTo(null);
    } else if (name.startsWith("fly:") && on) {
      this.select({ kind: "movement", i: Number(name.slice(4)) });
    } else if (name.startsWith("motif:")) {
      const k = this.data.motifKinds.findIndex((m) => m.id === name.slice(6));
      if (k < 0) return;
      if (on) this.follow(k);
      else this.unfollow();
    } else if (name === "browse" && on) {
      if (!this.layers.notes) this.cue("notes", true);
      // Notes are dimmed while a motif is followed: leave the thread to read them.
      if (this.focus >= 0) this.setFocus(-1);
      this.select({ kind: "note", i: this.sel?.kind === "note" ? this.sel.i : 0 });
      this.card?.querySelector<HTMLElement>('[data-step="next"]')?.focus({ preventScroll: true });
    }
  }

  private announce() {
    const detail: SpiralEventDetail = { motif: this.data.motifKinds[this.focus]?.id ?? null, layers: { ...this.layers } };
    document.dispatchEvent(new CustomEvent<SpiralEventDetail>(SPIRAL_EVENT, { detail }));
  }

  // ------------------------------------------------------------------ following a motif

  private setFocus(kind: number) {
    if (kind >= 0 && !this.layers.motifs) {
      this.layers.motifs = true;
      this.motifLights.visible = true;
    }
    const changed = kind !== this.focus;
    this.focus = kind;
    if (changed && kind >= 0) this.buildThread(kind);
    this.announce();
  }

  /** Follow a motif: dim the rest, draw its thread, show its summary and frame the whole spiral. */
  private follow(kind: number) {
    this.setFocus(kind);
    this.select({ kind: "thread", i: kind }, false);
    this.controls.autoRotate = false;
    this.flyTo(null);
  }

  private unfollow() {
    this.setFocus(-1);
    if (this.sel?.kind === "thread") this.select(null);
    else if (this.sel) this.render();
  }

  private buildThread(kind: number) {
    const info = this.data.motifKinds[kind];
    const occ = occurrencesOf(this.data, info?.id ?? "");
    if (!info || !occ.length) return;
    const first = this.data.motifs[occ[0]!]!.g;
    const last = this.data.motifs[occ[occ.length - 1]!]!.g;
    const path = this.layout.thread(first, last, laneRadius(kind));
    const colour = rgb(hex(info.color));
    const line = this.thread;
    line.geometry.dispose();
    line.geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(path, 3));
    (line.material as LineBasicMaterial).color.setRGB(colour[0], colour[1], colour[2]);

    const set = (p: Points, positions: Float32Array, size: number) => {
      const n = positions.length / 3;
      const cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) cols.set(colour, i * 3);
      p.geometry.dispose();
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(positions, 3));
      g.setAttribute("aColor", new BufferAttribute(cols, 3));
      g.setAttribute("aSize", new BufferAttribute(new Float32Array(n).fill(size), 1));
      p.geometry = g;
    };
    set(this.beads, path, 1.3);
    const big = new Float32Array(occ.length * 3);
    occ.forEach((o, i) => big.set(this.motifPos.subarray(o * 3, o * 3 + 3), i * 3));
    set(this.focusLights, big, 4.8);
  }

  // ------------------------------------------------------------------ selection and the card

  private lightPosition(sel: Selection): Float32Array | null {
    if (sel.kind === "note") return this.notePos.subarray(sel.i * 3, sel.i * 3 + 3);
    if (sel.kind === "motif") return this.motifPos.subarray(sel.i * 3, sel.i * 3 + 3);
    return null;
  }

  private lineOf(sel: Selection): number | null {
    const d = this.data;
    if (sel.kind === "note") return d.notes[sel.i]?.g ?? null;
    if (sel.kind === "motif") return d.motifs[sel.i]?.g ?? null;
    if (sel.kind === "movement") {
      const m = d.movements[sel.i];
      return m ? m.start + m.count / 2 : null;
    }
    return null;
  }

  private select(sel: Selection | null, fly = true) {
    // A motif's summary is only shown while that motif is followed.
    if (sel?.kind === "thread" && sel.i !== this.focus) this.setFocus(sel.i);
    this.sel = sel;
    document.body.classList.toggle("spiral-card-open", sel !== null);
    this.selMovement = sel?.kind === "movement" ? sel.i : -1;
    this.highlightMovement();
    if (!sel) {
      if (this.card) {
        this.card.hidden = true;
        this.card.replaceChildren();
      }
      this.halo.visible = false;
      document.querySelectorAll("[data-fly]").forEach((x) => x.removeAttribute("aria-pressed"));
      return;
    }
    this.controls.autoRotate = false;
    const at = this.lightPosition(sel);
    this.halo.visible = at !== null;
    if (at) {
      (this.halo.geometry.getAttribute("position") as BufferAttribute).set(at);
      (this.halo.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    }
    // Keep the movement list's pressed state in step with the card.
    document.querySelectorAll<HTMLElement>("[data-fly]").forEach((x) => {
      if (sel.kind === "movement" && Number(x.dataset.fly) === sel.i) x.setAttribute("aria-pressed", "true");
      else x.removeAttribute("aria-pressed");
    });
    const g = this.lineOf(sel);
    if (fly && g !== null) this.flyTo(g);
    this.render();
    // On phones the card takes the panel's place: keep keyboard focus from falling into the hidden panel.
    const panel = document.querySelector<HTMLElement>(".spiral__panel");
    if (panel?.contains(document.activeElement) && getComputedStyle(panel).display === "none") this.card?.focus({ preventScroll: true });
  }

  private render() {
    if (!this.sel || !this.card) return;
    const model = cardFor(this.data, this.sel, this.focus);
    if (!model) return;
    renderCard(this.card, model, this.sel, {
      select: (s) => this.select(s),
      follow: (k) => this.follow(k),
      close: () => this.close(),
      unfollow: () => this.unfollow(),
    });
  }

  private close() {
    const hadFocus = this.card?.contains(document.activeElement) ?? false;
    this.select(null);
    if (hadFocus) document.querySelector<HTMLElement>('[data-cue="browse"]')?.focus({ preventScroll: true });
  }

  private onCardKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = (dir: "prev" | "next") => {
      const b = this.card?.querySelector<HTMLButtonElement>(`[data-step="${dir}"]`);
      if (b && !b.disabled) {
        e.preventDefault();
        b.click();
      }
    };
    if (e.key === "ArrowRight" || e.key === "ArrowDown") step("next");
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step("prev");
    else if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
  };

  /** Draw the selected movement's arc brightly and the same movement in every quartet softly. */
  private highlightMovement() {
    const d = this.data;
    const mi = this.selMovement;
    if (mi < 0 || !d.movements[mi]) {
      this.arcs.visible = false;
      this.mvLabels.forEach((l) => l.classList.remove("is-on", "is-column"));
      return;
    }
    const n = d.movements[mi]!.n;
    const pos: number[] = [];
    const size: number[] = [];
    d.movements.forEach((m, i) => {
      if (m.n !== n) return;
      const arc = this.layout.arc(i, R + 0.02, 48);
      for (let k = 0; k < arc.length; k += 3) {
        pos.push(arc[k]!, arc[k + 1]!, arc[k + 2]!);
        size.push(i === mi ? 2.6 : 1.5);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aColor", new BufferAttribute(new Float32Array(pos.length), 3));
    g.setAttribute("aSize", new BufferAttribute(new Float32Array(size), 1));
    this.arcs.geometry.dispose();
    this.arcs.geometry = g;
    this.fill(this.arcs, this.night ? 0xfff1c9 : 0x962a1f);
    this.arcs.visible = true;
    this.mvLabels.forEach((l) => {
      const i = Number(l.dataset.spiralMv);
      l.classList.toggle("is-on", i === mi);
      l.classList.toggle("is-column", i !== mi && d.movements[i]?.n === n);
    });
  }

  // ------------------------------------------------------------------ camera

  private dolly(k: number) {
    this.tmp.copy(this.camera.position).sub(this.controls.target).multiplyScalar(k);
    const len = this.tmp.length();
    if (len < this.controls.minDistance || len > this.controls.maxDistance) return;
    this.flyCam.copy(this.controls.target).add(this.tmp);
    this.flyTarget.copy(this.controls.target);
    this.flying = 1.4;
  }

  private flyTo(g: number | null) {
    this.controls.autoRotate = false;
    if (g === null) {
      this.flyTarget.set(0, 0, 0);
      this.flyCam.copy(HOME_CAMERA);
    } else {
      this.layout.point(Math.round(g), R, this.flyTarget);
      this.tmp.copy(this.flyTarget).setY(0).normalize().multiplyScalar(R + 5.5);
      this.flyCam.set(this.tmp.x, this.flyTarget.y + 1.2, this.tmp.z);
    }
    this.flying = 1.6;
  }

  // ------------------------------------------------------------------ pointing

  /**
   * The light nearest the pointer in screen space, within `reach` pixels. Measured on screen
   * (not in the world) so lights are as easy to hit zoomed out as in, and easier on touch.
   */
  private pick(clientX: number, clientY: number, reach: number): { kind: "note" | "motif"; i: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best: { kind: "note" | "motif"; i: number } | null = null;
    let bestD = reach * reach;
    const test = (kind: "note" | "motif", positions: Float32Array, allowed: (i: number) => boolean) => {
      for (let i = 0; i < positions.length / 3; i++) {
        if (!allowed(i)) continue;
        this.tmp.set(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!).project(this.camera);
        if (this.tmp.z > 1 || this.tmp.z < -1) continue;
        const dx = ((this.tmp.x + 1) / 2) * rect.width - px;
        const dy = ((1 - this.tmp.y) / 2) * rect.height - py;
        const dist = dx * dx + dy * dy;
        if (dist < bestD) {
          bestD = dist;
          best = { kind, i };
        }
      }
    };
    if (this.layers.motifs) test("motif", this.motifPos, (i) => this.focus < 0 || this.occKind[i] === this.focus);
    if (this.layers.notes) test("note", this.notePos, () => true);
    return best;
  }

  private downAt = { x: 0, y: 0 };
  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
    this.controls.autoRotate = false;
  };

  private onMove = (e: PointerEvent) => {
    // Touch has no hover: a tap opens the card instead.
    if (e.pointerType === "touch" || e.buttons) return;
    const h = this.pick(e.clientX, e.clientY, REACH[e.pointerType === "pen" ? "pen" : "mouse"]);
    this.canvas.style.cursor = h ? "pointer" : "grab";
    if (!h) return this.hideHover();
    const at = h.kind === "note" ? this.notePos.subarray(h.i * 3, h.i * 3 + 3) : this.motifPos.subarray(h.i * 3, h.i * 3 + 3);
    const attr = this.hoverHalo.geometry.getAttribute("position") as BufferAttribute;
    attr.set(at);
    attr.needsUpdate = true;
    this.hoverHalo.visible = true;
    if (!this.tip) return;
    const d = this.data;
    const label = document.createElement("span");
    const text = document.createElement("span");
    if (h.kind === "note") {
      const n = d.notes[h.i]!;
      label.textContent = n.typeLabel;
      text.textContent = n.title;
    } else {
      const o = d.motifs[h.i]!;
      label.textContent = d.motifKinds[this.occKind[h.i]!]?.name ?? "Motif";
      text.textContent = `‘${o.lemma}’`;
    }
    label.className = "spiral__tip-kind";
    this.tip.replaceChildren(label, text);
    this.tip.hidden = false;
    // Below and to the right of the pointer, kept inside the window.
    const w = this.tip.offsetWidth;
    const x = Math.min(e.clientX + 14, window.innerWidth - w - 8);
    const y = e.clientY + 18 + this.tip.offsetHeight > window.innerHeight ? e.clientY - this.tip.offsetHeight - 12 : e.clientY + 18;
    this.tip.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
  };

  private onLeave = () => this.hideHover();

  private hideHover() {
    this.hoverHalo.visible = false;
    if (this.tip) this.tip.hidden = true;
  }

  private onClick = (e: MouseEvent) => {
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return; // a drag, not a click
    const type = (e as PointerEvent).pointerType || (matchMedia("(pointer: coarse)").matches ? "touch" : "mouse");
    const h = this.pick(e.clientX, e.clientY, REACH[type === "touch" || type === "pen" ? type : "mouse"]);
    if (!h) return;
    this.hideHover();
    this.select({ kind: h.kind, i: h.i });
  };

  dispose() {
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.card?.removeEventListener("keydown", this.onCardKey);
    document.body.classList.remove("spiral-card-open");
    this.canvas.style.cursor = "";
    this.hideHover();
    this.controls?.dispose();
    disposeTree(this.scene);
  }
}

export function createScene(): StageScene {
  return new SpiralScene();
}
