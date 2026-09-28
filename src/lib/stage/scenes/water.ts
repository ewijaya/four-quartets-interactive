/**
 * The Dry Salvages · water. A Gerstner-wave ocean under fog, a bell buoy rocking on
 * the swell (sampled on the CPU from the same wave sum), and at the opening a brown
 * river current that gives way to the sea. Fog thickens at the cue; in movement IV
 * a shrine light shows on the promontory.
 */
import {
  CylinderGeometry,
  EdgesGeometry,
  FogExp2,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { disposeTree, rgb, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, writeCommon } from "./base";

// Direction (x, z), steepness, wavelength, speed factor.
const WAVES: Array<[number, number, number, number, number]> = [
  [1.0, 0.25, 0.22, 14.0, 0.8],
  [0.7, -0.7, 0.18, 9.0, 0.9],
  [-0.4, 0.9, 0.14, 5.5, 1.0],
  [0.95, 0.3, 0.1, 3.2, 1.1],
];
const G = 9.8;
/** Normalised wave table for CPU sampling: dx, dz, q, k, c per wave. */
const WAVE_TABLE = new Float32Array(
  WAVES.flatMap(([dx, dz, q, l, s]) => {
    const len = Math.hypot(dx, dz);
    const k = (2 * Math.PI) / l;
    return [dx / len, dz / len, q, k, Math.sqrt(G / k) * s];
  }),
);
/** Lamp colours (sRGB 0…1), precomputed so the frame loop never allocates. */
const LAMP = {
  vellumOn: rgb(0xf2c46e),
  vellumOff: rgb(0xb8a07a),
  nightOn: rgb(0x8a6424),
  nightOff: rgb(0x3a2a12),
};

const WAVE_GLSL = WAVES.map(([dx, dz, q, l, s], i) => {
  const len = Math.hypot(dx, dz);
  return `W(p, vec2(${(dx / len).toFixed(4)}, ${(dz / len).toFixed(4)}), ${q.toFixed(3)}, ${l.toFixed(3)}, ${s.toFixed(3)}, t, off, tb, bn); // ${i}`;
}).join("\n  ");

const OCEAN_VERT = /* glsl */ `
uniform float uTime, uSwell;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;

void W(vec3 p, vec2 d, float q, float L, float s, float t, inout vec3 off, inout vec3 tb, inout vec3 bn){
  float k = 6.2831853 / L;
  float c = sqrt(${G.toFixed(1)} / k) * s;
  float f = k * (dot(d, p.xz) - c * t);
  float a = q / k * uSwell;
  float qa = q * uSwell;
  off += vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
  tb += vec3(-d.x * d.x * qa * sin(f), d.x * qa * cos(f), -d.x * d.y * qa * sin(f));
  bn += vec3(-d.x * d.y * qa * sin(f), d.y * qa * cos(f), -d.y * d.y * qa * sin(f));
}

void main(){
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  float t = uTime * 0.55;
  vec3 off = vec3(0.0);
  vec3 tb = vec3(1.0, 0.0, 0.0);
  vec3 bn = vec3(0.0, 0.0, 1.0);
  ${WAVE_GLSL}
  vec3 w = p + off;
  vWorld = w;
  vNormal = normalize(cross(bn, tb));
  vHeight = off.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const OCEAN_FRAG = /* glsl */ `
uniform vec3 cDeep, cSkyRef, cGlint, cFoam, cFog;
uniform vec3 uSunDir;
uniform float uFog;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = mix(cDeep, cSkyRef, clamp(fres * 0.9 + 0.08, 0.0, 1.0));
  vec3 H = normalize(normalize(uSunDir) + V);
  float spec = pow(max(dot(N, H), 0.0), 140.0);
  col += cGlint * spec * 0.55;
  col = mix(col, cFoam, smoothstep(0.35, 0.75, vHeight) * 0.22);
  float dist = length(vWorld - cameraPosition);
  float fog = 1.0 - exp(-pow(dist * uFog, 2.0));
  col = mix(col, cFog, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const SKY = /* glsl */ `
uniform vec3 cSkyTop, cFog, cShrine, cRiver, cRiverDeep;
uniform float uHorizon, uShrine, uRiver;
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float h = vUv.y - uHorizon;
  vec3 col = mix(cFog, cSkyTop, smoothstep(0.0, 0.55, h));
  // A low sun or moon, veiled.
  float glow = exp(-pow(length((p - vec2(0.42 * aspect * 0.5, uHorizon - 0.5 + 0.12)) * vec2(1.0, 1.6)) * 3.0, 2.0));
  col = mix(col, cFog * 1.06, glow * 0.4);
  // Shrine light on the promontory (movement IV), breathing slowly.
  vec2 sp = p - vec2(-0.36 * aspect, uHorizon - 0.5 + 0.012);
  float shrine = uShrine * (0.75 + 0.25 * sin(uTime * 0.78)) * exp(-dot(sp, sp) * 2600.0);
  float halo = uShrine * exp(-dot(sp, sp) * 90.0) * 0.25;
  col = mix(col, cShrine, clamp(shrine + halo, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const RIVER = /* glsl */ `
uniform vec3 cRiver, cRiverDeep, cPaper;
uniform float uRiver;
void main(){
  if (uRiver < 0.003) discard;
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  // A broad river crossing the frame on a slow curve.
  float centre = 0.18 * sin(p.x * 1.6 + 0.6);
  float d = abs(p.y - centre);
  float bank = 1.0 - smoothstep(0.2, 0.3, d);
  vec2 flow = vec2(p.x * 2.0 - uTime * 0.06, (p.y - centre) * 7.0);
  float streak = snoise(flow * vec2(1.2, 2.4)) * 0.5 + snoise(flow * vec2(3.0, 6.0) + 7.0) * 0.25;
  vec3 col = mix(cRiverDeep, cRiver, 0.55 + 0.45 * streak);
  col = mix(cPaper, col, bank);
  gl_FragColor = vec4(col, uRiver * (0.35 + 0.65 * bank));
}
`;

class WaterScene implements StageScene {
  readonly key = "water";
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.1, 400);
  private palette = new Palette(
    {
      cPaper: 0xf4eee1,
      cSkyTop: 0xeef0ea,
      cFog: 0xece9e1,
      cDeep: 0x8fa5a2,
      cSkyRef: 0xd6dfdc,
      cGlint: 0xfffcf1,
      cFoam: 0xf1efe7,
      cShrine: 0xf6d38c,
      cRiver: 0xdccbad,
      cRiverDeep: 0xc6ae8a,
      cBuoy: 0x55605c,
    },
    {
      cPaper: 0x0b0d15,
      cSkyTop: 0x06080f,
      cFog: 0x0f1722,
      cDeep: 0x03070c,
      cSkyRef: 0x15212d,
      cGlint: 0x55657d,
      cFoam: 0x1a2733,
      cShrine: 0x8a6424,
      cRiver: 0x241a0e,
      cRiverDeep: 0x160f08,
      cBuoy: 0x020305,
    },
  );
  private u = {
    ...commonUniforms(),
    uSwell: { value: 1 },
    uFog: { value: 0.02 },
    uSunDir: { value: new Vector3(0.4, 0.28, -1) },
    uHorizon: { value: 0.58 },
    uShrine: { value: 0 },
    uRiver: { value: 0 },
  };
  private ocean!: Mesh<PlaneGeometry, ShaderMaterial>;
  private buoy = new Group();
  private buoyLight!: Mesh<SphereGeometry, MeshBasicMaterial>;
  private fog = new FogExp2(0xece9e1, 0.02);
  private tier: Tier = 2;
  private targets = { fog: 0, shrine: 0, sea: 0, bell: 0 };
  private readonly buoyPos = { x: 3.2, z: -11 };

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    const uniforms = { ...this.u, ...this.palette.uniforms };
    this.scene.fog = this.fog;
    this.scene.add(backgroundMesh(SKY, uniforms));

    this.ocean = new Mesh(this.oceanGeometry(env.tier), new ShaderMaterial({ vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG, uniforms }));
    this.ocean.frustumCulled = false;
    this.scene.add(this.ocean);

    // The bell buoy: a float, an open lattice tower, a bell and a light.
    const inkMat = new MeshBasicMaterial({ color: 0x55605c, fog: true });
    const floatMesh = new Mesh(new CylinderGeometry(0.42, 0.5, 0.28, 16), inkMat);
    const cage = new LineSegments(new EdgesGeometry(new CylinderGeometry(0.06, 0.34, 1.25, 4, 3, true)), new LineBasicMaterial({ color: 0x55605c, fog: true }));
    cage.position.y = 0.76;
    const bell = new Mesh(new SphereGeometry(0.13, 12, 8), inkMat);
    bell.position.y = 0.62;
    this.buoyLight = new Mesh(new SphereGeometry(0.06, 10, 8), new MeshBasicMaterial({ color: 0xf6d38c, fog: true }));
    this.buoyLight.position.y = 1.45;
    this.buoy.add(floatMesh, cage, bell, this.buoyLight);
    this.scene.add(this.buoy);

    // The river overlay is drawn last, over the sea.
    const river = backgroundMesh(RIVER, uniforms);
    river.renderOrder = 10;
    river.material.transparent = true;
    this.scene.add(river);

    this.camera.position.set(0, 2.3, 9);
    this.camera.lookAt(0, 0.35, -12);
    this.tier = env.tier;
    this.setNight(env.night);
    this.resize(env.width, env.height);
  }

  private oceanGeometry(tier: Tier) {
    const seg = tier >= 3 ? 220 : tier === 2 ? 150 : 96;
    const g = new PlaneGeometry(160, 160, seg, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -60);
    return g;
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    // Portrait screens: widen the field so the horizon stays readable.
    this.camera.fov = w / h < 0.8 ? 58 : 42;
    this.camera.updateProjectionMatrix();
    (this.u.uRes.value as { set(x: number, y: number): void }).set(w, h);
  }

  setNight(night: boolean) {
    this.palette.apply(night);
    this.u.uNight.value = night ? 1 : 0;
    this.fog.color.setRGB(...rgb(night ? 0x0f1722 : 0xece9e1));
    const ink = night ? 0x020305 : 0x55605c;
    this.buoy.traverse((o) => {
      const m = (o as Mesh).material as MeshBasicMaterial | undefined;
      if (m && o !== this.buoyLight) m.color.setRGB(...rgb(ink));
    });
    this.u.uSunDir.value.set(night ? -0.3 : 0.4, 0.28, -1);
  }

  setTier(tier: Tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    const old = this.ocean.geometry;
    this.ocean.geometry = this.oceanGeometry(tier);
    old.dispose();
  }

  /** Height and slope of the swell at (x, z), matching the vertex shader. Writes into `swellOut`. */
  private readonly swellOut = { y: 0, sx: 0, sz: 0 };
  private sample(x: number, z: number, t: number, swell: number) {
    let y = 0;
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < WAVE_TABLE.length; i += 5) {
      const dx = WAVE_TABLE[i]!;
      const dz = WAVE_TABLE[i + 1]!;
      const q = WAVE_TABLE[i + 2]!;
      const k = WAVE_TABLE[i + 3]!;
      const c = WAVE_TABLE[i + 4]!;
      const f = k * (dx * x + dz * z - c * t);
      y += (q / k) * swell * Math.sin(f);
      sx += dx * q * swell * Math.cos(f);
      sz += dz * q * swell * Math.cos(f);
    }
    this.swellOut.y = y;
    this.swellOut.sx = sx;
    this.swellOut.sz = sz;
  }

  update(t: number, dt: number, r: Reading) {
    writeCommon(this.u, t, r);
    const u = this.u;
    const mv = r.movement;
    // River at the opening of movement I, giving way to the sea.
    const riverWant = mv <= 1 && this.targets.sea < 0.5 ? (mv === 0 ? 0.6 : 1 - smoothstep(0.18, 0.42, r.progress)) : 0;
    u.uRiver.value = damp(u.uRiver.value, riverWant, dt, 1.4);
    const fogWant = 0.018 + this.targets.fog * 0.05 + (mv === 2 || mv === 3 ? 0.012 : 0);
    u.uFog.value = damp(u.uFog.value, fogWant, dt, 2.0);
    this.fog.density = u.uFog.value;
    u.uShrine.value = damp(u.uShrine.value, Math.max(this.targets.shrine, mv === 4 ? 0.6 : 0), dt, 1.6);
    u.uSwell.value = damp(u.uSwell.value, mv === 4 ? 0.6 : mv === 5 ? 0.75 : 1, dt, 3.0);

    // Buoy rides the swell.
    const bt = t * 0.55;
    this.sample(this.buoyPos.x, this.buoyPos.z, bt, u.uSwell.value);
    const sw = this.swellOut;
    this.buoy.position.set(this.buoyPos.x, sw.y - 0.08, this.buoyPos.z);
    this.buoy.rotation.set(sw.sz * 0.6, 0, -sw.sx * 0.6);
    // The lamp breathes slowly (a 7-second period): never a flicker.
    const f = 0.5 + 0.5 * Math.sin(t * 0.9);
    const e = f * f;
    const night = this.u.uNight.value > 0.5;
    const a = night ? LAMP.nightOff : LAMP.vellumOff;
    const b = night ? LAMP.nightOn : LAMP.vellumOn;
    this.buoyLight.material.color.setRGB(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e);
  }

  cue(name: string, on: boolean) {
    if (name === "fog") this.targets.fog = on ? 1 : 0;
    else if (name === "shrine") this.targets.shrine = on ? 1 : 0;
    else if (name === "sea") this.targets.sea = on ? 1 : this.targets.sea;
    else if (name === "bell") this.targets.bell = on ? 1 : 0;
  }

  dispose() {
    disposeTree(this.scene);
  }
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createScene(): StageScene {
  return new WaterScene();
}
