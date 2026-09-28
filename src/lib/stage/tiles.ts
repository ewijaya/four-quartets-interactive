/**
 * Tile transitions: a movement heading is rasterised, cut into small square tiles,
 * lifted, flocked into the quartet's emblem and settled back. All motion happens in
 * the vertex shader from one progress uniform; the CPU only tracks the heading's
 * position as the page scrolls. The DOM heading stays in the accessibility tree and
 * is only visually hidden while the tiles fly.
 */
import {
  CanvasTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  NormalBlending,
  AdditiveBlending,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { emblemPoints } from "./emblems";
import type { Element as Elemental } from "../model";

const VERT = /* glsl */ `
attribute vec2 aHome;
attribute vec2 aTarget;
attribute vec4 aUv;
attribute vec2 aSeed;
uniform vec2 uOrigin;
uniform vec2 uEmblem;
uniform vec2 uRes;
uniform float uT;
uniform float uTime;
uniform float uCell;
varying vec2 vUv;
varying float vAway;

float ease(float x){ return x < 0.5 ? 4.0*x*x*x : 1.0 - pow(-2.0*x + 2.0, 3.0) * 0.5; }

void main(){
  float d = aSeed.x * 0.1;
  float t = clamp((uT - d) / 0.9, 0.0, 1.0);
  float go = ease(smoothstep(0.06, 0.46, t));
  float back = ease(smoothstep(0.62, 0.97, t));

  vec2 home = uOrigin + aHome;
  vec2 target = uEmblem + aTarget;
  float ang = aSeed.y * 6.2831853;
  vec2 bend = vec2(cos(ang), sin(ang)) * (60.0 + 90.0 * aSeed.x);
  vec2 m1 = mix(home, target, 0.5) + bend;
  vec2 m2 = mix(target, home, 0.5) - bend * 0.7;
  vec2 pOut = mix(mix(home, m1, go), mix(m1, target, go), go);
  vec2 pBack = mix(mix(target, m2, back), mix(m2, home, back), back);
  vec2 p = back > 0.0 ? pBack : pOut;

  // Lift off: a small rise before the flight.
  float lift = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.06, 0.2, t));
  p.y -= lift * (4.0 + 6.0 * aSeed.y);
  // Hold: the emblem breathes very gently.
  float hold = smoothstep(0.44, 0.5, t) * (1.0 - smoothstep(0.58, 0.64, t));
  p += hold * vec2(sin(uTime * 1.1 + aSeed.x * 23.0), cos(uTime * 0.9 + aSeed.y * 19.0)) * 1.4;

  float away = clamp(go - back, 0.0, 1.0);
  float rot = away * (aSeed.x - 0.5) * 3.14159;
  vec2 c = position.xy * uCell * (1.0 + 0.9 * away);
  c = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * c;
  vec2 px = p + c + uCell * 0.5;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
  vUv = mix(aUv.xy, aUv.zw, position.xy + 0.5);
  vAway = away;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D tGlyph;
uniform vec3 uTessera;
uniform float uFade;
varying vec2 vUv;
varying float vAway;
void main(){
  vec4 g = texture2D(tGlyph, vUv);
  float tess = 0.55 * vAway;
  vec3 col = mix(uTessera, g.rgb, g.a);
  float a = max(g.a, tess) * uFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}
`;

const DURATION = 4.8; // seconds

export class TileLayer {
  readonly scene = new Scene();
  active = false;
  private mesh: Mesh<InstancedBufferGeometry, ShaderMaterial> | null = null;
  private texture: CanvasTexture | null = null;
  private heading: HTMLElement | null = null;
  private elapsed = 0;
  private width = 1;
  private height = 1;
  private night = false;
  private resolve: (() => void) | null = null;
  private readonly origin = new Vector2();
  private readonly emblem = new Vector2();
  private readonly res = new Vector2(1, 1);
  private emblemOffset = { x: 0, y: 0 };

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.res.set(w, h);
  }

  setNight(n: boolean) {
    this.night = n;
  }

  /** Play the transition for a heading element. Resolves when the tiles have settled. */
  play(heading: HTMLElement, element: Elemental): Promise<void> {
    if (this.active) return Promise.resolve();
    const built = this.build(heading, element);
    if (!built) return Promise.resolve();
    this.heading = heading;
    heading.classList.add("is-tiling");
    this.elapsed = 0;
    this.active = true;
    return new Promise((r) => (this.resolve = r));
  }

  update(t: number, dt: number) {
    if (!this.mesh || !this.heading) return;
    this.elapsed += dt;
    const p = Math.min(1, this.elapsed / DURATION);
    const r = this.heading.getBoundingClientRect();
    this.origin.set(r.left, r.top);
    this.emblem.set(r.left + this.emblemOffset.x, r.top + this.emblemOffset.y);
    const u = this.mesh.material.uniforms;
    u.uT!.value = p;
    u.uTime!.value = t;
    u.uFade!.value = Math.min(1, this.elapsed / 0.15);
    if (p >= 1) this.finish();
  }

  /** Stop immediately (navigation, reduced motion switched on…). */
  cancel() {
    if (this.active) this.finish();
  }

  private finish() {
    this.heading?.classList.remove("is-tiling");
    this.heading = null;
    this.active = false;
    this.clear();
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  private clear() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    this.texture?.dispose();
    this.texture = null;
  }

  private build(heading: HTMLElement, element: Elemental): boolean {
    this.clear();
    const hr = heading.getBoundingClientRect();
    if (hr.width < 4 || hr.height < 4) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 1. Rasterise the numeral and caption exactly where the browser drew them.
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(hr.width * dpr);
    canvas.height = Math.ceil(hr.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.scale(dpr, dpr);
    const parts = heading.querySelectorAll<HTMLElement>("[aria-hidden='true']");
    let tessera = "#b8913a";
    parts.forEach((el, i) => {
      const cs = getComputedStyle(el);
      if (i === 0) tessera = cs.color;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.fillStyle = cs.color;
      ctx.textBaseline = "alphabetic";
      const text = el.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) return;
      const range = document.createRange();
      const s = text.textContent ?? "";
      for (let k = 0; k < s.length; k++) {
        const ch = s[k]!;
        if (!ch.trim()) continue;
        range.setStart(text, k);
        range.setEnd(text, k + 1);
        const rr = range.getBoundingClientRect();
        const m = ctx.measureText(ch);
        const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
        const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
        const y = rr.top - hr.top + rr.height / 2 + (asc - desc) / 2;
        ctx.fillText(ch, rr.left - hr.left, y);
      }
    });

    // 2. Cut into tiles, keeping only cells that carry ink.
    const cell = 3;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const cellPx = cell * dpr;
    const cols = Math.ceil(hr.width / cell);
    const rows = Math.ceil(hr.height / cell);
    const homes: number[] = [];
    const uvs: number[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        let a = 0;
        let n = 0;
        const x0 = Math.floor(i * cellPx);
        const y0 = Math.floor(j * cellPx);
        for (let y = y0; y < Math.min(canvas.height, y0 + cellPx); y += 2) {
          for (let x = x0; x < Math.min(canvas.width, x0 + cellPx); x += 2) {
            a += img[(y * canvas.width + x) * 4 + 3]!;
            n++;
          }
        }
        if (!n || a / n < 10) continue;
        homes.push(i * cell, j * cell);
        uvs.push((i * cell) / hr.width, (j * cell) / hr.height, ((i + 1) * cell) / hr.width, ((j + 1) * cell) / hr.height);
      }
    }
    const cells = homes.length / 2;
    if (cells < 8) return false;
    // Each inked cell releases several tiles, so the emblem is drawn densely even
    // from a two-letter numeral; instances sharing a cell start and end stacked on it.
    const count = Math.max(cells, Math.min(560, cells * 3));

    // 3. Targets on the emblem, matched by angle so the flock moves coherently.
    const radius = Math.max(56, Math.min(96, hr.height * 0.9));
    const targets = emblemPoints(element, count, radius);
    this.emblemOffset = { x: hr.width / 2 - cell / 2, y: hr.height / 2 - cell / 2 };
    const cx = hr.width / 2;
    const cy = hr.height / 2;
    const angleOf = (k: number) => {
      const c = k % cells;
      return Math.atan2(homes[c * 2 + 1]! - cy, homes[c * 2]! - cx) + (Math.floor(k / cells) * 0.37) % (Math.PI * 2);
    };
    const homeOrder = [...Array(count).keys()].sort((a, b) => angleOf(a) - angleOf(b));
    const targetOrder = [...Array(count).keys()].sort(
      (a, b) => Math.atan2(targets[a * 2 + 1]!, targets[a * 2]!) - Math.atan2(targets[b * 2 + 1]!, targets[b * 2]!),
    );
    const aHome = new Float32Array(count * 2);
    const aTarget = new Float32Array(count * 2);
    const aUv = new Float32Array(count * 4);
    const aSeed = new Float32Array(count * 2);
    for (let k = 0; k < count; k++) {
      const h = homeOrder[k]! % cells;
      const g = targetOrder[k]!;
      aHome[k * 2] = homes[h * 2]!;
      aHome[k * 2 + 1] = homes[h * 2 + 1]!;
      aTarget[k * 2] = targets[g * 2]!;
      aTarget[k * 2 + 1] = targets[g * 2 + 1]!;
      aUv[k * 4] = uvs[h * 4]!;
      aUv[k * 4 + 1] = uvs[h * 4 + 1]!;
      aUv[k * 4 + 2] = uvs[h * 4 + 2]!;
      aUv[k * 4 + 3] = uvs[h * 4 + 3]!;
      aSeed[k * 2] = Math.random();
      aSeed[k * 2 + 1] = Math.random();
    }

    const geo = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("aHome", new InstancedBufferAttribute(aHome, 2));
    geo.setAttribute("aTarget", new InstancedBufferAttribute(aTarget, 2));
    geo.setAttribute("aUv", new InstancedBufferAttribute(aUv, 4));
    geo.setAttribute("aSeed", new InstancedBufferAttribute(aSeed, 2));
    geo.instanceCount = count;

    this.texture = new CanvasTexture(canvas);
    this.texture.flipY = false;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;

    const tc = parseColor(tessera);
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tGlyph: { value: this.texture },
        uOrigin: { value: this.origin },
        uEmblem: { value: this.emblem },
        uRes: { value: this.res },
        uT: { value: 0 },
        uTime: { value: 0 },
        uCell: { value: cell },
        uTessera: { value: new Vector3(tc[0], tc[1], tc[2]) },
        uFade: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // The pixel-space mapping flips y, which reverses winding: draw both faces.
      side: DoubleSide,
      blending: this.night ? AdditiveBlending : NormalBlending,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    return true;
  }

  dispose() {
    this.cancel();
    this.clear();
  }
}

function parseColor(css: string): [number, number, number] {
  const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css);
  if (!m) return [0.72, 0.57, 0.23];
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
}
