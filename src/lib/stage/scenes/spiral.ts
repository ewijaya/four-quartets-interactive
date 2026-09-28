/**
 * The Time Spiral: the whole sequence as a helix — one turn per quartet, rising from
 * Burnt Norton (1936) to Little Gidding (1942), movements as arcs in proportion to
 * their length. Every line is a faint point; notes and motif occurrences are lights;
 * the reader's last position glows. A still axis runs through the centre.
 *
 * Interactive: orbit/zoom (OrbitControls), hover and click lights; the page provides
 * its data as JSON and the DOM for labels and the info card.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { disposeTree, rgb, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, writeCommon } from "./base";

export interface SpiralData {
  total: number;
  quartets: Array<{ code: string; title: string; element: string; year: number; start: number; count: number }>;
  movements: Array<{ quartet: string; n: number; roman: string; start: number; count: number; href: string }>;
  notes: Array<{ g: number; title: string; where: string; href: string; type: string }>;
  motifs: Array<{ g: number; motif: string; name: string; color: string; lemma: string; where: string; href: string }>;
  lineHrefs: Record<string, string>;
  lineIds: string[];
}

const R = 3.2;
const PITCH = 1.7;
const ELEMENT_COLOR: Record<string, [number, number]> = {
  air: [0x34617c, 0xa9cde4],
  earth: [0x744a1d, 0xe0b57e],
  water: [0x1c6464, 0x8fd3cd],
  fire: [0x9a3a18, 0xf4a676],
};

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

/** Position on the helix for global line index g. */
function helix(data: SpiralData, g: number, out: Vector3, radius = R): Vector3 {
  const qi = Math.max(0, data.quartets.findIndex((q) => g >= q.start && g < q.start + q.count));
  const q = data.quartets[qi]!;
  const u = (g - q.start) / Math.max(1, q.count);
  const turn = qi + u;
  const a = turn * Math.PI * 2 - Math.PI / 2;
  out.set(Math.cos(a) * radius, turn * PITCH - (data.quartets.length * PITCH) / 2, Math.sin(a) * radius);
  return out;
}

class SpiralScene implements StageScene {
  readonly key = "spiral";
  readonly renderScale = 1;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.1, 200);
  private palette = new Palette({ cPaper: 0xf4eee1, cInk: 0x3a3226, cGlow: 0xfff1c9 }, { cPaper: 0x0b0d15, cInk: 0x020306, cGlow: 0x3a2e18 });
  private u = { ...commonUniforms() };
  private data!: SpiralData;
  private controls!: OrbitControls;
  private lines!: Points;
  private noteLights!: Points;
  private motifLights!: Points;
  private here: Points | null = null;
  private pathLine!: Line;
  private axis!: Line;
  private mats: ShaderMaterial[] = [];
  private night = false;
  private readonly ray = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly tmp = new Vector3();
  private readonly flyTarget = new Vector3();
  private readonly flyCam = new Vector3();
  private flying = 0;
  private labels: HTMLElement[] = [];
  private labelPos: Vector3[] = [];
  private card: HTMLElement | null = null;
  private canvas!: HTMLCanvasElement;
  private width = 1;
  private height = 1;
  private hovered: { kind: "note" | "motif"; i: number } | null = null;
  private layers = { notes: true, motifs: true };

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    const el = document.querySelector<HTMLScriptElement>("[data-spiral-data]");
    this.data = el ? (JSON.parse(el.textContent ?? "{}") as SpiralData) : { total: 0, quartets: [], movements: [], notes: [], motifs: [], lineHrefs: {}, lineIds: [] };
    this.night = env.night;
    this.canvas = env.renderer.domElement;
    this.scene.add(backgroundMesh(BG, { ...this.u, ...this.palette.uniforms }));

    const d = this.data;
    // Every line: a faint point, tinted by its quartet's element.
    const pos = new Float32Array(d.total * 3);
    const col = new Float32Array(d.total * 3);
    const size = new Float32Array(d.total);
    for (let g = 0; g < d.total; g++) {
      helix(d, g, this.tmp);
      pos.set([this.tmp.x, this.tmp.y, this.tmp.z], g * 3);
      size[g] = 1;
    }
    this.lines = this.points(pos, col, size, 0.55);
    this.colourLines();

    // Movement boundaries: slightly larger points.
    // The path itself.
    const pathGeo = new BufferGeometry().setAttribute("position", new BufferAttribute(pos.slice(), 3));
    this.pathLine = new Line(pathGeo, new LineBasicMaterial({ transparent: true, opacity: 0.18 }));
    this.scene.add(this.pathLine);

    // Notes: gold lights just outside the path.
    const np = new Float32Array(d.notes.length * 3);
    const nc = new Float32Array(d.notes.length * 3);
    const ns = new Float32Array(d.notes.length);
    d.notes.forEach((n, i) => {
      helix(d, n.g, this.tmp, R + 0.16);
      np.set([this.tmp.x, this.tmp.y, this.tmp.z], i * 3);
      ns[i] = 3.2;
    });
    this.noteLights = this.points(np, nc, ns, 1);

    // Motifs: coloured lights further out, one ring per motif.
    const mp = new Float32Array(d.motifs.length * 3);
    const mc = new Float32Array(d.motifs.length * 3);
    const ms = new Float32Array(d.motifs.length);
    d.motifs.forEach((m, i) => {
      helix(d, m.g, this.tmp, R + 0.34 + (i % 3) * 0.08);
      mp.set([this.tmp.x, this.tmp.y, this.tmp.z], i * 3);
      mc.set(rgb(parseInt(m.color.slice(1), 16)), i * 3);
      ms[i] = 2.6;
    });
    this.motifLights = this.points(mp, mc, ms, 1);

    // Where the reader last was.
    try {
      const last = JSON.parse(localStorage.getItem("sp:last") ?? "null") as { line?: string } | null;
      const g = last?.line ? d.lineIds.indexOf(last.line) : -1;
      if (g >= 0) {
        helix(d, g, this.tmp, R);
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
    const half = (d.quartets.length * PITCH) / 2 + 0.8;
    this.axis = new Line(
      new BufferGeometry().setFromPoints([new Vector3(0, -half, 0), new Vector3(0, half, 0)]),
      new LineBasicMaterial({ transparent: true, opacity: 0.35 }),
    );
    this.scene.add(this.axis);

    // Quartet labels at the start of each turn.
    document.querySelectorAll<HTMLElement>("[data-spiral-label]").forEach((lab) => {
      const qi = Number(lab.dataset.spiralLabel);
      const q = d.quartets[qi];
      if (!q) return;
      this.labels.push(lab);
      this.labelPos.push(helix(d, q.start, new Vector3(), R + 0.9).clone());
    });
    this.card = document.querySelector<HTMLElement>("[data-spiral-card]");

    this.camera.position.set(0, 2.4, 13.5);
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
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.ray.params.Points = { threshold: 0.14 };

    this.setNight(env.night);
    this.resize(env.width, env.height);
  }

  private points(pos: Float32Array, col: Float32Array, size: Float32Array, alpha: number): Points {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aColor", new BufferAttribute(col, 3));
    g.setAttribute("aSize", new BufferAttribute(size, 1));
    const m = new ShaderMaterial({
      vertexShader: PT_VERT,
      fragmentShader: PT_FRAG,
      uniforms: { uScale: { value: 2 }, uTime: this.u.uTime, uHover: { value: 0 }, uAlpha: { value: alpha } },
      transparent: true,
      depthWrite: false,
    });
    this.mats.push(m);
    const p = new Points(g, m);
    this.scene.add(p);
    return p;
  }

  private colourLines() {
    const col = this.lines.geometry.getAttribute("aColor") as BufferAttribute;
    for (const q of this.data.quartets) {
      const [v, n] = ELEMENT_COLOR[q.element] ?? [0x888888, 0xcccccc];
      const c = rgb(this.night ? n : v);
      for (let g = q.start; g < q.start + q.count; g++) col.setXYZ(g, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
    const nc = this.noteLights?.geometry.getAttribute("aColor") as BufferAttribute | undefined;
    if (nc) {
      const gold = rgb(this.night ? 0xdcb870 : 0x806119);
      for (let i = 0; i < nc.count; i++) nc.setXYZ(i, gold[0], gold[1], gold[2]);
      nc.needsUpdate = true;
    }
    const hc = this.here?.geometry.getAttribute("aColor") as BufferAttribute | undefined;
    if (hc) {
      const c = rgb(this.night ? 0xfff1c9 : 0x962a1f);
      hc.setXYZ(0, c[0], c[1], c[2]);
      hc.needsUpdate = true;
    }
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
    (this.pathLine?.material as LineBasicMaterial | undefined)?.color.copy(ink);
    (this.axis?.material as LineBasicMaterial | undefined)?.color.copy(ink);
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
    // A slow breath on the "you are here" light (period ≈ 5 s).
    if (this.here) (this.here.material as ShaderMaterial).uniforms.uAlpha!.value = 0.75 + 0.25 * Math.sin(t * 1.25);
    // Labels follow their anchors.
    for (let i = 0; i < this.labels.length; i++) {
      this.tmp.copy(this.labelPos[i]!).project(this.camera);
      const lab = this.labels[i]!;
      const behind = this.tmp.z > 1;
      lab.style.transform = `translate(${((this.tmp.x + 1) / 2) * this.width}px, ${((1 - this.tmp.y) / 2) * this.height}px)`;
      lab.style.opacity = behind ? "0" : "1";
    }
  }

  cue(name: string, on: boolean) {
    if (name === "notes") {
      this.layers.notes = on;
      this.noteLights.visible = on;
    } else if (name === "motifs") {
      this.layers.motifs = on;
      this.motifLights.visible = on;
    } else if (name === "zoom-in" && on) this.dolly(0.8);
    else if (name === "zoom-out" && on) this.dolly(1.25);
    else if (name === "reset" && on) this.flyTo(null);
    else if (name.startsWith("fly:") && on) {
      const m = this.data.movements[Number(name.slice(4))];
      if (m) this.flyTo(m.start + m.count / 2);
    }
  }

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
      this.flyCam.set(0, 2.4, 13.5);
    } else {
      helix(this.data, g, this.flyTarget, R);
      this.tmp.copy(this.flyTarget).setY(0).normalize().multiplyScalar(R + 5.5);
      this.flyCam.set(this.tmp.x, this.flyTarget.y + 1.2, this.tmp.z);
    }
    this.flying = 1.6;
  }

  private pick(e: PointerEvent | MouseEvent): { kind: "note" | "motif"; i: number } | null {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const targets = [this.layers.motifs ? this.motifLights : null, this.layers.notes ? this.noteLights : null].filter(Boolean) as Points[];
    const hit = this.ray.intersectObjects(targets, false)[0];
    if (!hit || hit.index === undefined) return null;
    return { kind: hit.object === this.noteLights ? "note" : "motif", i: hit.index };
  }

  private downAt = { x: 0, y: 0 };
  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
    this.controls.autoRotate = false;
  };

  private onMove = (e: PointerEvent) => {
    const h = this.pick(e);
    this.hovered = h;
    this.canvas.style.cursor = h ? "pointer" : "grab";
  };

  private onClick = (e: MouseEvent) => {
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return; // a drag, not a click
    const h = this.pick(e);
    if (!h || !this.card) return;
    const item = h.kind === "note" ? this.data.notes[h.i]! : this.data.motifs[h.i]!;
    this.flyTo(item.g);
    const card = this.card;
    card.replaceChildren();
    const kind = document.createElement("p");
    kind.className = "eyebrow";
    kind.textContent = h.kind === "note" ? "Note" : `Motif · ${(item as SpiralData["motifs"][number]).name}`;
    const title = document.createElement("p");
    title.className = "spiral-card__title";
    title.textContent = h.kind === "note" ? (item as SpiralData["notes"][number]).title : `‘${(item as SpiralData["motifs"][number]).lemma}’`;
    const where = document.createElement("p");
    where.className = "spiral-card__where";
    where.textContent = item.where;
    const link = document.createElement("a");
    link.className = "btn";
    link.href = item.href;
    link.textContent = h.kind === "note" ? "Open the note" : "Read the line";
    card.append(kind, title, where, link);
    card.hidden = false;
  };

  dispose() {
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.style.cursor = "";
    this.controls?.dispose();
    disposeTree(this.scene);
  }
}

export function createScene(): StageScene {
  return new SpiralScene();
}
