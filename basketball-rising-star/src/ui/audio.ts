/** Sons synthétisés (aucun fichier externe) : rebond, filet, sifflet, foule. */
let ctx: AudioContext | null = null;
let volume = 0.6;

export function setVolume(v: number): void {
  volume = v;
}

function ac(): AudioContext | null {
  if (volume <= 0) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(dur: number, freq: number, q: number, gain: number): void {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain * volume;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0): void {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(gain * volume, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

export const sfx = {
  bounce: () => tone(95, 0.09, 'sine', 0.35, -40),
  swish: () => noise(0.35, 2400, 0.8, 0.35),
  rim: () => tone(420, 0.25, 'triangle', 0.18, -120),
  whistle: () => {
    tone(2900, 0.32, 'sine', 0.12);
    tone(3050, 0.32, 'sine', 0.08);
  },
  buzzer: () => tone(180, 0.8, 'sawtooth', 0.12),
  crowd: () => noise(1.2, 700, 0.4, 0.25),
  click: () => tone(660, 0.04, 'square', 0.05),
};
