// Son et musique entièrement synthétisés (WebAudio) : aucune ressource à télécharger, fonctionne hors ligne.
// Thèmes : village, forêt, intérieur, moulin, danger. Ambiances : eau, oiseaux, grillons, vent, machinerie.

import { SONGS, compile, Theme, Ev } from './Music';
export type { Theme };

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const COMPILED = new Map<string, { evs: Ev[]; len: number }>();
function score(t: Exclude<Theme, 'none'>) { let c = COMPILED.get(t); if (!c) { c = compile(SONGS[t]); COMPILED.set(t, c); } return c; }

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private theme: Theme = 'none';
  private nextBeat = 0;
  private beat = 0;
  private evIdx = 0;
  private pending: Theme | null = null;
  private fadeUntil = 0;
  private water: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private wind: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private machine = 0;
  musicVol = 0.6;
  sfxVol = 0.8;
  ambience: { birds: number; crickets: number; water: number; wind: number; machine: number } = { birds: 0, crickets: 0, water: 0, wind: 0, machine: 0 };

  /** À appeler sur un geste de l'utilisateur (politique des navigateurs). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx!;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    this.setVolumes(this.musicVol, this.sfxVol);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    window.setInterval(() => this.tick(), 60);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else this.ctx.resume(); });
    const th = this.theme; this.theme = 'none'; this.start(th);
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music * 0.5 * (this.theme !== 'none' ? SONGS[this.theme].vol ?? 1 : 1), this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.ambBus.gain.setTargetAtTime(sfx * 0.7, this.ctx.currentTime, 0.1);
  }

  play(t: Theme) {
    if (t === this.theme && !this.pending) return;
    if (t === this.pending) return;
    if (!this.ctx || this.theme === 'none') { this.start(t); return; }
    // fondu enchaîné : on baisse la musique, puis le nouveau morceau démarre
    this.pending = t;
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now);
    this.musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.7);
    this.fadeUntil = now + 0.75;
  }
  private start(t: Theme) {
    this.theme = t; this.pending = null; this.beat = 0; this.evIdx = 0;
    if (this.ctx) {
      this.nextBeat = this.ctx.currentTime + 0.15;
      const now = this.ctx.currentTime, v = this.musicVol * 0.5 * (t !== 'none' ? SONGS[t].vol ?? 1 : 1);
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(0.0001, now);
      this.musicBus.gain.linearRampToValueAtTime(v, now + 0.9);
    }
  }
  get currentTheme() { return this.pending ?? this.theme; }

  private tick() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    this.updateAmbience();
    if (this.pending && c.currentTime >= this.fadeUntil) this.start(this.pending);
    if (this.theme === 'none' || this.pending) return;
    const song = SONGS[this.theme];
    const sc = score(this.theme);
    const spb = 60 / song.bpm / 2; // une croche
    while (this.nextBeat < c.currentTime + 0.25) {
      const pos = this.beat % sc.len;
      if (pos === 0) this.evIdx = 0;
      const sw = song.swing && pos % 2 === 1 ? spb * song.swing : 0;
      while (this.evIdx < sc.evs.length && sc.evs[this.evIdx].at < pos + 1) {
        const e = sc.evs[this.evIdx++];
        if (e.at >= pos) this.playEv(e, this.nextBeat + sw + (e.at - pos) * spb, spb);
      }
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private playEv(e: Ev, t: number, spb: number) {
    const f = NOTE(e.note), d = e.dur * spb;
    switch (e.part) {
      case 'lead':
        if (e.inst === 'flute') this.flute(f, t, Math.max(0.2, d * 1.05), 0.085 * e.vol);
        else if (e.inst === 'bell') this.bell(f, t, 0.075 * e.vol);
        else if (e.inst === 'harp') this.harp(f, t, Math.max(0.6, d * 1.6), 0.1 * e.vol);
        else if (e.inst === 'fiddle') this.fiddle(f, t, Math.max(0.12, d * 0.95), 0.05 * e.vol);
        else this.pluck(f, t, Math.max(0.18, d), 0.1 * e.vol, 'triangle');
        break;
      case 'bass': this.pluck(f, t, Math.max(0.2, d), 0.2 * e.vol, 'triangle'); break;
      case 'chord': this.pluck(f, t, Math.max(0.15, d), 0.035 * e.vol, 'triangle'); break;
      case 'arp': this.harp(f, t, Math.max(0.4, d * 1.5), 0.04 * e.vol); break;
      case 'pad': this.pad(f, t, d, 0.022 * e.vol); break;
      case 'spark': this.bell(f, t, 0.03 * e.vol); break;
      case 'drum': this.drum(t, 0.32 * e.vol, 70); break;
      case 'snare': this.noise(t, 0.12, 0.1 * e.vol, 'bandpass', 1800, 0.8, this.musicBus); break;
      case 'hat': this.hat(t, 0.06 * e.vol); break;
    }
  }

  // ---- instruments
  private env(g: GainNode, t: number, a: number, peak: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private pluck(f: number, t: number, dur: number, vol: number, type: OscillatorType = 'triangle', bus?: GainNode) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = f; o.connect(g); g.connect(bus ?? this.musicBus);
    this.env(g, t, 0.008, vol, Math.max(0.15, dur));
    o.start(t); o.stop(t + dur + 0.05);
  }
  private flute(f: number, t: number, dur: number, vol = 0.09) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const lfo = c.createOscillator(); const lg = c.createGain();
    o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
  private bell(f: number, t: number, vol: number, bus?: GainNode) {
    const c = this.ctx!;
    for (const [m, v] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) {
      const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m; o.connect(g); g.connect(bus ?? this.musicBus);
      this.env(g, t, 0.005, vol * v, 1.2 / m + 0.4); o.start(t); o.stop(t + 2);
    }
  }
  private pad(f: number, t: number, dur: number, vol = 0.025) {
    const c = this.ctx!; const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900; const g = c.createGain();
    flt.connect(g); g.connect(this.musicBus);
    for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(t); o.stop(t + dur + 0.6); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  }
  /** Harpe / clavecin doux : attaque nette, longue résonance, harmonique d'octave. */
  private harp(f: number, t: number, dur: number, vol: number) {
    const c = this.ctx!;
    for (const [m, v, ty] of [[1, 1, 'triangle'], [2, 0.25, 'sine']] as [number, number, OscillatorType][]) {
      const o = c.createOscillator(); const g = c.createGain(); o.type = ty; o.frequency.value = f * m; o.connect(g); g.connect(this.musicBus);
      this.env(g, t, 0.004, vol * v, dur / m + 0.1); o.start(t); o.stop(t + dur + 0.2);
    }
  }
  /** Violon : dent de scie filtrée, archet progressif et vibrato retardé. */
  private fiddle(f: number, t: number, dur: number, vol: number) {
    const c = this.ctx!; const o = c.createOscillator(); const flt = c.createBiquadFilter(); const g = c.createGain(); const lfo = c.createOscillator(); const lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; flt.type = 'lowpass'; flt.frequency.value = Math.min(4200, f * 4); flt.Q.value = 0.8;
    lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(0.25, dur)); lfo.connect(lg); lg.connect(o.frequency);
    o.connect(flt); flt.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.12); lfo.stop(t + dur + 0.12);
  }
  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1, bus?: GainNode) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
    s.connect(f); f.connect(g); g.connect(bus ?? this.sfxBus);
    this.env(g, t, 0.004, vol, dur); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  private drum(t: number, vol: number, f0: number) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(f0 * 2, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.15);
    o.connect(g); g.connect(this.musicBus); this.env(g, t, 0.003, vol, 0.25); o.start(t); o.stop(t + 0.3);
  }
  private hat(t: number, vol: number) { this.noise(t, 0.05, vol, 'highpass', 7000, 1, this.musicBus); }

  // ---- effets
  sfx(name: string, opt: { pitch?: number; surface?: string } = {}) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.005;
    const p = opt.pitch ?? 1;
    switch (name) {
      case 'step': {
        const s = opt.surface ?? 'grass';
        const f = s === 'wood' ? 900 : s === 'stone' ? 2200 : s === 'dirt' ? 1200 : 700;
        this.noise(t, s === 'wood' ? 0.06 : 0.05, s === 'grass' ? 0.05 : 0.08, 'bandpass', f * (0.9 + Math.random() * 0.2), 1.4);
        if (s === 'wood') this.pluck(140 + Math.random() * 20, t, 0.06, 0.05, 'sine', this.sfxBus);
        break;
      }
      case 'tap': this.pluck(880 * p, t, 0.08, 0.05, 'sine', this.sfxBus); break;
      case 'blip': this.pluck(520 * p + Math.random() * 30, t, 0.05, 0.035, 'square', this.sfxBus); break;
      case 'open': this.pluck(660, t, 0.1, 0.06, 'triangle', this.sfxBus); this.pluck(990, t + 0.06, 0.12, 0.05, 'triangle', this.sfxBus); break;
      case 'close': this.pluck(800, t, 0.08, 0.05, 'triangle', this.sfxBus); this.pluck(560, t + 0.05, 0.1, 0.04, 'triangle', this.sfxBus); break;
      case 'nope': this.pluck(220, t, 0.12, 0.08, 'triangle', this.sfxBus); this.pluck(180, t + 0.08, 0.14, 0.07, 'triangle', this.sfxBus); break;
      case 'door': this.noise(t, 0.35, 0.12, 'lowpass', 500); this.pluck(110, t + 0.02, 0.3, 0.12, 'triangle', this.sfxBus); this.pluck(90, t + 0.25, 0.2, 0.08, 'triangle', this.sfxBus); break;
      case 'item': [0, 4, 7, 12].forEach((n, i) => this.bell(NOTE(76 + n), t + i * 0.07, 0.05, this.sfxBus)); break;
      case 'discover': [0, 7, 12, 16, 19].forEach((n, i) => this.bell(NOTE(72 + n), t + i * 0.11, 0.06, this.sfxBus)); this.noise(t, 1.2, 0.03, 'highpass', 6000, 0.5); break;
      case 'quest': [0, 4, 7, 11, 14].forEach((n, i) => this.pluck(NOTE(67 + n), t + i * 0.09, 0.5, 0.07, 'triangle', this.sfxBus)); break;
      case 'grind': this.noise(t, 0.45, 0.16, 'bandpass', 300, 2); this.noise(t + 0.1, 0.3, 0.1, 'bandpass', 180, 3); break;
      case 'chime': this.bell(NOTE(84) * p, t, 0.08, this.sfxBus); break;
      case 'hum': { const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; o.frequency.value = 196 * p; o.connect(g); g.connect(this.sfxBus); this.env(g, t, 0.05, 0.08, 0.9); o.start(t); o.stop(t + 1); break; }
      case 'wrong': this.noise(t, 0.4, 0.1, 'lowpass', 400); this.pluck(150, t, 0.3, 0.08, 'sawtooth', this.sfxBus); break;
      case 'lever': this.noise(t, 0.08, 0.2, 'bandpass', 1500, 3); this.pluck(180, t + 0.05, 0.15, 0.1, 'square', this.sfxBus); break;
      case 'splash': this.noise(t, 0.6, 0.18, 'bandpass', 900, 0.8); this.noise(t + 0.1, 0.8, 0.08, 'highpass', 3000, 0.5); break;
      case 'creak': { const o = c.createOscillator(); const g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(140, t + 0.6); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 6; o.connect(f); f.connect(g); g.connect(this.sfxBus); this.env(g, t, 0.05, 0.12, 0.8); o.start(t); o.stop(t + 0.9); break; }
      case 'swing': this.noise(t, 0.15, 0.12, 'bandpass', 2400, 0.7); break;
      case 'hit': this.noise(t, 0.12, 0.25, 'lowpass', 1200); this.pluck(160, t, 0.12, 0.15, 'square', this.sfxBus); break;
      case 'hurt': this.pluck(330, t, 0.12, 0.12, 'square', this.sfxBus); this.pluck(220, t + 0.08, 0.2, 0.1, 'square', this.sfxBus); break;
      case 'windup': { const o = c.createOscillator(); const g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.8); o.connect(g); g.connect(this.sfxBus); this.env(g, t, 0.05, 0.08, 0.85); o.start(t); o.stop(t + 0.9); break; }
      case 'slam': this.drumSfx(t); this.noise(t, 0.3, 0.2, 'lowpass', 600); break;
      case 'whoosh': this.noise(t, 0.35, 0.16, 'bandpass', 1400, 0.6); break;
      case 'poof': this.noise(t, 0.5, 0.12, 'bandpass', 700, 0.5); [0, 3, 7].forEach((n, i) => this.bell(NOTE(79 + n), t + 0.1 + i * 0.05, 0.03, this.sfxBus)); break;
      case 'heal': [0, 4, 7, 12].forEach((n, i) => this.pluck(NOTE(72 + n), t + i * 0.06, 0.3, 0.06, 'sine', this.sfxBus)); break;
      case 'page': this.noise(t, 0.25, 0.08, 'highpass', 2500, 0.6); break;
      case 'fanfare': [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]].forEach((ch, i) => ch.forEach((n) => this.pluck(NOTE(60 + n), t + i * 0.32, 0.9, 0.06, 'triangle', this.sfxBus))); break;
    }
  }
  private drumSfx(t: number) { const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2); o.connect(g); g.connect(this.sfxBus); this.env(g, t, 0.003, 0.4, 0.35); o.start(t); o.stop(t + 0.4); }

  talk(speaker: string) {
    const pitch: Record<string, number> = { eloi: 1, agathe: 0.85, basile: 0.75, ninon: 1.5, mara: 0.95, anton: 0.65, coline: 1.05, theodore: 0.6, salome: 1.15, paulin: 1.45, gaspard: 0.7, odile: 1, maelys: 1.1, eloi_jeune: 1.35, conservateur: 0.5, bastien: 0.68, lena: 1.2, ysolde: 0.9 };
    this.sfx('blip', { pitch: pitch[speaker] ?? 1 });
  }

  // ---- ambiance continue
  private loopNoise(type: BiquadFilterType, freq: number, q: number): { src: AudioBufferSourceNode; g: GainNode } {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.ambBus); s.start(); return { src: s, g };
  }
  private updateAmbience() {
    const c = this.ctx!; const a = this.ambience; const t = c.currentTime;
    if (!this.water) this.water = this.loopNoise('bandpass', 1100, 0.5);
    if (!this.wind) this.wind = this.loopNoise('lowpass', 400, 0.7);
    this.water.g.gain.setTargetAtTime(a.water * 0.09, t, 0.3);
    this.wind.g.gain.setTargetAtTime(a.wind * 0.06, t, 0.5);
    if (a.birds > 0 && Math.random() < 0.035 * a.birds) {
      const base = 2200 + Math.random() * 1800; const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) { const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; const tt = t + i * 0.09; o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), tt + 0.06); o.connect(g); g.connect(this.ambBus); this.env(g, tt, 0.01, 0.025 * a.birds, 0.08); o.start(tt); o.stop(tt + 0.1); }
    }
    if (a.crickets > 0 && Math.random() < 0.08 * a.crickets) {
      for (let i = 0; i < 3; i++) { const o = c.createOscillator(); const g = c.createGain(); o.type = 'square'; o.frequency.value = 4200; const tt = t + i * 0.05; o.connect(g); g.connect(this.ambBus); this.env(g, tt, 0.003, 0.006 * a.crickets, 0.03); o.start(tt); o.stop(tt + 0.04); }
    }
    if (a.machine > 0) {
      this.machine += 0.06;
      if (this.machine > 0.9) { this.machine = 0; this.noise(t, 0.2, 0.06 * a.machine, 'lowpass', 220, 1, this.ambBus); this.pluck(70, t, 0.25, 0.05 * a.machine, 'sine', this.ambBus); }
    }
  }
}

export const audio = new AudioEngine();
