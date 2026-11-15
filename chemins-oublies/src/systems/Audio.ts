// Son et musique entièrement synthétisés (WebAudio) : aucune ressource à télécharger, fonctionne hors ligne.
// Thèmes : village, forêt, intérieur, moulin, danger. Ambiances : eau, oiseaux, grillons, vent, machinerie.

type Theme = 'village' | 'foret' | 'interieur' | 'moulin' | 'danger' | 'titre' | 'none';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface ThemeDef { bpm: number; scale: number[]; root: number; chords: number[][]; lead: 'flute' | 'pluck' | 'bell'; pad: boolean; bass: boolean; perc?: boolean; density: number }
const THEMES: Record<Exclude<Theme, 'none'>, ThemeDef> = {
  titre: { bpm: 72, root: 62, scale: [0, 2, 4, 7, 9, 12, 14], chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], lead: 'flute', pad: true, bass: true, density: 0.5 },
  village: { bpm: 96, root: 67, scale: [0, 2, 4, 5, 7, 9, 12, 14], chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], lead: 'pluck', pad: false, bass: true, density: 0.62 },
  foret: { bpm: 66, root: 62, scale: [0, 2, 3, 7, 9, 12, 14], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], lead: 'flute', pad: true, bass: false, density: 0.35 },
  interieur: { bpm: 80, root: 65, scale: [0, 2, 4, 7, 9, 12], chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], lead: 'bell', pad: true, bass: true, density: 0.4 },
  moulin: { bpm: 88, root: 64, scale: [0, 2, 4, 7, 9, 11, 12], chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [2, 5, 9]], lead: 'pluck', pad: true, bass: true, density: 0.5 },
  danger: { bpm: 128, root: 57, scale: [0, 1, 3, 7, 8, 12], chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5]], lead: 'pluck', pad: true, bass: true, perc: true, density: 0.55 },
};

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
  private seed = 1;
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
    const th = this.theme; this.theme = 'none'; this.play(th);
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.ambBus.gain.setTargetAtTime(sfx * 0.7, this.ctx.currentTime, 0.1);
  }

  play(t: Theme) {
    if (t === this.theme) return;
    this.theme = t;
    this.seed = Array.from(t).reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    if (this.ctx) { this.nextBeat = this.ctx.currentTime + 0.4; this.beat = 0; }
  }
  get currentTheme() { return this.theme; }

  private rnd() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }

  private tick() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    this.updateAmbience();
    if (this.theme === 'none') return;
    const def = THEMES[this.theme];
    const spb = 60 / def.bpm / 2; // croches
    while (this.nextBeat < c.currentTime + 0.25) {
      this.scheduleBeat(def, this.beat, this.nextBeat, spb);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private scheduleBeat(d: ThemeDef, b: number, t: number, spb: number) {
    const bar = Math.floor(b / 8) % d.chords.length;
    const chord = d.chords[bar];
    const inBar = b % 8;
    if (inBar === 0) {
      if (d.pad) for (const n of chord) this.pad(NOTE(d.root - 12 + n), t, spb * 8);
      if (d.bass) this.pluck(NOTE(d.root - 24 + chord[0]), t, spb * 3, 0.22, 'triangle');
    }
    if (d.bass && inBar === 4) this.pluck(NOTE(d.root - 24 + chord[(b >> 3) % 2 ? 2 : 0]), t, spb * 3, 0.16, 'triangle');
    if (!d.pad && (inBar === 2 || inBar === 6)) for (const n of chord) this.pluck(NOTE(d.root - 12 + n), t, spb * 1.5, 0.05, 'triangle');
    if (d.perc) { if (inBar % 4 === 0) this.drum(t, 0.35, 70); if (inBar % 4 === 2) this.hat(t, 0.08); }
    // mélodie : notes de la gamme proches des notes de l'accord, phrases de 2 mesures
    const phraseBar = Math.floor(b / 8) % 4;
    if (this.rnd() < d.density && !(phraseBar === 3 && inBar > 4)) {
      const deg = Math.floor(this.rnd() * d.scale.length);
      let n = d.root + d.scale[deg];
      if (inBar === 0) n = d.root + 12 + chord[Math.floor(this.rnd() * 3)] - 12;
      const dur = spb * (this.rnd() < 0.3 ? 3 : 1.5);
      if (d.lead === 'flute') this.flute(NOTE(n), t, dur * 1.4);
      else if (d.lead === 'bell') this.bell(NOTE(n + 12), t, 0.09);
      else this.pluck(NOTE(n), t, dur, 0.11, 'triangle');
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
  private flute(f: number, t: number, dur: number) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain(); const lfo = c.createOscillator(); const lg = c.createGain();
    o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08); g.gain.setValueAtTime(0.09, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
  private bell(f: number, t: number, vol: number, bus?: GainNode) {
    const c = this.ctx!;
    for (const [m, v] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) {
      const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m; o.connect(g); g.connect(bus ?? this.musicBus);
      this.env(g, t, 0.005, vol * v, 1.2 / m + 0.4); o.start(t); o.stop(t + 2);
    }
  }
  private pad(f: number, t: number, dur: number) {
    const c = this.ctx!; const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900; const g = c.createGain();
    flt.connect(g); g.connect(this.musicBus);
    for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(t); o.stop(t + dur + 0.6); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
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
    const pitch: Record<string, number> = { eloi: 1, agathe: 0.85, basile: 0.75, ninon: 1.5, mara: 0.95, anton: 0.65, coline: 1.05, theodore: 0.6, salome: 1.15, paulin: 1.45, gaspard: 0.7, odile: 1 };
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
