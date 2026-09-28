/**
 * The Still Point. Four elemental orbits turn slowly around a luminous centre, set
 * in the order of the medieval sublunary spheres — earth innermost, then water, air
 * and fire — like an armillary sphere drawn in a manuscript margin. A faint axis
 * runs through the still point. Cues: `ring{i}` highlights an orbit, `enter{i}`
 * draws the eye into it before navigation.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import { PARTICLES } from "../quality";
import { disposeTree, rgb, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, seeded, writeCommon } from "./base";
import { RINGS } from "./home-geometry";

const PER_RING = 2600;

const BG = /* glsl */ `
uniform vec3 cPaper, cInk, cGlow;
uniform float uCentre;
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  vec3 col = cPaper;
  float r = length(p);
  // The still point: a soft light that neither pulses fast nor moves.
  float glow = exp(-r * r * 60.0) * 0.9 + exp(-r * r * 6.0) * 0.22;
  col = mix(col, cGlow, glow * uCentre);
  col = mix(col, cInk, 0.1 * smoothstep(0.45, 1.2, r));
  gl_FragColor = vec4(col, 1.0);
}
`;

const RING_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uRadius, uSpeed, uSize, uHi, uTilt;
varying float vAlpha;
void main(){
  float th = aSeed.x * 6.2831853 + uTime * uSpeed;
  float r = uRadius * (1.0 + (aSeed.y - 0.5) * 0.045);
  vec3 p = vec3(cos(th) * r, (aSeed.z - 0.5) * 0.05 * uRadius, sin(th) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.75 + 0.25 * sin(uTime * 0.4 + aSeed.w * 30.0);
  vAlpha = (0.35 + 0.65 * aSeed.w) * twinkle * (0.55 + 0.45 * uHi);
  gl_PointSize = uSize * (0.5 + aSeed.w) * (1.0 + 0.5 * uHi) * (7.0 / max(1.0, -mv.z));
}
`;

const RING_FRAG = /* glsl */ `
uniform vec3 cRing;
uniform float uAlpha;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d);
  gl_FragColor = vec4(cRing, a * vAlpha * uAlpha);
}
`;

class HomeScene implements StageScene {
  readonly key = "home";
  readonly renderScale = 0.9;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 100);
  private palette = new Palette(
    { cPaper: 0xf4eee1, cInk: 0x3a3226, cGlow: 0xfff1c9 },
    { cPaper: 0x0b0d15, cInk: 0x020306, cGlow: 0x6a5530 },
  );
  private u = { ...commonUniforms(), uCentre: { value: 1 } };
  private rings: Array<{ group: Group; mat: ShaderMaterial; points: Points; hi: number; hiTarget: number }> = [];
  private axis!: Line;
  private enter = -1;
  private enterT = 0;
  private readonly look = new Vector3();
  private readonly camHome = new Vector3(0, 1.1, 9.2);
  private readonly camTarget = new Vector3();

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    this.scene.add(backgroundMesh(BG, { ...this.u, ...this.palette.uniforms }));
    const rnd = seeded(1943);
    RINGS.forEach((ring, i) => {
      const seeds = new Float32Array(PER_RING * 4);
      for (let k = 0; k < seeds.length; k++) seeds[k] = rnd();
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(PER_RING * 3), 3));
      g.setAttribute("aSeed", new BufferAttribute(seeds, 4));
      const mat = new ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uTime: this.u.uTime,
          uRadius: { value: ring.radius },
          uSpeed: { value: ring.speed },
          uSize: { value: 2.4 },
          uHi: { value: 0 },
          uAlpha: { value: 1 },
          cRing: { value: new Vector3() },
          uTilt: { value: 0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const points = new Points(g, mat);
      points.frustumCulled = false;
      const group = new Group();
      group.rotation.set(ring.tiltX, 0, ring.tiltZ);
      group.add(points);
      this.scene.add(group);
      this.rings.push({ group, mat, points, hi: 0, hiTarget: 0 });
      void i;
    });
    // The still axis.
    const axisGeo = new BufferGeometry().setFromPoints([new Vector3(0, -2.3, 0), new Vector3(0, 2.3, 0)]);
    this.axis = new Line(axisGeo, new LineBasicMaterial({ transparent: true, opacity: 0.25 }));
    this.scene.add(this.axis);
    this.camera.position.copy(this.camHome);
    this.camera.lookAt(0, 0, 0);
    this.setNight(env.night);
    this.setTier(env.tier);
    this.resize(env.width, env.height);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    // Portrait: pull back so all four orbits fit.
    this.camHome.set(0, 1.1, w / h < 0.9 ? 15.5 : 9.2);
    if (this.enter < 0) this.camera.position.copy(this.camHome);
    this.camera.updateProjectionMatrix();
    (this.u.uRes.value as { set(x: number, y: number): void }).set(w, h);
    const size = Math.max(2, Math.min(3.6, Math.min(w, h) / 280)) * Math.min(window.devicePixelRatio || 1, 2) * 0.75;
    for (const r of this.rings) r.mat.uniforms.uSize!.value = size;
  }

  setNight(night: boolean) {
    this.palette.apply(night);
    this.u.uNight.value = night ? 1 : 0;
    RINGS.forEach((ring, i) => {
      const m = this.rings[i]!.mat;
      (m.uniforms.cRing!.value as Vector3).set(...rgb(night ? ring.night : ring.vellum));
      m.uniforms.uAlpha!.value = night ? 0.95 : 0.8;
      m.blending = night ? AdditiveBlending : NormalBlending;
      m.needsUpdate = true;
    });
    (this.axis.material as LineBasicMaterial).color.setRGB(...rgb(night ? 0x6a5a38 : 0x9c8454));
  }

  setTier(tier: Tier) {
    for (const r of this.rings) r.points.geometry.setDrawRange(0, Math.round(PER_RING * Math.max(0.45, PARTICLES[tier])));
  }

  update(t: number, dt: number, r: Reading) {
    writeCommon(this.u, t, r);
    for (const ring of this.rings) {
      ring.hi = damp(ring.hi, ring.hiTarget, dt, 0.35);
      ring.mat.uniforms.uHi!.value = ring.hi;
    }
    if (this.enter >= 0) {
      // Fly toward the chosen orbit.
      this.enterT = Math.min(1, this.enterT + dt / 1.2);
      const e = this.enterT * this.enterT * (3 - 2 * this.enterT);
      const ring = RINGS[this.enter]!;
      this.camTarget.set(ring.radius * 0.9, ring.radius * 0.2, ring.radius * 0.6 + 1.6);
      this.camera.position.lerpVectors(this.camHome, this.camTarget, e);
      this.look.set(ring.radius * 0.5 * e, 0, 0);
      this.camera.lookAt(this.look);
    }
  }

  cue(name: string, on: boolean) {
    const m = /^(ring|enter)(\d)$/.exec(name);
    if (!m) return;
    const i = Number(m[2]);
    if (m[1] === "ring") {
      this.rings.forEach((r, k) => (r.hiTarget = on && k === i ? 1 : 0));
    } else if (on) {
      this.enter = i;
      this.enterT = 0;
    }
  }

  dispose() {
    disposeTree(this.scene);
  }
}

export function createScene(): StageScene {
  return new HomeScene();
}
