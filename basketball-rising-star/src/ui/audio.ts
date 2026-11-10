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

/** Clameur : bruit filtré avec enveloppe (attaque rapide, longue décroissance). */
function crowdNoise(dur: number, freq: number, q: number, gain: number, attack = 0.15): void {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  const atk = Math.floor(a.sampleRate * attack);
  for (let i = 0; i < len; i++) {
    const env = i < atk ? i / atk : Math.pow(1 - (i - atk) / (len - atk), 1.6);
    d[i] = (Math.random() * 2 - 1) * env * (0.75 + 0.25 * Math.sin(i / 900));
  }
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

/** Chant rythmé « DÉ-FENSE » : deux syllabes chantées (voyelles formantiques) et claquements. */
function chantVoice(times: number[], freqs: number[]): void {
  const a = ac();
  if (!a) return;
  times.forEach((t, i) => {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freqs[i % freqs.length];
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 2;
    const g = a.createGain();
    const t0 = a.currentTime + t;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05 * volume, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(f).connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + 0.35);
  });
}

export const crowdSfx: Record<string, () => void> = {
  cheer: () => crowdNoise(2.2, 1100, 0.6, 0.55),
  roar: () => {
    crowdNoise(3.2, 1000, 0.5, 0.8, 0.08);
    crowdNoise(2.5, 2200, 0.8, 0.3, 0.1);
  },
  murmur: () => crowdNoise(1.2, 500, 0.8, 0.15, 0.3),
  boo: () => crowdNoise(1.8, 260, 1.4, 0.45, 0.35),
  clap: () => {
    for (let i = 0; i < 6; i++) setTimeout(() => noise(0.05, 2500, 1, 0.25), i * 120 + Math.random() * 40);
  },
  chant: () => {
    for (const t of [0, 0.5, 1.0, 1.5, 2.0, 2.5]) setTimeout(() => noise(0.06, 2300, 1, 0.3), t * 1000);
    chantVoice([0, 0.5, 1.5, 2.0], [220, 196]);
  },
  chantDefense: () => {
    chantVoice([0, 0.38, 1.2, 1.58, 2.4, 2.78], [233, 196]);
    for (const t of [0.8, 2.0, 3.2]) setTimeout(() => noise(0.06, 2300, 1, 0.35), t * 1000);
  },
};

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
