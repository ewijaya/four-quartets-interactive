/**
 * The soundscape: a generative drone for four voices, like a string quartet heard
 * through a wall — synthesised with the Web Audio API, no audio files.
 *
 * Each voice is a persistent pair of detuned oscillators through a low-pass filter
 * with slow vibrato; notes change by gliding the frequency (no nodes are created per
 * note). Mode and timbre follow the quartet (air: Lydian and breath; earth: Dorian,
 * dark; water: Aeolian with a bell; fire: bright Ionian); how many voices sound, and
 * how much they move, follow the movement (IV is almost silent; V gathers all four).
 */

type Element = "air" | "earth" | "water" | "fire" | "none" | "home";

interface Mode {
  root: number; // MIDI note of the tonic
  steps: number[]; // scale degrees in semitones
  cutoff: number; // filter cutoff (Hz)
  breath: number; // noise level 0…1
  bell: boolean;
}

const MODES: Record<Exclude<Element, "home">, Mode> = {
  air: { root: 53, steps: [0, 2, 4, 6, 7, 9, 11], cutoff: 2600, breath: 0.35, bell: false }, // F Lydian
  earth: { root: 50, steps: [0, 2, 3, 5, 7, 9, 10], cutoff: 1100, breath: 0, bell: false }, // D Dorian
  water: { root: 57, steps: [0, 2, 3, 5, 7, 8, 10], cutoff: 1700, breath: 0.12, bell: true }, // A Aeolian
  fire: { root: 48, steps: [0, 2, 4, 5, 7, 9, 11], cutoff: 3400, breath: 0, bell: false }, // C Ionian
  none: { root: 50, steps: [0, 2, 3, 5, 7, 9, 10], cutoff: 1200, breath: 0, bell: false },
};

// Voice ranges as scale-degree offsets from the root (vc, vla, vln2, vln1).
const RANGES: Array<[number, number]> = [
  [-14, -4],
  [-7, 3],
  [0, 9],
  [5, 14],
];
// Which voices sound in each movement (0 = title page), and how restless they are.
const DENSITY: Record<number, { voices: number[]; motion: number }> = {
  0: { voices: [0, 1], motion: 0.3 },
  1: { voices: [0, 1, 2], motion: 0.5 },
  2: { voices: [0, 1, 2, 3], motion: 0.8 },
  3: { voices: [0, 1], motion: 0.25 },
  4: { voices: [3], motion: 0.2 },
  5: { voices: [0, 1, 2, 3], motion: 0.55 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Voice {
  readonly a: OscillatorNode;
  readonly b: OscillatorNode;
  readonly filter: BiquadFilterNode;
  readonly amp: GainNode;
  readonly vib: OscillatorNode;
  readonly vibDepth: GainNode;
  degree: number;
  next = 0;

  constructor(
    readonly ctx: AudioContext,
    out: AudioNode,
    readonly index: number,
  ) {
    this.a = ctx.createOscillator();
    this.b = ctx.createOscillator();
    this.a.type = "sawtooth";
    this.b.type = "triangle";
    this.b.detune.value = 7;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.7;
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.vib = ctx.createOscillator();
    this.vib.frequency.value = 4.6 + index * 0.23;
    this.vibDepth = ctx.createGain();
    this.vibDepth.gain.value = 6; // cents
    this.vib.connect(this.vibDepth);
    this.vibDepth.connect(this.a.detune);
    this.vibDepth.connect(this.b.detune);
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    this.a.connect(mix);
    this.b.connect(mix);
    mix.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(out);
    this.degree = RANGES[index]![0] + 4;
    this.a.start();
    this.b.start();
    this.vib.start();
  }
}

export class Soundscape {
  private ctx: AudioContext;
  private master: GainNode;
  private wet: GainNode;
  private voices: Voice[] = [];
  private noise: AudioBufferSourceNode;
  private noiseGain: GainNode;
  private noiseFilter: BiquadFilterNode;
  private timer = 0;
  private element: Element = "none";
  private movement = 0;
  private homeCycle = 0;
  private nextBell = 0;
  private volume = 0.6;
  private on = false;

  constructor() {
    this.ctx = new AudioContext();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    // A generated room: decaying noise as an impulse response.
    const verb = this.ctx.createConvolver();
    verb.buffer = this.impulse(3.2);
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.55;
    verb.connect(this.wet);
    this.wet.connect(this.master);
    const dry = this.ctx.createGain();
    dry.gain.value = 0.6;
    dry.connect(this.master);
    const bus = this.ctx.createGain();
    bus.connect(dry);
    bus.connect(verb);

    for (let i = 0; i < 4; i++) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = [-0.15, 0.25, -0.45, 0.45][i]!;
      pan.connect(bus);
      this.voices.push(new Voice(this.ctx, pan, i));
    }

    // Breath (air): filtered noise, very low.
    this.noise = this.ctx.createBufferSource();
    this.noise.buffer = this.noiseBuffer(4);
    this.noise.loop = true;
    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = "bandpass";
    this.noiseFilter.frequency.value = 900;
    this.noiseFilter.Q.value = 0.6;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(bus);
    this.noise.start();

    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private impulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(2, Math.floor(rate * seconds), rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
    }
    return buf;
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private onVisibility = () => {
    if (!this.on) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  get playing() {
    return this.on;
  }

  async start() {
    await this.ctx.resume();
    this.on = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.32 * this.volume, t, 1.8);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 400);
    this.applyContext(true);
  }

  stop() {
    this.on = false;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.8);
    window.clearInterval(this.timer);
    window.setTimeout(() => {
      if (!this.on) void this.ctx.suspend();
    }, 4000);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.on) this.master.gain.setTargetAtTime(0.32 * this.volume, this.ctx.currentTime, 0.4);
  }

  /** The page's scene key (air/earth/water/fire/home/none) and current movement. */
  setContext(element: Element, movement: number) {
    const changed = element !== this.element || movement !== this.movement;
    this.element = element;
    this.movement = movement;
    if (changed && this.on) this.applyContext(false);
  }

  private mode(): Mode {
    if (this.element === "home") {
      const order: Array<Exclude<Element, "home" | "none">> = ["air", "earth", "water", "fire"];
      return MODES[order[this.homeCycle % 4]!];
    }
    return MODES[this.element];
  }

  private density() {
    if (this.element === "home") return DENSITY[2]!;
    if (this.element === "none") return DENSITY[0]!;
    return DENSITY[this.movement] ?? DENSITY[0]!;
  }

  private applyContext(immediate: boolean) {
    const t = this.ctx.currentTime;
    const m = this.mode();
    const tau = immediate ? 0.5 : 4;
    for (const v of this.voices) v.filter.frequency.setTargetAtTime(m.cutoff * (0.7 + v.index * 0.15), t, tau);
    this.noiseGain.gain.setTargetAtTime(m.breath * 0.05, t, tau);
    this.noiseFilter.frequency.setTargetAtTime(this.element === "water" ? 500 : 1200, t, tau);
    for (const v of this.voices) v.next = 0; // re-voice soon
  }

  private freqOf(degree: number): number {
    const m = this.mode();
    const n = m.steps.length;
    const oct = Math.floor(degree / n);
    const step = m.steps[((degree % n) + n) % n]!;
    return mtof(m.root + oct * 12 + step);
  }

  /** The scheduler: every 400 ms, voices whose time has come glide to a new note. */
  private tick() {
    const now = this.ctx.currentTime;
    const d = this.density();
    const active = new Set(d.voices);
    const resolving = this.movement === 5 && this.element !== "home";
    if (this.element === "home" && Math.floor(now / 40) !== this.homeCycle) {
      this.homeCycle = Math.floor(now / 40);
      this.applyContext(false);
    }
    for (const v of this.voices) {
      const on = active.has(v.index);
      if (!on) {
        v.amp.gain.setTargetAtTime(0, now, 2.5);
        continue;
      }
      if (now < v.next) continue;
      const [lo, hi] = RANGES[v.index]!;
      let step = Math.round((Math.random() * 2 - 1) * (1 + d.motion * 2));
      if (resolving) {
        // Movement V gravitates toward the tonic triad.
        const target = [0, 2, 4, 7][v.index]! + (v.index === 0 ? -7 : 0);
        step = Math.sign(target - v.degree);
      }
      v.degree = Math.max(lo, Math.min(hi, v.degree + step));
      const f = this.freqOf(v.degree);
      const glide = 1.2 + Math.random() * 2.2;
      v.a.frequency.setTargetAtTime(f, now, glide / 3);
      v.b.frequency.setTargetAtTime(f, now, glide / 3);
      const level = (v.index === 0 ? 0.16 : 0.11) * (0.7 + Math.random() * 0.3);
      v.amp.gain.setTargetAtTime(level, now, 1.6);
      v.next = now + (5 + Math.random() * 7) / (0.6 + d.motion);
    }
    const m = this.mode();
    if (m.bell && now > this.nextBell) {
      this.bell(now);
      this.nextBell = now + 14 + Math.random() * 10;
    }
  }

  /** The bell buoy: a short inharmonic strike (the only per-event nodes). */
  private bell(t: number) {
    const out = this.ctx.createGain();
    out.gain.value = 0;
    out.connect(this.wet);
    const base = mtof(this.mode().root + 12);
    for (const [ratio, amp] of [
      [1, 0.5],
      [2.76, 0.25],
      [5.4, 0.12],
    ] as const) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = base * ratio;
      const g = this.ctx.createGain();
      g.gain.value = amp;
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 7);
    }
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.09, t + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0008, t + 6.5);
    window.setTimeout(() => out.disconnect(), 7500);
  }
}
