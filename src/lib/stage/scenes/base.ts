import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, type IUniform } from "three";
import { COMMON_UNIFORMS, FULLSCREEN_VERT, NOISE } from "../glsl";
import { rgb, type Reading } from "../types";

export type Uniforms = Record<string, IUniform>;

/** Frame-rate independent exponential approach (no allocation). */
export const damp = (cur: number, target: number, dt: number, tau: number) => cur + (target - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));

export function commonUniforms(): Uniforms {
  return {
    uTime: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    uNight: { value: 0 },
    uMovement: { value: 0 },
    uProgress: { value: 0 },
    uGlobal: { value: 0 },
    uScroll: { value: 0 },
  };
}

export function writeCommon(u: Uniforms, t: number, r: Reading) {
  u.uTime!.value = t;
  u.uMovement!.value = r.movement;
  u.uProgress!.value = r.progress;
  u.uGlobal!.value = r.global;
  u.uScroll!.value = r.scroll;
}

/** A full-screen quad drawn first (background painting in the fragment shader). */
export function backgroundMesh(fragBody: string, uniforms: Uniforms): Mesh<PlaneGeometry, ShaderMaterial> {
  const mat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: `precision highp float;\n${COMMON_UNIFORMS}\n${NOISE}\nvarying vec2 vUv;\n${fragBody}`,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** A palette uniform set: each key → vec3, switched per theme. */
export class Palette<K extends string> {
  readonly uniforms: Record<K, IUniform<Vector3>>;
  constructor(
    private readonly vellum: Record<K, number>,
    private readonly night: Record<K, number>,
  ) {
    this.uniforms = Object.fromEntries(Object.keys(vellum).map((k) => [k, { value: new Vector3() }])) as Record<K, IUniform<Vector3>>;
  }
  apply(isNight: boolean) {
    const src = isNight ? this.night : this.vellum;
    for (const k of Object.keys(src) as K[]) this.uniforms[k].value.set(...rgb(src[k]));
  }
}

/** Seeded random for stable layouts (stills must be reproducible). */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
