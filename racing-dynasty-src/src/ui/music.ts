// Musique des menus synthétisée en WebAudio (aucun fichier) : boucle « rétro-sport » en la mineur, 112 BPM.
// Démarrée au premier geste de l'utilisateur (exigence des navigateurs mobiles), coupée pendant les courses.

const BPM = 112;
const STEP = 60 / BPM / 4; // double-croche
// Progression : Am – F – C – G (une mesure chacune, 16 pas)
const CHORDS = [
  [57, 60, 64], // la mineur
  [53, 57, 60], // fa
  [48, 52, 55], // do
  [55, 59, 62], // sol
];
const BASS = [45, 41, 36, 43];
// Mélodie (une note tous les 2 pas, 0 = silence) : 4 mesures × 8
const MELODY = [
  69, 0, 72, 0, 76, 74, 72, 0,
  69, 0, 72, 74, 72, 0, 69, 0,
  67, 0, 72, 0, 76, 0, 79, 76,
  74, 0, 71, 0, 67, 0, 71, 74,
];

const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class MenuMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private noise: AudioBuffer | null = null;
  enabled = true;
  private playing = false;

  private ensure(): boolean {
    if (this.ctx) return true;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.11;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      this.master.connect(lp).connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.05);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  private tone(type: OscillatorType, f: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.2);
  }

  private hat(t: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(t);
  }

  private schedule(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime;
      const s = this.step % 64;
      const bar = Math.floor(s / 16);
      const inBar = s % 16;
      if (inBar % 4 === 0) this.kick(t);
      if (inBar % 2 === 1) this.hat(t, inBar % 4 === 3 ? 0.25 : 0.12);
      if (inBar % 4 === 0 || inBar === 6 || inBar === 14) this.tone('triangle', freq(BASS[bar]), t, STEP * 1.8, 0.5);
      if (inBar === 0 || inBar === 8) for (const n of CHORDS[bar]) this.tone('square', freq(n), t, STEP * 6, 0.05);
      if (s % 2 === 0) {
        const m = MELODY[(s / 2) % MELODY.length];
        if (m) this.tone('sawtooth', freq(m), t, STEP * 1.7, 0.07);
      }
      this.step++;
      this.nextTime += STEP;
    }
  }

  /** À appeler depuis un geste utilisateur. */
  play(): void {
    if (!this.enabled || this.playing || !this.ensure()) return;
    void this.ctx!.resume();
    this.playing = true;
    this.nextTime = this.ctx!.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.suspend();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }
}

export const menuMusic = new MenuMusic();
