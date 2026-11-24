// Son du domaine, entièrement synthétisé (Web Audio, aucun fichier à télécharger) :
// musique douce générative, ambiance (vent, pluie, oiseaux, grillons), cris d'animaux proches, moteurs des engins.

export interface SoundScene {
  hour: number; // 0..24
  season: number; // 0 printemps … 3 hiver
  weather: string;
  zoom: number;
  animals: string[]; // espèces visibles près du centre de l'écran
  engines: number; // engins en mouvement visibles
  paused: boolean;
}

const PENTA = [0, 2, 4, 7, 9]; // gamme pentatonique majeure
const PENTA_HIVER = [0, 2, 3, 7, 8];

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private amb!: GainNode;
  private sfx!: GainNode;
  private wind!: GainNode;
  private rain!: GainNode;
  private engine!: GainNode;
  private engineOsc!: OscillatorNode;
  private noise!: AudioBuffer;
  private nextBeat = 0;
  private beat = 0;
  private nextCall = 0;
  private nextBird = 0;
  volMusic = 0.5;
  volAmb = 0.7;

  /** À appeler depuis un geste de l'utilisateur (politique des navigateurs). */
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(this.master);
    this.music = this.bus(comp, this.volMusic * 0.35);
    this.amb = this.bus(comp, this.volAmb);
    this.sfx = this.bus(comp, this.volAmb);
    // bruit blanc partagé (vent, pluie, grognements)
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.wind = this.loopNoise('bandpass', 380, 0.6, this.amb);
    this.rain = this.loopNoise('highpass', 1800, 0.3, this.amb);
    // moteur : dents de scie graves filtrées
    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    this.engineOsc.connect(lp).connect(this.engine).connect(this.sfx);
    this.engineOsc.start();
    this.nextBeat = ctx.currentTime + 0.5;
  }

  private bus(to: AudioNode, v: number) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    g.connect(to);
    return g;
  }

  private loopNoise(type: BiquadFilterType, f: number, q: number, to: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filt).connect(g).connect(to);
    src.start();
    return g;
  }

  setVolumes(music: number, amb: number) {
    this.volMusic = music;
    this.volAmb = amb;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(music * 0.35, t, 0.2);
    this.amb.gain.setTargetAtTime(amb, t, 0.2);
    this.sfx.gain.setTargetAtTime(amb, t, 0.2);
  }

  /** Appelée plusieurs fois par seconde avec l'état de la scène. */
  update(sc: SoundScene) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const near = Math.min(1, Math.max(0.15, sc.zoom));
    const rainy = sc.weather === 'pluie' || sc.weather === 'orage';
    this.wind.gain.setTargetAtTime((sc.weather === 'orage' ? 0.5 : sc.weather === 'neige' ? 0.3 : 0.12) * (0.8 + 0.2 * Math.sin(t * 0.13)), t, 1.5);
    this.rain.gain.setTargetAtTime(rainy ? (sc.weather === 'orage' ? 0.35 : 0.22) : 0, t, 1.5);
    this.engine.gain.setTargetAtTime(sc.paused ? 0 : Math.min(0.5, sc.engines * 0.18) * near, t, 0.4);
    this.engineOsc.frequency.setTargetAtTime(48 + Math.min(4, sc.engines) * 4 + Math.sin(t * 0.7) * 3, t, 0.3);
    this.scheduleMusic(t, sc);
    if (sc.paused) return;
    const day = sc.hour >= 6 && sc.hour < 20.5;
    // oiseaux le jour, grillons les soirs d'été
    if (t > this.nextBird && !rainy && sc.season !== 3) {
      if (day) this.bird(t, near);
      else if (sc.season === 1 || sc.season === 0) this.cricket(t, near);
      this.nextBird = t + (day ? 1.5 + Math.random() * 4 : 0.8 + Math.random() * 1.5);
    }
    // cris des animaux visibles
    if (t > this.nextCall && sc.animals.length) {
      this.call(sc.animals[Math.floor(Math.random() * sc.animals.length)], t, near);
      this.nextCall = t + 3 + Math.random() * 6;
    }
  }

  // ————— musique générative —————
  private scheduleMusic(now: number, sc: SoundScene) {
    const ctx = this.ctx!;
    const step = 60 / 70; // 70 battements par minute
    const scale = sc.season === 3 ? PENTA_HIVER : PENTA;
    const root = 50 + [2, 0, -3, -5][sc.season]; // ré, do, la, sol
    const night = sc.hour < 6 || sc.hour >= 21;
    while (this.nextBeat < now + 1) {
      const t = this.nextBeat;
      const b = this.beat++;
      if (b % 8 === 0) {
        // nappe : accord de trois notes, attaque et chute lentes
        const deg = [0, 3, 4, 2][Math.floor(b / 8) % 4];
        for (const k of [0, 2, 4]) this.pad(this.mtof(root - 12 + scale[(deg + k) % 5] + ((deg + k) >= 5 ? 12 : 0)), t, step * 8, night ? 0.05 : 0.07);
      }
      if (Math.random() < (night ? 0.25 : 0.5)) {
        const n = scale[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0);
        this.pluck(this.mtof(root + n), t + (Math.random() < 0.3 ? step / 2 : 0), night ? 0.06 : 0.1);
      }
      this.nextBeat += step;
    }
    void ctx;
  }

  private mtof(m: number) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  private pad(f: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 2);
    g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.connect(lp).connect(this.music);
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 1.6);
    }
  }

  private pluck(f: number, t: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.4);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 1.5);
  }

  // ————— ambiance —————
  private bird(t: number, v: number) {
    const ctx = this.ctx!;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2400 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const s = t + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), s + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.04 * v, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, s + 0.08);
      o.connect(g).connect(this.amb);
      o.start(s);
      o.stop(s + 0.1);
    }
  }

  private cricket(t: number, v: number) {
    const ctx = this.ctx!;
    for (let i = 0; i < 6; i++) {
      const s = t + i * 0.045;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 4400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.012 * v, s + 0.005);
      g.gain.linearRampToValueAtTime(0, s + 0.025);
      o.connect(g).connect(this.amb);
      o.start(s);
      o.stop(s + 0.03);
    }
  }

  // ————— animaux —————
  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, v: number, filter?: [BiquadFilterType, number, number], vibrato?: [number, number]) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur);
    if (vibrato) {
      const l = ctx.createOscillator();
      l.frequency.value = vibrato[0];
      const lg = ctx.createGain();
      lg.gain.value = vibrato[1];
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + Math.min(0.08, dur / 4));
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    let out: AudioNode = g;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter[0];
      f.frequency.value = filter[1];
      f.Q.value = filter[2];
      g.connect(f);
      out = f;
    }
    o.connect(g);
    out.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private grunt(t: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  call(kind: string, t: number, v: number) {
    const k = 0.5 * v;
    switch (kind) {
      case 'vache':
      case 'limousine':
        this.tone('sawtooth', 120, 92, t, 1.3, 0.22 * k, ['lowpass', 520, 2]);
        break;
      case 'chevre':
      case 'brebis':
      case 'alpaga':
        this.tone('sawtooth', kind === 'brebis' ? 330 : 420, kind === 'brebis' ? 300 : 380, t, 0.7, 0.12 * k, ['bandpass', 1300, 2], [7, 30]);
        break;
      case 'poule':
      case 'pintade':
      case 'caille':
        for (let i = 0; i < 3; i++) this.tone('triangle', 820 - i * 40, 640, t + i * 0.16, 0.09, 0.12 * k, ['bandpass', 1500, 3]);
        break;
      case 'dinde':
        for (let i = 0; i < 5; i++) this.tone('square', 520, 420, t + i * 0.06, 0.05, 0.06 * k, ['bandpass', 900, 3]);
        break;
      case 'canard':
      case 'oie':
        for (let i = 0; i < 2; i++) this.tone('square', kind === 'oie' ? 300 : 360, 260, t + i * 0.22, 0.14, 0.08 * k, ['bandpass', 1000, 6]);
        break;
      case 'cochon':
        this.grunt(t, 0.25, 0.5 * k);
        this.grunt(t + 0.35, 0.2, 0.4 * k);
        break;
      case 'cheval':
        this.tone('sawtooth', 700, 320, t, 1.1, 0.1 * k, ['bandpass', 1400, 2], [14, 60]);
        break;
      case 'ane':
        this.tone('sawtooth', 600, 560, t, 0.4, 0.12 * k, ['bandpass', 1200, 2]);
        this.tone('sawtooth', 260, 240, t + 0.45, 0.5, 0.14 * k, ['bandpass', 700, 2]);
        break;
      case 'cerf':
        this.tone('sawtooth', 180, 140, t, 1.6, 0.14 * k, ['lowpass', 600, 3], [3, 8]);
        break;
    }
  }

  stop() {
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const sound = new Sound();
