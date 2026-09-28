/**
 * Burnt Norton · air. A late-summer garden seen as light: dappled leaf-shadow, a
 * diagonal shaft of sun, dust motes drifting through it. Cues: the pool fills with
 * light and empties again; the kingfisher's glint; the returning shaft of sunlight.
 * Movement III dims to the Underground's grey; IV falls to dusk.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
} from "three";
import { NOISE } from "../glsl";
import { PARTICLES } from "../quality";
import { disposeTree, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, seeded, writeCommon } from "./base";

const MAX_MOTES = 3200;

const BG = /* glsl */ `
uniform vec3 cPaper, cInk, cLight, cLeaf, cDim, cDusk;
uniform float uShimmer, uShaft, uDim, uDusk, uGlint;

float shaftAt(vec2 p){
  vec2 o = vec2(-0.62, 0.62);
  vec2 dir = normalize(vec2(0.58, -1.0));
  vec2 q = p - o;
  float across = dot(q, vec2(-dir.y, dir.x));
  float along = dot(q, dir);
  float w = 0.13 + along * 0.08;
  return exp(-(across * across) / (w * w)) * smoothstep(-0.1, 0.5, along) * (1.0 - smoothstep(1.3, 2.3, along));
}

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float t = uTime;
  vec3 col = cPaper;

  // Warm glow of the sun beyond the upper left.
  float sun = 1.0 - smoothstep(0.0, 1.5, length(p - vec2(-0.95, 0.75)));
  col = mix(col, cLight, sun * 0.45 * (1.0 - uDim));

  // Dappled shadow of leaves, drifting and swaying slowly.
  vec2 q = p * 2.4 + vec2(t * 0.010, -t * 0.006);
  vec2 warp = vec2(snoise(q * 0.45 + t * 0.022), snoise(q * 0.45 - t * 0.018 + 4.0));
  float n = fbm(q + warp * 0.45);
  float leaves = smoothstep(0.02, 0.32, n);
  col = mix(col, cLeaf, leaves * 0.26 * (1.0 - uDim * 0.6));
  // Holes in the canopy let small coins of light through.
  float coins = smoothstep(0.52, 0.62, snoise(q * 3.1 + warp));
  col = mix(col, cLight, coins * 0.12 * (1.0 - uDim));

  // The shaft of sunlight.
  float shaft = shaftAt(p) * (0.4 + 0.6 * uShaft);
  col = mix(col, cLight, shaft * 0.42 * (1.0 - uDim));

  // The drained pool, and the moment it fills with water out of sunlight.
  vec2 pc = (p - vec2(0.2, -0.33)) * vec2(1.0, 3.4);
  float rim = length(pc);
  float pool = 1.0 - smoothstep(0.30, 0.34, rim);
  float edge = smoothstep(0.27, 0.31, rim) * (1.0 - smoothstep(0.33, 0.37, rim));
  col = mix(col, cLeaf, edge * 0.18 * (1.0 - uShimmer));
  float glit = smoothstep(0.35, 0.95, snoise(vec3(p * vec2(42.0, 130.0), t * 0.32)));
  float sheen = 0.35 + 0.65 * glit;
  col = mix(col, cLight, pool * uShimmer * sheen * 0.85);

  // Kingfisher: a brief blue-green glint in the shaft.
  float kf = uGlint * exp(-pow(length(p - vec2(0.05, 0.12)) * 5.0, 2.0));
  col = mix(col, vec3(0.18, 0.55, 0.62), kf * 0.5);

  // Movement III: the Underground's grey half-light. IV: dusk.
  col = mix(col, cDim, uDim * 0.62);
  col = mix(col, cDusk, uDusk * 0.4);

  // Vignette toward ink.
  col = mix(col, cInk, 0.08 * smoothstep(0.55, 1.25, length(p)));
  gl_FragColor = vec4(col, 1.0);
}
`;

const MOTE_VERT = /* glsl */ `
${NOISE}
attribute vec3 aSeed;
uniform float uTime, uSize, uDim, uShaft, uScroll, uAspect;
varying float vAlpha;

float shaftAt(vec2 p){
  vec2 o = vec2(-0.62, 0.62);
  vec2 dir = normalize(vec2(0.58, -1.0));
  vec2 q = p - o;
  float across = dot(q, vec2(-dir.y, dir.x));
  float along = dot(q, dir);
  float w = 0.13 + along * 0.08;
  return exp(-(across * across) / (w * w)) * smoothstep(-0.1, 0.5, along) * (1.0 - smoothstep(1.3, 2.3, along));
}

void main(){
  vec3 base = (aSeed - 0.5) * vec3(14.0, 9.0, 6.0);
  float tt = uTime * 0.045;
  vec3 drift = vec3(snoise(vec2(aSeed.x * 11.0, tt)), snoise(vec2(aSeed.y * 13.0, tt + 3.7)), snoise(vec2(aSeed.z * 7.0, tt + 9.1))) * vec3(0.9, 0.7, 0.5);
  vec3 pos = base + drift;
  pos.y = mod(pos.y + 4.5 + uTime * (0.012 + 0.02 * aSeed.z) + uScroll * 0.6, 9.0) - 4.5;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vec2 ndc = gl_Position.xy / gl_Position.w;
  float s = shaftAt(ndc * 0.5 * vec2(uAspect, 1.0));
  float tw = 0.65 + 0.35 * sin(uTime * 0.5 + aSeed.x * 40.0);
  vAlpha = (0.12 + 0.88 * s * (0.4 + 0.6 * uShaft)) * tw * (1.0 - uDim * 0.75);
  gl_PointSize = uSize * (0.55 + aSeed.z) * (6.0 / max(1.0, -mv.z));
}
`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 cMote;
uniform float uMoteAlpha;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(cMote, a * vAlpha * uMoteAlpha);
}
`;

class AirScene implements StageScene {
  readonly key = "air";
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 60);
  private palette = new Palette(
    { cPaper: 0xf4eee1, cInk: 0x3b463c, cLight: 0xfff3cf, cLeaf: 0xa9b397, cDim: 0xcdc8bf, cDusk: 0xe4c49f, cMote: 0xfffaf0 },
    { cPaper: 0x0b0d15, cInk: 0x020306, cLight: 0x2c3a58, cLeaf: 0x07090c, cDim: 0x08090d, cDusk: 0x1a1220, cMote: 0xe9dcb0 },
  );
  private u = {
    ...commonUniforms(),
    uShimmer: { value: 0 },
    uShaft: { value: 0 },
    uDim: { value: 0 },
    uDusk: { value: 0 },
    uGlint: { value: 0 },
  };
  private moteMat!: ShaderMaterial;
  private motes!: Points;
  private targets = { shimmer: 0, shaft: 0, glint: 0 };

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    const uniforms = { ...this.u, ...this.palette.uniforms };
    this.scene.add(backgroundMesh(BG, uniforms));

    const rnd = seeded(1936);
    const seeds = new Float32Array(MAX_MOTES * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(MAX_MOTES * 3), 3));
    geo.setAttribute("aSeed", new BufferAttribute(seeds, 3));
    this.moteMat = new ShaderMaterial({
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: {
        uTime: this.u.uTime,
        uDim: this.u.uDim,
        uShaft: this.u.uShaft,
        uScroll: this.u.uScroll,
        uSize: { value: 3 },
        uAspect: { value: 1 },
        uMoteAlpha: { value: 0.9 },
        cMote: this.palette.uniforms.cMote,
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.motes = new Points(geo, this.moteMat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
    this.camera.position.set(0, 0, 6);
    this.setNight(env.night);
    this.setTier(env.tier);
    this.resize(env.width, env.height);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    (this.u.uRes.value as { set(x: number, y: number): void }).set(w, h);
    this.moteMat.uniforms.uAspect!.value = w / h;
    this.moteMat.uniforms.uSize!.value = Math.min(4.5, Math.max(2.2, Math.min(w, h) / 260)) * Math.min(window.devicePixelRatio || 1, 2);
  }

  setNight(night: boolean) {
    this.palette.apply(night);
    this.u.uNight.value = night ? 1 : 0;
    this.moteMat.blending = night ? AdditiveBlending : NormalBlending;
    this.moteMat.uniforms.uMoteAlpha!.value = night ? 0.85 : 0.7;
    this.moteMat.needsUpdate = true;
  }

  setTier(tier: Tier) {
    this.motes.geometry.setDrawRange(0, Math.round(MAX_MOTES * PARTICLES[tier]));
  }

  update(t: number, dt: number, r: Reading) {
    writeCommon(this.u, t, r);
    const u = this.u;
    u.uShimmer.value = damp(u.uShimmer.value, this.targets.shimmer, dt, 0.8);
    u.uShaft.value = damp(u.uShaft.value, this.targets.shaft || (r.movement === 1 || r.movement === 0 ? 0.55 : 0.3), dt, 1.2);
    u.uDim.value = damp(u.uDim.value, r.movement === 3 ? 1 : 0, dt, 1.4);
    u.uDusk.value = damp(u.uDusk.value, r.movement === 4 ? 1 : 0, dt, 1.4);
    // The glint rises and decays by itself.
    u.uGlint.value = damp(u.uGlint.value, this.targets.glint, dt, 0.5);
    this.targets.glint = damp(this.targets.glint, 0, dt, 1.2);
  }

  cue(name: string, on: boolean) {
    if (name === "pool") this.targets.shimmer = on ? 1 : 0;
    else if (name === "shaft") this.targets.shaft = on ? 1 : 0;
    else if (name === "kingfisher" && on) this.targets.glint = 1;
  }

  dispose() {
    disposeTree(this.scene);
  }
}

export function createScene(): StageScene {
  return new AirScene();
}
