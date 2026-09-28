/**
 * Little Gidding · fire. Embers rise; in movement I a low midwinter sun blazes on
 * ice; particles flock into a dove — dark and ember-edged at the dawn after the raid
 * (II), pale and descending in the lyric (IV) — and at the close they gather into a
 * rose, where fire and rose become one shape.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, OrthographicCamera, Points, Scene, ShaderMaterial } from "three";
import { NOISE } from "../glsl";
import { PARTICLES } from "../quality";
import { disposeTree, type Reading, type SceneEnv, type StageScene, type Tier } from "../types";
import { Palette, backgroundMesh, commonUniforms, damp, seeded, writeCommon } from "./base";

const MAX = 5200;

const BG = /* glsl */ `
uniform vec3 cPaper, cInk, cSky, cSun, cIce, cEmberGlow, cRose;
uniform float uMidwinter, uRoseMix, uRaid;
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float t = uTime;
  vec3 col = mix(cPaper, cSky, smoothstep(-0.2, 0.5, p.y) * 0.5);

  // Low midwinter sun and its glare on the ice.
  vec2 sp = p - vec2(-0.28 * aspect, -0.08);
  float sun = exp(-dot(sp, sp) * 38.0) * uMidwinter;
  float glare = exp(-dot(sp * vec2(0.35, 2.8), sp * vec2(0.35, 2.8)) * 10.0) * uMidwinter;
  col = mix(col, cSun, clamp(sun * 0.9 + glare * 0.35, 0.0, 1.0));
  float ice = smoothstep(-0.1, -0.16, p.y) * uMidwinter;
  col = mix(col, cIce, ice * 0.35);
  // Glints on the ice: they swell and fade slowly (no flicker).
  vec2 g = p * vec2(26.0, 70.0);
  float glint = smoothstep(0.78, 0.98, snoise(vec3(g, t * 0.18))) * ice;
  col = mix(col, cSun, glint * 0.7);

  // Ember glow from below; the raid in movement II reddens the sky.
  float below = smoothstep(0.1, -0.55, p.y);
  col = mix(col, cEmberGlow, below * (0.18 + 0.3 * uRaid));
  // Finale: the whole field warms toward rose.
  col = mix(col, cRose, uRoseMix * 0.12 * (1.0 - length(p)));
  col = mix(col, cInk, 0.08 * smoothstep(0.55, 1.25, length(p)));
  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `
${NOISE}
attribute vec4 aSeed;
attribute vec3 aDove;
attribute vec3 aRose;
uniform float uTime, uAspect, uSize, uDove, uDoveY, uRose, uDark, uRaid, uEmberAlpha;
uniform vec3 cEmber1, cEmber2, cDoveLight, cDoveDark, cPetal, cGold;
varying vec3 vColor;
varying float vAlpha;

void main(){
  // Free embers rise and drift.
  float life = fract(uTime * (0.025 + 0.045 * aSeed.z) + aSeed.w);
  vec2 ember = vec2((aSeed.x - 0.5) * 2.2 * uAspect, -1.1 + life * 2.35);
  ember.x += 0.16 * snoise(vec2(aSeed.y * 9.0, uTime * 0.07 + life * 2.2));
  float emberA = sin(3.14159 * life) * (0.35 + 0.65 * aSeed.z) * (0.7 + 0.6 * uRaid) * uEmberAlpha;

  // The dove, flocking into shape (swirl strongest mid-formation). The remap makes
  // the shape lock exactly into place well before the eased uniform reaches 1.
  float form = smoothstep(0.0, 0.85, uDove);
  float roseF = smoothstep(0.0, 0.85, uRose);
  vec2 dove = aDove.xy * 0.62 + vec2(0.25 * uAspect, 0.28 + uDoveY);
  float swirl = sin(3.14159 * form) * 0.25;
  dove += swirl * vec2(snoise(vec2(aSeed.x * 5.0, uTime * 0.12)), snoise(vec2(aSeed.y * 5.0, uTime * 0.12 + 4.0)));
  dove += vec2(0.004, 0.006) * sin(uTime * 0.7 + aSeed.x * 6.0);

  // The rose, turning very slowly.
  float ang = uTime * 0.03;
  vec2 rr = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * aRose.xy;
  vec2 rose = rr * 0.72 + vec2(0.0, 0.04);

  vec2 pos = mix(ember, dove, form);
  pos = mix(pos, rose, roseF);

  vec3 emberCol = mix(cEmber1, cEmber2, aSeed.z);
  vec3 doveCol = mix(cDoveLight, cDoveDark, uDark);
  vec3 roseCol = mix(cGold, cPetal, smoothstep(0.1, 0.7, aRose.z));
  vec3 c = mix(emberCol, doveCol, form);
  vColor = mix(c, roseCol, roseF);
  float shapeA = 0.55 + 0.45 * aSeed.z;
  vAlpha = mix(emberA, shapeA, max(form, roseF));
  gl_Position = vec4(pos.x / uAspect, pos.y, 0.0, 1.0);
  gl_PointSize = uSize * (0.6 + aSeed.z * 0.8) * mix(1.35, 1.05, max(form, roseF));
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

/**
 * The descending dove of the iconography (head down, wings raised), traced mostly
 * along its outlines so it reads as a drawn emblem; symmetric about the y axis.
 * x right, y up, roughly 1.3 wide.
 */
function dovePoints(n: number, rnd: () => number): Float32Array {
  const out = new Float32Array(n * 3);
  type P = [number, number];
  const wing: P[] = [
    [-0.05, 0.06], [-0.2, 0.2], [-0.38, 0.34], [-0.56, 0.44], [-0.66, 0.43],
    [-0.6, 0.36], [-0.64, 0.32], [-0.56, 0.27], [-0.58, 0.22], [-0.48, 0.18],
    [-0.48, 0.13], [-0.36, 0.1], [-0.3, 0.04], [-0.16, -0.01], [-0.06, -0.04],
  ];
  const tail: P[] = [[-0.07, 0.2], [-0.17, 0.42], [-0.08, 0.38], [0, 0.44], [0.08, 0.38], [0.17, 0.42], [0.07, 0.2]];
  const polylines: P[][] = [wing, wing.map(([x, y]) => [-x, y] as P), tail];
  const segs: Array<[P, P, number]> = [];
  let total = 0;
  for (const pl of polylines) {
    for (let i = 0; i < pl.length; i++) {
      const a = pl[i]!;
      const b = pl[(i + 1) % pl.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push([a, b, len]);
      total += len;
    }
  }
  const onOutline = (): P => {
    let d = rnd() * total;
    for (const [a, b, len] of segs) {
      if (d <= len) {
        const t = d / len;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      d -= len;
    }
    return [0, 0];
  };
  for (let i = 0; i < n; i++) {
    const pick = rnd();
    let x: number;
    let y: number;
    if (pick < 0.55) {
      [x, y] = onOutline();
    } else if (pick < 0.8) {
      // Body (vertical ellipse) outline and head, pointing down.
      const a = rnd() * Math.PI * 2;
      if (rnd() < 0.7) {
        x = Math.cos(a) * 0.075;
        y = 0.04 + Math.sin(a) * 0.2;
      } else {
        x = Math.cos(a) * 0.06;
        y = -0.22 + Math.sin(a) * 0.06;
      }
    } else {
      // Light fill of the wings for body.
      const [ox, oy] = onOutline();
      const k = 0.35 + 0.6 * rnd();
      x = ox * k;
      y = oy * k + 0.02 * (1 - k);
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = rnd();
  }
  return out;
}

/**
 * A heraldic rose drawn in points, as in a manuscript margin: five outer petals, five
 * inner petals set between them, and a seeded centre. Points trace each petal ring's
 * outer boundary (with a little fill for glow); categories are interleaved so a lower
 * quality tier (a shorter draw range) still draws the whole flower.
 * z carries depth for colour: 0 centre … 1 outer petals.
 */
function rosePoints(n: number, rnd: () => number): Float32Array {
  const out = new Float32Array(n * 3);
  const ring = (count: number, dist: number, rad: number, rot: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = rot + (i / count) * Math.PI * 2;
      return { x: Math.cos(a) * dist, y: Math.sin(a) * dist, r: rad };
    });
  const outer = ring(5, 0.46, 0.34, -Math.PI / 2);
  const inner = ring(5, 0.24, 0.2, -Math.PI / 2 + Math.PI / 5);
  const inside = (x: number, y: number, cs: Array<{ x: number; y: number; r: number }>, skip: number) =>
    cs.some((c, j) => j !== skip && (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r * 0.985);
  const boundary = (cs: Array<{ x: number; y: number; r: number }>): [number, number] => {
    for (let tries = 0; tries < 60; tries++) {
      const j = Math.floor(rnd() * cs.length);
      const c = cs[j]!;
      const a = rnd() * Math.PI * 2;
      const x = c.x + Math.cos(a) * c.r;
      const y = c.y + Math.sin(a) * c.r;
      if (!inside(x, y, cs, j)) return [x, y];
    }
    return [0, 0];
  };
  for (let i = 0; i < n; i++) {
    const pick = rnd();
    let x: number;
    let y: number;
    let z: number;
    if (pick < 0.46) {
      [x, y] = boundary(outer);
      z = 1;
    } else if (pick < 0.76) {
      [x, y] = boundary(inner);
      z = 0.6;
    } else if (pick < 0.88) {
      // Seeds in the centre.
      const a = rnd() * Math.PI * 2;
      const r = 0.09 * Math.sqrt(rnd());
      x = Math.cos(a) * r;
      y = Math.sin(a) * r;
      z = 0.15;
    } else {
      // Soft fill inside the outer petals, for glow.
      const c = outer[Math.floor(rnd() * 5)]!;
      const a = rnd() * Math.PI * 2;
      const r = c.r * Math.sqrt(rnd()) * 0.9;
      x = c.x + Math.cos(a) * r;
      y = c.y + Math.sin(a) * r;
      z = 0.85;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

class FireScene implements StageScene {
  readonly key = "fire";
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  private palette = new Palette(
    {
      cPaper: 0xf4eee1,
      cInk: 0x3a2a22,
      cSky: 0xefe9e0,
      cSun: 0xfff3d8,
      cIce: 0xdfe7e8,
      cEmberGlow: 0xefc29a,
      cRose: 0xe7b4b0,
      cEmber1: 0xc7582a,
      cEmber2: 0xe0923f,
      cDoveLight: 0x8b95a6,
      cDoveDark: 0x5a3a2c,
      cGold: 0xc9a14a,
      cPetal: 0xb5475f,
    },
    {
      cPaper: 0x0b0d15,
      cInk: 0x020203,
      cSky: 0x0d0f18,
      cSun: 0x4a2a14,
      cIce: 0x111a22,
      cEmberGlow: 0x3a1206,
      cRose: 0x3a1018,
      cEmber1: 0xf0773a,
      cEmber2: 0xffb45e,
      cDoveLight: 0xe8e2d4,
      cDoveDark: 0xa34a24,
      cGold: 0xf2c46a,
      cPetal: 0xe88a98,
    },
  );
  private u = {
    ...commonUniforms(),
    uMidwinter: { value: 0 },
    uRoseMix: { value: 0 },
    uRaid: { value: 0 },
  };
  private mat!: ShaderMaterial;
  private points!: Points;
  private targets = { midwinter: 0, darkdove: 0, dove: 0, rose: 0 };
  private dove = { form: 0, y: 0, dark: 0 };

  paper(night: boolean) {
    return night ? 0x0b0d15 : 0xf4eee1;
  }

  init(env: SceneEnv) {
    const uniforms = { ...this.u, ...this.palette.uniforms };
    this.scene.add(backgroundMesh(BG, uniforms));
    const rnd = seeded(1942);
    const seeds = new Float32Array(MAX * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute("aSeed", new BufferAttribute(seeds, 4));
    g.setAttribute("aDove", new BufferAttribute(dovePoints(MAX, rnd), 3));
    g.setAttribute("aRose", new BufferAttribute(rosePoints(MAX, rnd), 3));
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: this.u.uTime,
        uAspect: { value: 1 },
        uSize: { value: 2.5 },
        uDove: { value: 0 },
        uDoveY: { value: 0 },
        uRose: { value: 0 },
        uDark: { value: 0 },
        uRaid: this.u.uRaid,
        uEmberAlpha: { value: 1 },
        cEmber1: this.palette.uniforms.cEmber1,
        cEmber2: this.palette.uniforms.cEmber2,
        cDoveLight: this.palette.uniforms.cDoveLight,
        cDoveDark: this.palette.uniforms.cDoveDark,
        cPetal: this.palette.uniforms.cPetal,
        cGold: this.palette.uniforms.cGold,
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.setNight(env.night);
    this.setTier(env.tier);
    this.resize(env.width, env.height);
  }

  resize(w: number, h: number) {
    (this.u.uRes.value as { set(x: number, y: number): void }).set(w, h);
    this.mat.uniforms.uAspect!.value = w / h;
    this.mat.uniforms.uSize!.value = Math.max(1.8, Math.min(3.4, Math.min(w, h) / 320)) * Math.min(window.devicePixelRatio || 1, 2) * 0.85;
  }

  setNight(night: boolean) {
    this.palette.apply(night);
    this.u.uNight.value = night ? 1 : 0;
    this.mat.blending = night ? AdditiveBlending : NormalBlending;
    // On vellum, embers are faint sparks rather than a scatter of ink.
    this.mat.uniforms.uEmberAlpha!.value = night ? 1 : 0.42;
    this.mat.needsUpdate = true;
  }

  setTier(tier: Tier) {
    this.points.geometry.setDrawRange(0, Math.round(MAX * PARTICLES[tier]));
  }

  update(t: number, dt: number, r: Reading) {
    writeCommon(this.u, t, r);
    const mv = r.movement;
    const u = this.u;
    u.uMidwinter.value = damp(u.uMidwinter.value, Math.max(this.targets.midwinter, mv <= 1 ? 0.6 : 0), dt, 1.6);
    u.uRaid.value = damp(u.uRaid.value, this.targets.darkdove || (mv === 2 ? 0.5 : 0), dt, 1.6);
    const doveWant = Math.max(this.targets.dove, this.targets.darkdove * 0.9);
    this.dove.form = damp(this.dove.form, this.targets.rose ? 0 : doveWant, dt, 1.4);
    this.dove.dark = damp(this.dove.dark, this.targets.darkdove && !this.targets.dove ? 1 : 0, dt, 1.2);
    // The dove descends slowly while its cue is active.
    const descending = this.targets.dove ? -0.25 * Math.min(1, r.progress * 1.4) : 0;
    this.dove.y = damp(this.dove.y, descending, dt, 3.0);
    const m = this.mat.uniforms;
    m.uDove!.value = this.dove.form;
    m.uDoveY!.value = this.dove.y;
    m.uDark!.value = this.dove.dark;
    const roseWant = this.targets.rose || (mv === 5 && r.progress > 0.9 ? 1 : 0);
    m.uRose!.value = damp(m.uRose!.value as number, roseWant, dt, 1.8);
    u.uRoseMix.value = m.uRose!.value as number;
  }

  cue(name: string, on: boolean) {
    if (name === "midwinter") this.targets.midwinter = on ? 1 : 0;
    else if (name === "darkdove") this.targets.darkdove = on ? 1 : 0;
    else if (name === "dove") this.targets.dove = on ? 1 : 0;
    else if (name === "rose") this.targets.rose = on ? 1 : 0;
  }

  dispose() {
    disposeTree(this.scene);
  }
}

export function createScene(): StageScene {
  return new FireScene();
}
