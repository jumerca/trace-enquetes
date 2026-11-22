// Petits utilitaires partagés par les modules de gestion.
import type { Career } from './career';
import type { Driver } from './data';

export function round1(v: number): number {
  return Math.round(v * 100) / 100;
}

export function addLedger(c: Career, label: string, amount: number, silent = false): void {
  if (!silent) c.budget = round1(c.budget + amount);
  c.ledger.push({ season: c.season, round: c.round, label, amount: round1(amount) });
  if (c.ledger.length > 250) c.ledger.splice(0, c.ledger.length - 250);
}

export function addNews(c: Career, text: string): void {
  c.news.unshift({ season: c.season, round: c.round, text });
  if (c.news.length > 50) c.news.length = 50;
}

/** Pilote titulaire (aligné en course) : rôle absent ou « titulaire ». */
export function isRaceDriver(d: Driver): boolean {
  return !!d.teamId && (d.role === undefined || d.role === 'titulaire');
}

export function fullName(d: Driver): string {
  return `${d.first} ${d.last}`;
}
