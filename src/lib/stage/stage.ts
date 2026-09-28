/**
 * The Stage: one WebGL renderer for the whole visit (it lives in a persisted element
 * across client-side navigations). Background scenes render into a reduced-resolution
 * target; a full-resolution blit upscales them and enforces the luminance band that
 * keeps text contrast ≥ WCAG AA; tile transitions draw last at full resolution.
 */
import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FULLSCREEN_VERT } from "./glsl";
import { QualityGovernor, RENDER_SCALE, initialTier } from "./quality";
import { TileLayer } from "./tiles";
import { rgb, type Reading, type StageScene, type Tier } from "./types";

type SceneFactory = () => Promise<{ createScene(): StageScene }>;
const SCENES: Record<string, SceneFactory> = {
  air: () => import("./scenes/air"),
  earth: () => import("./scenes/earth"),
  water: () => import("./scenes/water"),
  fire: () => import("./scenes/fire"),
  home: () => import("./scenes/home"),
};
export const hasScene = (key: string) => key in SCENES;

const BLIT_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uNight;
uniform vec4 uStrict;   // x0, x1, feather (css px), enabled
uniform vec3 uPaper;
uniform float uFade;
uniform float uTime;
varying vec2 vUv;

vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float lum(vec3 lin){ return dot(lin, vec3(0.2126, 0.7152, 0.0722)); }

void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  float px = vUv.x * uRes.x;
  float inCol = uStrict.w * smoothstep(uStrict.x - uStrict.z, uStrict.x, px) * (1.0 - smoothstep(uStrict.y, uStrict.y + uStrict.z, px));
  vec3 lin = toLin(c);
  vec3 paper = toLin(uPaper);
  float L = lum(lin);
  float Lp = lum(paper);
  if (uNight < 0.5) {
    // Vellum: the scene may never darken the page below this luminance.
    float minL = mix(0.40, 0.74, inCol);
    if (L < minL) lin = mix(lin, paper, clamp((minL - L) / max(Lp - L, 1e-3), 0.0, 1.0));
  } else {
    // Night: the scene may never brighten the page above this luminance.
    float maxL = mix(0.22, 0.025, inCol);
    if (L > maxL) lin = mix(lin, paper, clamp((L - maxL) / max(L - Lp, 1e-3), 0.0, 1.0));
  }
  c = toSrgb(lin);
  // A breath of grain so gradients never band (static in time: no shimmer).
  float g = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += g * 0.012;
  gl_FragColor = vec4(mix(uPaper, c, uFade), 1.0);
}
`;

export interface StageOptions {
  night: boolean;
  still?: { time: number } | null;
}

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly reading: Reading = { quartet: "", movement: 0, progress: 0, global: 0, scroll: 0 };
  readonly tiles: TileLayer;
  night: boolean;
  tier: Tier;

  private rt: WebGLRenderTarget;
  private blitScene = new Scene();
  private blitCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blitMat: ShaderMaterial;
  private current: StageScene | null = null;
  private key: string | null = null;
  private loading: string | null = null;
  private raf = 0;
  private running = false;
  private last = 0;
  private readonly t0 = performance.now();
  private width = 1;
  private height = 1;
  private dpr = 1;
  private fade = 0;
  private fadeTarget = 0;
  private governor: QualityGovernor;
  private readonly still: { time: number } | null;
  private stillFrames = 0;
  private strict = new Vector4(0, 0, 0, 0);
  private resizeTimer = 0;
  private lost = false;
  onFirstFrame: (() => void) | null = null;
  onLost: (() => void) | null = null;

  static supported(): boolean {
    try {
      const c = document.createElement("canvas");
      return !!c.getContext("webgl2");
    } catch {
      return false;
    }
  }

  constructor(host: HTMLElement, opts: StageOptions) {
    this.night = opts.night;
    this.still = opts.still ?? null;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    host.prepend(this.canvas);
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: !!this.still,
    });
    this.renderer.autoClear = true;
    this.tier = this.still ? 3 : initialTier();
    this.governor = new QualityGovernor(this.tier, (t) => this.setTier(t), !!this.still);

    this.rt = new WebGLRenderTarget(4, 4, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true });
    this.blitMat = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLIT_FRAG,
      uniforms: {
        tScene: { value: this.rt.texture },
        uRes: { value: new Vector2(1, 1) },
        uNight: { value: this.night ? 1 : 0 },
        uStrict: { value: this.strict },
        uPaper: { value: new Vector3(...rgb(this.night ? 0x0b0d15 : 0xf4eee1)) },
        uFade: { value: 0 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.blitMat);
    quad.frustumCulled = false;
    this.blitScene.add(quad);
    this.tiles = new TileLayer();

    this.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.measure();
  }

  // ------------------------------------------------------------------ scenes

  get sceneKey() {
    return this.key;
  }

  async setScene(key: string | null): Promise<void> {
    if (key === this.key || key === this.loading) return;
    if (!key || !hasScene(key)) {
      this.fadeTarget = 0;
      this.loading = null;
      window.setTimeout(() => {
        if (this.key && this.fadeTarget === 0) this.disposeCurrent();
      }, 700);
      this.key = null;
      return;
    }
    this.loading = key;
    // Fade the old scene out while the new one loads.
    this.fadeTarget = 0;
    const mod = await SCENES[key]!();
    if (this.loading !== key) return;
    const next = mod.createScene();
    await next.init({ renderer: this.renderer, width: this.width, height: this.height, night: this.night, tier: this.tier, still: !!this.still });
    if (this.loading !== key) {
      next.dispose();
      return;
    }
    // Compile before the swap so the first visible frame does not stall.
    try {
      await this.renderer.compileAsync(next.scene, next.camera);
    } catch {
      /* compileAsync unsupported: compile on first render */
    }
    this.disposeCurrent();
    this.current = next;
    this.key = key;
    this.loading = null;
    next.resize(this.width, this.height);
    this.setPaper();
    this.fade = this.still ? 1 : 0;
    this.fadeTarget = 1;
    this.stillFrames = 0;
    this.start();
  }

  private disposeCurrent() {
    if (!this.current) return;
    this.current.dispose();
    this.current = null;
    this.renderer.renderLists.dispose();
  }

  cue(name: string, on: boolean) {
    this.current?.cue(name, on);
  }

  setNight(night: boolean) {
    if (night === this.night) return;
    this.night = night;
    this.blitMat.uniforms.uNight!.value = night ? 1 : 0;
    this.setPaper();
    this.current?.setNight(night);
    this.tiles.setNight(night);
  }

  private setPaper() {
    const hex = this.current ? this.current.paper(this.night) : this.night ? 0x0b0d15 : 0xf4eee1;
    (this.blitMat.uniforms.uPaper!.value as Vector3).set(...rgb(hex));
  }

  /** The horizontal band (CSS px) where text sits; contrast is enforced most strictly there. */
  setTextBand(x0: number, x1: number, enabled: boolean) {
    this.strict.set(x0 * this.dpr, x1 * this.dpr, 220 * this.dpr, enabled ? 1 : 0);
  }

  private setTier(t: Tier) {
    this.tier = t;
    this.applySize();
    this.current?.setTier(t);
  }

  // ------------------------------------------------------------------ size

  private measure() {
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.applySize();
  }

  private applySize() {
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
    const s = this.still ? 0.9 : RENDER_SCALE[this.tier];
    this.rt.setSize(Math.max(2, Math.round(this.width * this.dpr * s)), Math.max(2, Math.round(this.height * this.dpr * s)));
    (this.blitMat.uniforms.uRes!.value as Vector2).set(this.width * this.dpr, this.height * this.dpr);
    this.current?.resize(this.width, this.height);
    this.tiles.resize(this.width, this.height);
  }

  private onResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Mobile URL bars change the height constantly; ignore small height-only changes.
      if (w === this.width && Math.abs(h - this.height) < 140) return;
      this.measure();
    }, 160);
  };

  // ------------------------------------------------------------------ loop

  start() {
    if (this.running || this.lost || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else if (this.current || this.tiles.active) this.start();
  };

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.governor.sample(dt * 1000, now);
    const t = this.still ? this.still.time : (now - this.t0) / 1000;

    // Ease the fade (τ ≈ 0.45 s) and the scroll speed.
    const k = 1 - Math.exp(-dt / 0.45);
    this.fade += (this.fadeTarget - this.fade) * k;
    this.reading.scroll *= Math.exp(-dt / 0.6);

    const r = this.renderer;
    const u = this.blitMat.uniforms;
    u.uFade!.value = this.fade;
    u.uTime!.value = t;

    if (this.current) {
      this.current.update(t, dt, this.reading);
      r.setRenderTarget(this.rt);
      r.render(this.current.scene, this.current.camera);
    }
    r.setRenderTarget(null);
    r.render(this.blitScene, this.blitCam);
    if (this.tiles.active) {
      r.autoClear = false;
      this.tiles.update(t, dt);
      r.render(this.tiles.scene, this.blitCam);
      r.autoClear = true;
    }

    if (this.current && this.onFirstFrame && this.fade > 0.05) {
      const cb = this.onFirstFrame;
      this.onFirstFrame = null;
      cb();
    }
    if (this.still && this.current) {
      this.stillFrames++;
      if (this.stillFrames === 6) (window as unknown as { __stillReady?: boolean }).__stillReady = true;
    }
    // Nothing left to draw: rest.
    if (!this.current && !this.tiles.active && this.fade < 0.002 && this.fadeTarget === 0) this.stop();
  };

  // ------------------------------------------------------------------ context loss

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.stop();
    this.onLost?.();
  };

  private onContextRestored = () => {
    this.lost = false;
    const key = this.key;
    this.disposeCurrent();
    this.key = null;
    if (key) void this.setScene(key);
  };

  get frameMs() {
    return this.governor.frameMs;
  }

  destroy() {
    this.stop();
    this.disposeCurrent();
    this.tiles.dispose();
    this.rt.dispose();
    this.blitMat.dispose();
    this.renderer.dispose();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.remove();
  }
}
