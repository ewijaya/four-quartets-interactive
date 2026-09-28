/**
 * Adaptive quality. An initial guess from the device, then a governor that watches
 * an exponential moving average of frame time and steps the tier up or down with
 * hysteresis. Tiers change draw ranges and resolution, never allocations.
 */
import type { Tier } from "./types";

export function initialTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 1;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  if (coarse && small) return 1;
  if ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4) return 1;
  return 2;
}

/** Render scale for background scenes, as a fraction of min(devicePixelRatio, 2). */
export const RENDER_SCALE: Record<Tier, number> = { 0: 0.5, 1: 0.5, 2: 0.66, 3: 0.8 };

/** Particle budget multiplier per tier. */
export const PARTICLES: Record<Tier, number> = { 0: 0.25, 1: 0.35, 2: 0.65, 3: 1 };

export class QualityGovernor {
  private ema = 16.7;
  private since = 0;
  private lastChange = 0;
  tier: Tier;
  constructor(
    tier: Tier,
    private readonly onChange: (t: Tier) => void,
    private readonly locked = false,
  ) {
    this.tier = tier;
  }

  /** Feed one frame duration (ms) at time `now` (ms). */
  sample(dt: number, now: number) {
    if (this.locked || dt <= 0 || dt > 250) return;
    this.ema += (dt - this.ema) * 0.05;
    if (now - this.lastChange < 1500) return;
    if (this.ema > 21 && this.tier > 1) {
      if (!this.since) this.since = now;
      if (now - this.since > 1200) this.set((this.tier - 1) as Tier, now);
    } else if (this.ema < 11 && this.tier < 3) {
      if (!this.since) this.since = now;
      if (now - this.since > 4000) this.set((this.tier + 1) as Tier, now);
    } else {
      this.since = 0;
    }
  }

  private set(t: Tier, now: number) {
    this.tier = t;
    this.lastChange = now;
    this.since = 0;
    this.onChange(t);
  }

  get frameMs() {
    return this.ema;
  }
}
