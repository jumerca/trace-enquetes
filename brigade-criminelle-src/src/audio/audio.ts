// Son du jeu, entièrement synthétisé (Web Audio, aucun fichier) : musique d'ambiance
// générative dont l'instrumentation suit la décennie, nappe sonore des lieux (bureau,
// circulation) et effets liés au jeu (téléphone, sirène deux-tons, tampon, machine à écrire…).

export type Sfx = 'click' | 'phone' | 'siren' | 'stamp' | 'success' | 'fail' | 'notify' | 'type' | 'door' | 'paper';

interface Prefs { music: number; sfx: number; ambience: number; muted: boolean }
const DEF: Prefs = { music: 0.45, sfx: 0.7, ambience: 0.4, muted: false };

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, ambBus: GainNode;
let prefs: Prefs = loadPrefs();
let year = 1995;
let tension = 0; // 0 calme → 1 très tendu (affaires urgentes)
let place: 'station' | 'city' | 'menu' = 'menu';
let running = false;
let nextBar = 0;
let bar = 0;
let timer: number | null = null;
let noiseBuf: AudioBuffer | null = null;
let ambNodes: { stop: () => void } | null = null;
let ambKind = '';
let lastAmbTick = 0;

function loadPrefs(): Prefs {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem('bct-audio') ?? '{}') }; } catch { return { ...DEF }; }
}
export function getPrefs(): Prefs { return { ...prefs }; }
export function setPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  try { localStorage.setItem('bct-audio', JSON.stringify(prefs)); } catch { /* stockage indisponible */ }
  applyVolumes();
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(prefs.muted ? 0 : 0.9, t, 0.05);
  musicBus.gain.setTargetAtTime(prefs.music * 0.32, t, 0.1);
  sfxBus.gain.setTargetAtTime(prefs.sfx * 0.6, t, 0.05);
  ambBus.gain.setTargetAtTime(prefs.ambience * 0.25, t, 0.2);
}

/** À appeler lors d'un geste de l'utilisateur (les navigateurs l'exigent). */
export function initAudio() {
  if (typeof window === 'undefined') return;
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
  // réverbération légère (impulsion synthétique) pour la musique
  const rev = ctx.createConvolver();
  const len = ctx.sampleRate * 1.8;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  rev.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.28;
  musicBus.connect(master); musicBus.connect(rev).connect(wet).connect(master);
  sfxBus.connect(master); ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  applyVolumes();
  startMusic();
}

export function audioReady() { return !!ctx; }

export function setContext(o: { year?: number; tension?: number; place?: 'station' | 'city' | 'menu'; paused?: boolean }) {
  if (o.year !== undefined) year = o.year;
  if (o.tension !== undefined) tension = Math.max(0, Math.min(1, o.tension));
  if (o.place !== undefined) place = o.place;
  if (!ctx) return;
  const want = o.paused ? 'none' : place === 'station' ? `bureau-${year < 1990 ? 'machine' : 'clavier'}` : place === 'city' ? 'ville' : 'none';
  if (want !== ambKind) {
    ambNodes?.stop(); ambNodes = null; ambKind = want;
    if (want !== 'none') ambNodes = startAmbience(want);
  }
}

// ————— Musique générative —————
const PROGS: number[][][] = [
  // accords (demi-tons relatifs à la tonique) — progressions mineures, polar
  [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 5]],
  [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [-4, 0, 3, 7]],
  [[0, 3, 7, 14], [-3, 0, 4, 7], [-5, -2, 2, 5], [-7, -3, 0, 4]],
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function startMusic() {
  if (!ctx || running) return;
  running = true;
  nextBar = ctx.currentTime + 0.3;
  timer = window.setInterval(schedule, 120);
}
export function stopMusic() { running = false; if (timer) clearInterval(timer); timer = null; }

function schedule() {
  if (!ctx || !running || ctx.state !== 'running') return;
  const bpm = 72 + tension * 26;
  const beat = 60 / bpm;
  while (nextBar < ctx.currentTime + 0.6) {
    playBar(nextBar, beat);
    nextBar += beat * 4;
    bar++;
  }
}

function eraStyle() {
  return year < 1980 ? 0 : year < 1990 ? 1 : year < 2000 ? 2 : year < 2010 ? 3 : year < 2020 ? 4 : 5;
}

function playBar(t0: number, beat: number) {
  const e = eraStyle();
  const prog = PROGS[Math.floor(bar / 16) % PROGS.length];
  const chord = prog[Math.floor(bar / 2) % prog.length];
  const root = 45 + (e === 1 ? 2 : e === 3 ? -2 : 0); // la grave
  // nappe : années 70 = orgue/piano électrique, 80 = synthé analogique, ensuite pads plus doux
  const padType: OscillatorType = e === 0 ? 'triangle' : e === 1 ? 'sawtooth' : e === 2 ? 'triangle' : 'sine';
  if (bar % 2 === 0) for (const n of chord) pad(t0, beat * 8, midi(root + 12 + n), padType, e === 1 ? 0.05 : 0.07);
  // basse
  const bassNotes = e === 0 ? [0, 7, 10, 7] : e === 2 ? [0, 0, 7, 5] : [0, -1, 0, 7];
  for (let i = 0; i < 4; i++) {
    if (e >= 4 && i % 2 === 1) continue;
    pluck(t0 + i * beat, midi(root - 12 + chord[0] + (e === 0 ? bassNotes[i] : i === 3 ? bassNotes[3] : 0)), beat * 0.9, e === 1 ? 'square' : 'sine', 0.22);
  }
  // rythme : charleston feutré, plus présent quand la tension monte
  for (let i = 0; i < 8; i++) {
    const t = t0 + i * beat / 2;
    if (e === 0 && i % 2 === 1) hat(t + beat * 0.08, 0.03); // swing
    else if (e !== 0) hat(t, i % 2 ? 0.025 : 0.04 + tension * 0.03);
  }
  if (e === 2 || e >= 4) { kick(t0, 0.5); kick(t0 + beat * 2.5, 0.35); snare(t0 + beat, 0.12); snare(t0 + beat * 3, 0.12); }
  else if (tension > 0.4) { kick(t0, 0.35); kick(t0 + beat * 2, 0.3); }
  // motif mélodique occasionnel (vibraphone, synthé, piano)
  if (bar % 4 === 2 || (tension > 0.6 && bar % 2 === 0)) {
    const scale = [0, 2, 3, 5, 7, 8, 10, 12];
    let deg = 4;
    for (let i = 0; i < 6; i++) {
      deg = Math.max(0, Math.min(7, deg + [-2, -1, 1, 1, 2, -1][(bar * 7 + i * 3) % 6]));
      if ((bar + i) % 3 === 2) continue;
      bell(t0 + i * beat * (e === 1 ? 0.5 : 0.66), midi(root + 24 + scale[deg] + chord[0]), e === 1 ? 'square' : e === 0 ? 'triangle' : 'sine', e === 1 ? 0.04 : 0.08);
    }
  }
  // arpège années 80 / ostinato tendu
  if (e === 1 || tension > 0.7) for (let i = 0; i < 8; i++) bell(t0 + i * beat / 2, midi(root + 12 + chord[i % 4] + (i > 3 ? 12 : 0)), 'square', 0.02 + tension * 0.015);
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function pad(t: number, dur: number, f: number, type: OscillatorType, v: number) {
  const c = ctx!;
  const g = c.createGain();
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + tension * 600;
  for (const det of [-6, 6]) {
    const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  lp.connect(g).connect(musicBus);
}
function pluck(t: number, f: number, dur: number, type: OscillatorType, v: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = type; o.frequency.value = f;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const g = c.createGain(); env(g, t, 0.01, v, dur);
  o.connect(lp).connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
function bell(t: number, f: number, type: OscillatorType, v: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = type; o.frequency.value = f;
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01;
  const g = c.createGain(); env(g, t, 0.005, v, 0.9);
  const g2 = c.createGain(); g2.gain.value = 0.3;
  o.connect(g); o2.connect(g2).connect(g); g.connect(musicBus);
  o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
}
function noise(t: number, dur: number, freq: number, type: BiquadFilterType, v: number, bus: GainNode, q = 1) {
  const c = ctx!;
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); env(g, t, 0.002, v, dur);
  s.connect(f).connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function hat(t: number, v: number) { noise(t, 0.05, 8000, 'highpass', v, musicBus); }
function snare(t: number, v: number) { noise(t, 0.16, 1800, 'bandpass', v, musicBus, 0.7); }
function kick(t: number, v: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  const g = c.createGain(); env(g, t, 0.005, v, 0.25);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3);
}
function tone(t: number, f: number, dur: number, type: OscillatorType, v: number, bus = sfxBus) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = type; o.frequency.value = f;
  const g = c.createGain(); env(g, t, 0.005, v, dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
  return o;
}

// ————— Effets —————
let lastSfx: Record<string, number> = {};
export function sfx(k: Sfx) {
  if (!ctx || prefs.muted) return;
  const t = ctx.currentTime;
  if ((lastSfx[k] ?? 0) > t - 0.25) return;
  lastSfx[k] = t;
  const e = eraStyle();
  switch (k) {
    case 'click': tone(t, 1200, 0.03, 'square', 0.04); break;
    case 'notify': tone(t, 880, 0.25, 'sine', 0.12); tone(t + 0.09, 1320, 0.35, 'sine', 0.09); break;
    case 'success': [0, 4, 7, 12].forEach((n, i) => tone(t + i * 0.07, midi(72 + n), 0.3, 'triangle', 0.12)); break;
    case 'fail': [0, -3, -7].forEach((n, i) => tone(t + i * 0.1, midi(62 + n), 0.3, 'triangle', 0.1)); break;
    case 'stamp': {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      const g = ctx.createGain(); env(g, t, 0.002, 0.5, 0.16); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.2);
      noise(t, 0.08, 1200, 'lowpass', 0.25, sfxBus);
      break;
    }
    case 'paper': noise(t, 0.25, 3000, 'bandpass', 0.12, sfxBus, 0.5); break;
    case 'door': noise(t, 0.3, 300, 'lowpass', 0.3, sfxBus); tone(t + 0.05, 90, 0.2, 'sine', 0.2); break;
    case 'type':
      for (let i = 0; i < 6; i++) {
        const tt = t + i * (0.07 + Math.random() * 0.05);
        if (e <= 1) { noise(tt, 0.04, 2500, 'bandpass', 0.2, sfxBus, 2); if (i === 5) tone(tt + 0.12, 2100, 0.3, 'sine', 0.08); }
        else noise(tt, 0.02, 4000, 'bandpass', 0.1, sfxBus, 3);
      }
      break;
    case 'phone': {
      // sonnerie : électromécanique (cloches) jusqu'aux années 80, électronique ensuite
      for (let r = 0; r < 2; r++) {
        const tr = t + r * 0.9;
        if (e <= 1) for (let i = 0; i < 14; i++) { tone(tr + i * 0.03, 1100, 0.04, 'triangle', 0.09); tone(tr + i * 0.03 + 0.015, 1380, 0.04, 'triangle', 0.07); }
        else if (e <= 3) for (let i = 0; i < 8; i++) tone(tr + i * 0.05, i % 2 ? 1300 : 1000, 0.05, 'square', 0.05);
        else [0, 4, 7, 4].forEach((n, i) => tone(tr + i * 0.12, midi(76 + n), 0.15, 'sine', 0.1));
      }
      break;
    }
    case 'siren': {
      // deux-tons (la – si bémol / la – mi selon l'époque), au loin
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.3); g.gain.linearRampToValueAtTime(0.06, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + 2.8);
      const o = ctx.createOscillator(); o.type = 'square';
      for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 585 : 435, t + i * 0.45);
      o.connect(lp).connect(g).connect(sfxBus); o.start(t); o.stop(t + 2.9);
      break;
    }
  }
}

// ————— Ambiances —————
function startAmbience(kind: string): { stop: () => void } {
  const c = ctx!;
  const nodes: AudioScheduledSourceNode[] = [];
  const base = c.createBufferSource(); base.buffer = noiseBuf; base.loop = true;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'ville' ? 380 : 220;
  const g = c.createGain(); g.gain.value = kind === 'ville' ? 0.5 : 0.18;
  base.connect(f).connect(g).connect(ambBus); base.start();
  nodes.push(base);
  let alive = true;
  const loop = () => {
    if (!alive || !ctx) return;
    const t = ctx.currentTime;
    if (t - lastAmbTick > 0.5) {
      lastAmbTick = t;
      const r = Math.random();
      if (kind.startsWith('bureau')) {
        if (r < 0.35) {
          // frappe au loin : machine à écrire ou clavier
          for (let i = 0; i < 5 + Math.floor(Math.random() * 8); i++) noise(t + i * (0.08 + Math.random() * 0.06), 0.03, kind.endsWith('machine') ? 2200 : 4200, 'bandpass', kind.endsWith('machine') ? 0.12 : 0.06, ambBus, 2);
        } else if (r < 0.4) noise(t, 0.25, 3000, 'bandpass', 0.06, ambBus, 0.5);
        else if (r < 0.43) { for (let i = 0; i < 6; i++) tone(t + i * 0.04, kind.endsWith('machine') ? 1100 : 1000, 0.04, 'triangle', 0.02, ambBus); }
      } else if (kind === 'ville') {
        if (r < 0.06) tone(t, 360 + Math.random() * 80, 0.25, 'sawtooth', 0.02, ambBus); // klaxon lointain
        else if (r < 0.3) { const s = c.createBufferSource(); s.buffer = noiseBuf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(200, t); bp.frequency.linearRampToValueAtTime(500, t + 1.2); bp.frequency.linearRampToValueAtTime(180, t + 2.4); const gg = c.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.35, t + 1.2); gg.gain.linearRampToValueAtTime(0.0001, t + 2.4); s.connect(bp).connect(gg).connect(ambBus); s.start(t); s.stop(t + 2.5); } // voiture qui passe
        else if (r < 0.34) for (let i = 0; i < 3; i++) tone(t + i * 0.12, 2600 + Math.random() * 900, 0.08, 'sine', 0.015, ambBus); // oiseaux
      }
    }
    window.setTimeout(loop, 400 + Math.random() * 900);
  };
  loop();
  return { stop: () => { alive = false; for (const n of nodes) { try { n.stop(); } catch { /* déjà arrêté */ } } } };
}
