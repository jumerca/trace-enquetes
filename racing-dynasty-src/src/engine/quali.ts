// Tours chronométrés isolés (essais, qualifications) calculés avec le même modèle physique que la course.
import type { Rng } from './rng';
import type { Track } from './track';
import { physicsFor, profileLapTime, speedProfile, tyreFactor, MODE_PACE } from './physics';
import type { CarEntry, CarSetup, Compound, Weather } from './types';

type LapEntry = Pick<CarEntry, 'driver' | 'car' | 'setup'>;

export function idealLap(track: Track, e: LapEntry, weather: Weather): number {
  return profileLapTime(track, speedProfile(track, physicsFor(e, track, weather)));
}

export interface TimedLap {
  time: number;
  mistake: boolean;
}

/** Un tour lancé : temps idéal × pneus × engagement, plus la dispersion du pilote et un risque d'erreur. */
export function timedLap(track: Track, e: LapEntry, weather: Weather, compound: Compound, push: boolean, rng: Rng): TimedLap {
  const base = idealLap(track, e, weather) / (tyreFactor(compound, push ? 0 : 15, weather) * (push ? MODE_PACE.attaque * 1.006 : 1));
  const d = e.driver;
  const sd = 0.0021 * (1.35 - d.regularite / 20) * (weather === 'pluie' ? 1.6 - d.pluie / 40 : 1);
  let t = base * (1 + rng.normal(0, sd));
  if (weather === 'pluie') t *= 1 - (d.pluie - 10) * 0.0011;
  const errP = (push ? 0.07 : 0.03) * (1.5 - d.regularite / 20) * (weather === 'pluie' ? 2 : 1);
  const mistake = rng.chance(errP);
  if (mistake) t += rng.range(0.35, 2.4);
  return { time: t, mistake };
}

/** Recherche du réglage optimal (aileron, boîte) pour une voiture sur un circuit. */
export function optimalSetup(track: Track, e: Omit<LapEntry, 'setup'>, weather: Weather): CarSetup {
  let best = { aileron: 50, suspension: track.def.suspOpt, boite: 50 };
  let bt = Infinity;
  for (let a = 0; a <= 100; a += 5) {
    for (let b = 0; b <= 100; b += 10) {
      const s = { aileron: a, suspension: track.def.suspOpt, boite: b };
      const t = idealLap(track, { ...e, setup: s }, weather);
      if (t < bt) {
        bt = t;
        best = s;
      }
    }
  }
  return best;
}

export interface SetupFeedback {
  axis: keyof CarSetup;
  dir: -1 | 0 | 1;
  text: string;
}

/**
 * Retour du pilote après un relais : direction de réglage qui améliorerait le chrono.
 * La précision dépend de la connaissance accumulée (0..1) et de l'expérience du pilote.
 */
export function setupFeedback(track: Track, e: LapEntry, weather: Weather, knowledge: number, rng: Rng): SetupFeedback[] {
  const out: SetupFeedback[] = [];
  const base = idealLap(track, e, weather);
  const labels: Record<keyof CarSetup, [string, string, string]> = {
    aileron: ["Il faudrait plus d'appui, la voiture glisse en courbe.", "Trop d'appui : on manque de vitesse en ligne droite.", "L'équilibre aéro me convient."],
    suspension: ['La voiture est trop souple, elle flotte.', 'Trop raide : on rebondit sur les vibreurs.', 'Suspensions bien réglées.'],
    boite: ['Rapports trop courts : on tape le rupteur en ligne droite.', 'Rapports trop longs : on manque de reprise.', 'Étagement de boîte correct.'],
  };
  for (const axis of ['aileron', 'suspension', 'boite'] as (keyof CarSetup)[]) {
    let dir: -1 | 0 | 1 = 0;
    if (axis === 'suspension') {
      const diff = track.def.suspOpt - e.setup.suspension;
      dir = Math.abs(diff) <= 6 ? 0 : diff > 0 ? 1 : -1;
    } else {
      const up = { ...e.setup, [axis]: Math.min(100, e.setup[axis] + 8) };
      const dn = { ...e.setup, [axis]: Math.max(0, e.setup[axis] - 8) };
      const tu = idealLap(track, { ...e, setup: up }, weather);
      const td = idealLap(track, { ...e, setup: dn }, weather);
      const gain = Math.min(tu, td) - base;
      dir = gain < -0.025 ? (tu < td ? 1 : -1) : 0;
    }
    // Un pilote peu expérimenté ou une faible connaissance peuvent brouiller le retour.
    const clarity = 0.55 + 0.35 * knowledge + 0.1 * (e.driver.regularite / 20);
    if (!rng.chance(clarity)) dir = rng.pick([-1, 0, 1] as const);
    out.push({ axis, dir, text: dir === 1 ? labels[axis][0] : dir === -1 ? labels[axis][1] : labels[axis][2] });
  }
  return out;
}
