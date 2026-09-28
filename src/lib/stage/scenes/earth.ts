/**
 * East Coker · earth. Grains fall slowly and settle into strata that thicken as the
 * quartet is read ("houses rise and fall"). At the midsummer passage a ring of
 * silhouettes dances slowly round a fire at dusk. Movement II brings wind, III the
 * dark, V a first sight of the sea.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
} from "three";
import { NOISE } from "../glsl";
import { PARTICLES } from "../quality";
import { disposeTree, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, seeded, writeCommon } from "./base";

const MAX_GRAINS = 4200;
const DANCERS = 14;

const BG = /* glsl */ `
uniform vec3 cPaper, cInk, cOchre, cUmber, cClay, cGlow, cSea;
uniform float uFill, uDance, uDark, uWind, uSea;

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float t = uTime;
  vec3 col = cPaper;

  // Dusk warmth rising from the horizon.
  float horizon = smoothstep(0.35, -0.45, p.y);
  col = mix(col, cOchre, horizon * 0.18);

  // Strata: layered bands at the bottom, thickening with reading.
  float top = -0.5 + 0.08 + 0.3 * uFill;
  float y = p.y + 0.012 * snoise(vec2(p.x * 1.6, 3.1));
  float band = y * 26.0 + 1.3 * snoise(vec2(p.x * 2.2, floor(y * 26.0)));
  float layer = floor(band);
  float h = fract(sin(layer * 12.9898) * 43758.5453);
  vec3 strata = h < 0.33 ? cOchre : h < 0.66 ? cUmber : cClay;
  float inStrata = 1.0 - smoothstep(top - 0.05, top + 0.035, y);
  float seam = smoothstep(0.02, 0.0, fract(band)) * 0.5;
  col = mix(col, mix(strata, cInk, seam), inStrata * 0.42);

  // Firelight for the dance.
  vec2 fp = (p - vec2(0.0, -0.1)) * vec2(1.0, 1.6);
  float fire = exp(-dot(fp, fp) * 7.0) * uDance;
  float flick = 0.85 + 0.15 * snoise(vec2(t * 0.35, 1.7));
  col = mix(col, cGlow, fire * 0.55 * flick);

  // A far sea line (movement V).
  float sea = uSea * smoothstep(0.02, 0.0, abs(p.y - 0.08 - 0.004 * sin(p.x * 9.0 + t * 0.2))) ;
  col = mix(col, cSea, sea * 0.35);
  col = mix(col, cSea, uSea * smoothstep(0.08, 0.02, p.y) * smoothstep(-0.3, 0.02, p.y) * 0.12);

  // The dark of movement III.
  col = mix(col, cInk, uDark * 0.55);

  // Wind streaks (movement II).
  float wind = uWind * smoothstep(0.55, 0.9, snoise(vec2(p.x * 1.2 - t * 0.25, p.y * 9.0)));
  col = mix(col, cPaper, wind * 0.12);

  col = mix(col, cInk, 0.07 * smoothstep(0.55, 1.25, length(p)));
  gl_FragColor = vec4(col, 1.0);
}
`;

const GRAIN_VERT = /* glsl */ `
${NOISE}
attribute vec4 aSeed;
uniform float uTime, uFill, uSize, uWind, uDark, uAspect;
uniform vec3 cOchre, cUmber, cClay;
varying vec3 vColor;
varying float vAlpha;

void main(){
  float period = 26.0 + 22.0 * aSeed.z;
  float ph = fract(uTime / period + aSeed.w);
  float x = (aSeed.x - 0.5) * 2.0 * uAspect * 1.05;
  float fall = smoothstep(0.0, 0.55, ph);
  float top = -1.0 + 0.16 + 0.6 * uFill;
  float settle = -1.0 + 0.04 + (top + 1.0 - 0.04) * aSeed.y;
  float y = mix(1.1, settle, fall * fall * (3.0 - 2.0 * fall));
  x += (1.0 - fall) * 0.12 * snoise(vec2(aSeed.x * 7.0, uTime * 0.05 + aSeed.w * 9.0));
  x += uWind * (1.0 - fall) * 0.25 * sin(uTime * 0.3 + aSeed.y * 6.0);
  float fade = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.9, 1.0, ph));
  float layer = floor((settle + 1.0) * 13.0);
  float h = fract(sin(layer * 12.9898) * 43758.5453);
  vColor = h < 0.33 ? cOchre : h < 0.66 ? cUmber : cClay;
  vAlpha = fade * (0.35 + 0.5 * aSeed.z) * (1.0 - uDark * 0.7);
  gl_Position = vec4(x / uAspect, y, 0.0, 1.0);
  gl_PointSize = uSize * (0.6 + aSeed.z * 0.9);
}
`;

const GRAIN_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.2, length(c));
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

const DANCER_VERT = /* glsl */ `
attribute float aIndex;
uniform float uTime, uDance, uAspect, uCount;
varying vec2 vUv;
varying float vFrame;
varying float vAlpha;
void main(){
  float ang = aIndex / uCount * 6.2831853 + uTime * 0.09;
  // An ellipse seen from slightly above: depth drives scale and order.
  float z = sin(ang);
  vec2 centre = vec2(cos(ang) * 0.62, -0.2 + z * 0.12);
  float scale = mix(0.8, 1.15, z * 0.5 + 0.5) * 0.17;
  // Keep time: a gentle rise and fall, in step with neighbours.
  float step = floor(uTime * 0.8 + aIndex * 0.5);
  float bob = 0.012 * abs(sin(uTime * 2.513 + aIndex));
  float k = min(1.0, uAspect * 1.3);
  vec2 local = vec2(position.x * 0.55, position.y + 0.5) * scale;
  vec2 pos = vec2(centre.x * k, centre.y) + local * k + vec2(0.0, bob);
  gl_Position = vec4(pos.x / uAspect, pos.y, 0.5 - z * 0.1, 1.0);
  vUv = uv;
  vFrame = mod(step + aIndex, 4.0);
  vAlpha = uDance * mix(0.55, 1.0, z * 0.5 + 0.5);
}
`;

const DANCER_FRAG = /* glsl */ `
uniform sampler2D tFigures;
uniform vec3 cFigure;
varying vec2 vUv;
varying float vFrame;
varying float vAlpha;
void main(){
  vec2 uv = vec2((vUv.x + vFrame) / 4.0, vUv.y);
  float a = texture2D(tFigures, uv).a;
  if (a * vAlpha < 0.01) discard;
  gl_FragColor = vec4(cFigure, a * vAlpha * 0.85);
}
`;

/** Four poses of a dancing figure, drawn once into an atlas. */
function figureAtlas(): HTMLCanvasElement {
  const W = 128;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W * 4;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.strokeStyle = "#000";
  g.lineCap = "round";
  g.lineJoin = "round";
  const poses = [
    { armL: -0.9, armR: 0.9, legL: -0.25, legR: 0.25, lean: 0 },
    { armL: -2.2, armR: 0.6, legL: -0.45, legR: 0.1, lean: 0.08 },
    { armL: -0.6, armR: 2.3, legL: -0.05, legR: 0.45, lean: -0.08 },
    { armL: -2.0, armR: 2.0, legL: -0.3, legR: 0.3, lean: 0 },
  ];
  poses.forEach((p, i) => {
    g.save();
    g.translate(W * i + W / 2, H * 0.1);
    g.rotate(p.lean);
    // head
    g.beginPath();
    g.arc(0, 18, 13, 0, Math.PI * 2);
    g.fill();
    // body (a long country dress / smock)
    g.beginPath();
    g.moveTo(-10, 34);
    g.lineTo(10, 34);
    g.lineTo(26, 150);
    g.lineTo(-26, 150);
    g.closePath();
    g.fill();
    // arms
    g.lineWidth = 8;
    const arm = (side: number, a: number) => {
      g.beginPath();
      g.moveTo(side * 8, 42);
      g.lineTo(side * 8 + Math.sin(a) * 46, 42 + Math.cos(a) * 46);
      g.stroke();
    };
    arm(-1, p.armL);
    arm(1, p.armR);
    // legs
    g.lineWidth = 9;
    const leg = (side: number, a: number) => {
      g.beginPath();
      g.moveTo(side * 9, 146);
      g.lineTo(side * 9 + Math.sin(a) * 70, 146 + Math.cos(a) * 70);
      g.stroke();
    };
    leg(-1, p.legL);
    leg(1, p.legR);
    g.restore();
  });
  return c;
}

class EarthScene implements StageScene {
  readonly key = "earth";
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  private palette = new Palette(
    { cPaper: 0xf4eee1, cInk: 0x3d2f22, cOchre: 0xd9b27a, cUmber: 0xb88a5a, cClay: 0xc9a47c, cGlow: 0xf2c078, cSea: 0x9fb4b0, cFigure: 0x3a2a1c },
    { cPaper: 0x0b0d15, cInk: 0x020203, cOchre: 0x3a2814, cUmber: 0x2a1c10, cClay: 0x32220f, cGlow: 0x6a3410, cSea: 0x14222a, cFigure: 0x020203 },
  );
  private u = {
    ...commonUniforms(),
    uFill: { value: 0.2 },
    uDance: { value: 0 },
    uDark: { value: 0 },
    uWind: { value: 0 },
    uSea: { value: 0 },
  };
  private grains!: Points;
  private grainMat!: ShaderMaterial;
  private dancerMat!: ShaderMaterial;
  private targets = { dance: 0, dark: 0, wind: 0, sea: 0 };

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    const uniforms = { ...this.u, ...this.palette.uniforms };
    this.scene.add(backgroundMesh(BG, uniforms));

    const rnd = seeded(1940);
    const seeds = new Float32Array(MAX_GRAINS * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(MAX_GRAINS * 3), 3));
    g.setAttribute("aSeed", new BufferAttribute(seeds, 4));
    this.grainMat = new ShaderMaterial({
      vertexShader: GRAIN_VERT,
      fragmentShader: GRAIN_FRAG,
      uniforms: {
        uTime: this.u.uTime,
        uFill: this.u.uFill,
        uWind: this.u.uWind,
        uDark: this.u.uDark,
        uSize: { value: 2 },
        uAspect: { value: 1 },
        cOchre: this.palette.uniforms.cOchre,
        cUmber: this.palette.uniforms.cUmber,
        cClay: this.palette.uniforms.cClay,
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.grains = new Points(g, this.grainMat);
    this.grains.frustumCulled = false;
    this.scene.add(this.grains);

    // Dancers: instanced quads sampling a pose atlas.
    const quad = new PlaneGeometry(1, 1);
    const dg = new InstancedBufferGeometry();
    dg.index = quad.index;
    dg.setAttribute("position", quad.getAttribute("position"));
    dg.setAttribute("uv", quad.getAttribute("uv"));
    const idx = new Float32Array(DANCERS);
    for (let i = 0; i < DANCERS; i++) idx[i] = i;
    dg.setAttribute("aIndex", new InstancedBufferAttribute(idx, 1));
    dg.instanceCount = DANCERS;
    const tex = new CanvasTexture(figureAtlas());
    this.dancerMat = new ShaderMaterial({
      vertexShader: DANCER_VERT,
      fragmentShader: DANCER_FRAG,
      uniforms: {
        uTime: this.u.uTime,
        uDance: this.u.uDance,
        uAspect: { value: 1 },
        uCount: { value: DANCERS },
        tFigures: { value: tex },
        cFigure: this.palette.uniforms.cFigure,
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const dancers = new Mesh(dg, this.dancerMat);
    dancers.frustumCulled = false;
    this.scene.add(dancers);

    this.setNight(env.night);
    this.setTier(env.tier);
    this.resize(env.width, env.height);
  }

  resize(w: number, h: number) {
    (this.u.uRes.value as { set(x: number, y: number): void }).set(w, h);
    const aspect = w / h;
    this.grainMat.uniforms.uAspect!.value = aspect;
    this.dancerMat.uniforms.uAspect!.value = aspect;
    this.grainMat.uniforms.uSize!.value = Math.max(1.6, Math.min(3.2, Math.min(w, h) / 360)) * Math.min(window.devicePixelRatio || 1, 2) * 0.8;
  }

  setNight(night: boolean) {
    this.palette.apply(night);
    this.u.uNight.value = night ? 1 : 0;
    this.grainMat.blending = night ? AdditiveBlending : NormalBlending;
    this.grainMat.needsUpdate = true;
  }

  setTier(tier: Tier) {
    this.grains.geometry.setDrawRange(0, Math.round(MAX_GRAINS * PARTICLES[tier]));
  }

  update(t: number, dt: number, r: Reading) {
    writeCommon(this.u, t, r);
    const u = this.u;
    u.uFill.value = damp(u.uFill.value, 0.15 + 0.85 * r.global, dt, 2.0);
    u.uDance.value = damp(u.uDance.value, this.targets.dance, dt, 1.2);
    u.uDark.value = damp(u.uDark.value, Math.max(this.targets.dark, r.movement === 3 ? 0.55 : 0), dt, 1.5);
    u.uWind.value = damp(u.uWind.value, Math.max(this.targets.wind, r.movement === 2 ? 0.35 : 0), dt, 1.2);
    u.uSea.value = damp(u.uSea.value, Math.max(this.targets.sea, r.movement === 5 ? 0.35 : 0), dt, 2.0);
  }

  cue(name: string, on: boolean) {
    if (name === "dance") this.targets.dance = on ? 1 : 0;
    else if (name === "dark") this.targets.dark = on ? 1 : 0;
    else if (name === "wind") this.targets.wind = on ? 1 : 0;
    else if (name === "sea") this.targets.sea = on ? 1 : 0;
  }

  dispose() {
    disposeTree(this.scene);
  }
}

export function createScene(): StageScene {
  return new EarthScene();
}
