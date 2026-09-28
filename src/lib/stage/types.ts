import type { Camera, Material, Object3D, Scene, Texture, WebGLRenderer } from "three";

/** 0 = static still, 1 = low, 2 = medium, 3 = high. */
export type Tier = 0 | 1 | 2 | 3;

/** Mutable reading state, written by the scroll bindings and read every frame. */
export interface Reading {
  quartet: string;
  movement: number;
  progress: number;
  global: number;
  /** Smoothed scroll speed, 0…1. */
  scroll: number;
}

export interface SceneEnv {
  renderer: WebGLRenderer;
  width: number;
  height: number;
  night: boolean;
  tier: Tier;
  still: boolean;
}

export interface StageScene {
  readonly key: string;
  readonly scene: Scene;
  readonly camera: Camera;
  /** Background colour the scene is composited from (sRGB 0xRRGGBB), per theme. */
  paper(night: boolean): number;
  init(env: SceneEnv): Promise<void> | void;
  resize(width: number, height: number): void;
  setNight(night: boolean): void;
  setTier(tier: Tier): void;
  update(t: number, dt: number, reading: Reading): void;
  cue(name: string, on: boolean): void;
  dispose(): void;
}

/** Dispose every geometry, material and texture below a root. */
export function disposeTree(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as unknown as { geometry?: { dispose(): void }; material?: Material | Material[] };
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m as unknown as Record<string, unknown>)) {
        if (v && typeof v === "object" && (v as Texture).isTexture) (v as Texture).dispose();
      }
      const uniforms = (m as unknown as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      if (uniforms) {
        for (const u of Object.values(uniforms)) {
          const val = u.value as Texture | undefined;
          if (val && typeof val === "object" && val.isTexture) val.dispose();
        }
      }
      m.dispose();
    }
  });
}

/** sRGB hex → [r, g, b] in 0…1 (no colour management: shaders work in display space). */
export function rgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
