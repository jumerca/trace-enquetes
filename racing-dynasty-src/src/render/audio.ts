// Son de course synthétisé (WebAudio, aucun fichier) : moteur de la voiture suivie, bips des feux, rumeur du public.
import { LIGHTS_ON, type RaceSim } from '../engine/race';

export class RaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engA: OscillatorNode | null = null;
  private engB: OscillatorNode | null = null;
  private engGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private crowdGain: GainNode | null = null;
  private lastLit = 0;
  private started = false;
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** À appeler depuis un geste utilisateur (exigence des navigateurs mobiles). */
  start(): void {
    if (this.started || !this.enabled) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(ctx.destination);
      // moteur : deux dents de scie légèrement désaccordées, filtrées
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 900;
      this.engGain = ctx.createGain();
      this.engGain.gain.value = 0;
      this.engA = ctx.createOscillator();
      this.engB = ctx.createOscillator();
      this.engA.type = 'sawtooth';
      this.engB.type = 'square';
      this.engA.connect(this.filter);
      const bGain = ctx.createGain();
      bGain.gain.value = 0.25;
      this.engB.connect(bGain).connect(this.filter);
      this.filter.connect(this.engGain).connect(this.master);
      this.engA.start();
      this.engB.start();
      // public : bruit rose filtré
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0;
      for (let i = 0; i < len; i++) {
        b0 = 0.98 * b0 + 0.02 * (Math.random() * 2 - 1);
        d[i] = b0 * 3;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 500;
      this.crowdGain = ctx.createGain();
      this.crowdGain.gain.value = 0.05;
      noise.connect(nf).connect(this.crowdGain).connect(this.master);
      noise.start();
      this.started = true;
      void ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      this.start();
      void this.ctx?.resume();
    } else void this.ctx?.suspend();
  }

  private beep(freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.05);
  }

  /** Mise à jour à chaque image. speed = multiplicateur de simulation (0 = pause). */
  update(sim: RaceSim, followId: string | null, speed: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || !this.engA || !this.engB || !this.engGain || !this.filter) return;
    const now = ctx.currentTime;
    const lit = sim.formation || sim.t >= sim.lightsOut || sim.t < sim.lightsStart ? 0 : Math.min(5, Math.floor((sim.t - sim.lightsStart) / LIGHTS_ON) + 1);
    if (lit > this.lastLit) this.beep(660, 0.18);
    if (lit === 0 && this.lastLit > 0) this.beep(990, 0.45);
    this.lastLit = lit;
    const car = followId ? sim.car(followId) : null;
    const v = car && car.status !== 'dnf' ? car.v : 0;
    // régime simulé : remonte à chaque « rapport » (7 rapports jusqu'à 90 m/s)
    const gearSpan = 90 / 7;
    const inGear = (v % gearSpan) / gearSpan;
    const rpm = v < 1 ? 0.15 : 0.35 + 0.65 * inGear;
    const f = 70 + rpm * 260;
    this.engA.frequency.setTargetAtTime(f, now, 0.03);
    this.engB.frequency.setTargetAtTime(f * 0.501, now, 0.03);
    this.filter.frequency.setTargetAtTime(500 + rpm * 2200, now, 0.05);
    const vol = speed === 0 || !car ? 0 : 0.08 + 0.12 * Math.min(1, v / 80);
    this.engGain.gain.setTargetAtTime(vol, now, 0.08);
    this.crowdGain?.gain.setTargetAtTime(speed === 0 ? 0.01 : sim.flag ? 0.16 : 0.04, now, 0.3);
  }

  destroy(): void {
    try {
      void this.ctx?.close();
    } catch {
      /* ignoré */
    }
    this.ctx = null;
  }
}
