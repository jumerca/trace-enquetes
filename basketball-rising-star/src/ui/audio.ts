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

let ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

/** Rumeur de la salle en boucle (bruit filtré), intensité réglable. */
export function startAmbience(): void {
  const a = ac();
  if (!a || ambience) return;
  const len = a.sampleRate * 3;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    d[i] = last * 6;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = a.createGain();
  g.gain.value = 0.05 * volume;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
  ambience = { src, gain: g };
}
export function crowdLevel(level: number): void {
  if (!ambience || !ctx) return;
  ambience.gain.gain.setTargetAtTime((0.04 + level * 0.12) * volume, ctx.currentTime, 0.4);
}
export function stopAmbience(): void {
  try {
    ambience?.src.stop();
  } catch {
    /* déjà arrêté */
  }
  ambience = null;
}

export const sfx = {
  dribble: () => tone(78, 0.07, 'sine', 0.16, -30),
  board: () => {
    tone(140, 0.12, 'square', 0.06, -60);
    noise(0.08, 500, 1.2, 0.2);
  },
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
