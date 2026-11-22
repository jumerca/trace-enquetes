// Modèle physique simplifié : profil de vitesse par voiture (adhérence mécanique + appui aéro, accélération, freinage).
import type { CarEntry, Compound, DriveMode, Weather } from './types';
import type { Track } from './track';

export interface CarPhysics {
  aMech: number; // adhérence latérale mécanique (m/s²)
  cAero: number; // gain d'adhérence aéro par v² (1/m)
  vTop: number; // vitesse de pointe (m/s)
  aAcc: number; // accélération max (m/s²)
  brake: number; // décélération mécanique (m/s²)
}

export function physicsFor(e: Pick<CarEntry, 'driver' | 'car' | 'setup'>, track: Track, weather: Weather): CarPhysics {
  const d = e.driver, c = e.car, st = e.setup;
  const aero = st.aileron / 100, gear = st.boite / 100;
  const suspDev = Math.abs(st.suspension - track.def.suspOpt) / 100;
  const wet = weather === 'pluie';
  return {
    aMech: 10.5 * (1 + 0.0022 * (c.chassis - 10)) * (1 + 0.0018 * (d.vitesse - 10)) * (1 - 0.06 * suspDev) * (wet ? 0.74 : 1),
    cAero: 0.0034 * (1 + 0.007 * (c.aero - 10)) * (1 + 0.24 * (aero - 0.5) - 0.3 * (aero - 0.5) * (aero - 0.5)) * (1 + 0.0014 * (d.vitesse - 10)) * (wet ? 0.8 : 1),
    vTop: 88 * (1 + 0.0024 * (c.moteur - 10)) * (1 - 0.07 * (aero - 0.5)) * (1 + 0.07 * (gear - 0.5)),
    aAcc: 13 * (1 + 0.005 * (c.moteur - 10)) * (1 - 0.06 * (gear - 0.5) - 0.12 * (gear - 0.5) * (gear - 0.5)) * (1 - 0.08 * (aero - 0.5)) * (wet ? 0.85 : 1),
    brake: 15.5 * (1 + 0.002 * (c.chassis - 10)) * (wet ? 0.8 : 1),
  };
}

/** Profil de vitesse « tour idéal » (m/s) pour chaque échantillon du circuit. */
export function speedProfile(track: Track, p: CarPhysics): Float32Array {
  const n = track.n, ds = track.ds;
  const v = new Float32Array(n);
  let iMin = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.abs(track.curv[i]) * 0.92;
    let vm = p.vTop;
    if (k > 1e-5) {
      const R = 1 / k;
      const den = 1 - p.cAero * R;
      if (den > 0.02) vm = Math.min(p.vTop, Math.sqrt((p.aMech * R) / den));
    }
    v[i] = vm;
    if (vm < v[iMin]) iMin = i;
  }
  // Accélération (passe avant) depuis le point le plus lent.
  for (let k = 1; k <= n; k++) {
    const i = (iMin + k) % n, j = (iMin + k - 1) % n;
    const r = v[j] / p.vTop;
    const acc = p.aAcc * Math.max(0.05, 1 - r * r * r);
    v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * acc * ds));
  }
  // Freinage (passe arrière).
  for (let k = 1; k <= 2 * n; k++) {
    const i = ((iMin - k) % n + n) % n, j = (i + 1) % n;
    const dec = p.brake + 0.0056 * v[j] * v[j];
    v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * dec * ds));
  }
  return v;
}

export function profileLapTime(track: Track, prof: Float32Array): number {
  let t = 0;
  for (let i = 0; i < track.n; i++) t += track.ds / prof[i];
  return t;
}

export const COMPOUNDS: Record<Compound, { name: string; color: string; grip: number; wear: number }> = {
  T: { name: 'Tendre', color: '#e5383b', grip: 1.0065, wear: 1.55 },
  M: { name: 'Médium', color: '#f2c14e', grip: 1.0, wear: 1.0 },
  D: { name: 'Dur', color: '#f4f1ea', grip: 0.9945, wear: 0.68 },
  P: { name: 'Pluie', color: '#3a86ff', grip: 0.985, wear: 0.9 },
};

/** Facteur de rythme lié aux pneus (compound, usure, météo). */
export function tyreFactor(c: Compound, wear: number, weather: Weather): number {
  let g = COMPOUNDS[c].grip;
  if (weather === 'pluie') g = c === 'P' ? 1.0 : 0.87;
  else if (c === 'P') g = 0.955;
  g *= 1 - 0.00012 * wear - Math.max(0, wear - 65) * 0.0011 - Math.max(0, wear - 95) * 0.01;
  return g;
}

export function tyreWearRate(c: Compound, weather: Weather): number {
  if (c === 'P') return weather === 'pluie' ? 0.9 : 2.6;
  return COMPOUNDS[c].wear * (weather === 'pluie' ? 0.75 : 1);
}

export const MODE_PACE: Record<DriveMode, number> = { attaque: 1.004, normal: 1, eco: 0.993 };
export const MODE_WEAR: Record<DriveMode, number> = { attaque: 1.3, normal: 1, eco: 0.72 };
export const MODE_ERR: Record<DriveMode, number> = { attaque: 1.8, normal: 1, eco: 0.6 };
