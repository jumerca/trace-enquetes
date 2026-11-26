// Événements dynamiques, météo, médias fictifs autonomes et accueil du public.
// La ville évolue indépendamment des décisions de la brigade.
import type { Rng } from '../core/rng';
import { calendar, MIN_D, MIN_H } from './calendar';
import { caseLog, notify } from './log';
import { makeMagistrate, MAG_LABEL, reopen } from './justice';
import { charges } from './knowledge';
import { pname } from './investigation';
import { fullName } from './staff';
import { capacities } from './station';
import type { Case, CityEvent, GameState } from './types';

export function outlets(year: number) {
  const o = ['Le Courrier de Saint-Clair', 'Radio Val-de-Clair'];
  if (year >= 1985) o.push('Télé Val 3');
  if (year >= 2005) o.push('SaintClair-Info.fr');
  if (year >= 2015) o.push('Fil d\'actu Val (réseaux sociaux)');
  return o;
}

// ————— Météo —————
export function updateWeather(st: GameState, rng: Rng) {
  if (st.minute < st.weather.until) return;
  const c = calendar(st.startYear, st.minute);
  const r = rng.next();
  const storm = st.events.find((e) => e.kind === 'tempete' && e.start <= st.minute && e.end > st.minute);
  const snowEv = st.events.find((e) => e.kind === 'neige' && e.start <= st.minute && e.end > st.minute);
  let kind: GameState['weather']['kind'];
  if (storm) kind = 'orage';
  else if (snowEv) kind = 'neige';
  else if (c.season === 'hiver') kind = r < 0.25 ? 'pluie' : r < 0.35 ? 'neige' : r < 0.5 ? 'brouillard' : r < 0.75 ? 'nuageux' : 'clair';
  else if (c.season === 'ete') kind = r < 0.1 ? 'orage' : r < 0.2 ? 'pluie' : r < 0.4 ? 'nuageux' : 'clair';
  else kind = r < 0.3 ? 'pluie' : r < 0.4 ? 'brouillard' : r < 0.65 ? 'nuageux' : 'clair';
  const base = { hiver: 4, printemps: 13, ete: 23, automne: 12 }[c.season];
  st.weather = { kind, temp: Math.round(base + rng.range(-5, 5)), until: st.minute + rng.int(4, 18) * MIN_H };
}

// ————— Événements —————
interface EvDef { kind: CityEvent['kind']; p: number; make: (st: GameState, rng: Rng) => Omit<CityEvent, 'id'> | null }

const EVENTS: EvDef[] = [
  { kind: 'festival', p: 0.012, make: (st, rng) => { const c = calendar(st.startYear, st.minute); if (c.season !== 'ete' && c.season !== 'printemps') return null; return { kind: 'festival', title: 'Festival des Remparts', text: 'Le festival attire des milliers de visiteurs dans la vieille ville : vols et pertes de documents plus fréquents.', start: st.minute, end: st.minute + rng.int(3, 5) * MIN_D, district: 'vieille', incidentFactor: 1.6 }; } },
  { kind: 'sport', p: 0.01, make: (st, rng) => ({ kind: 'sport', title: 'Match de coupe au stade', text: 'Grande affluence autour de la gare et du centre : vols de véhicules et incidents en hausse.', start: st.minute + MIN_D, end: st.minute + MIN_D + rng.int(1, 2) * MIN_D, district: 'gare', incidentFactor: 1.5 }) },
  { kind: 'tourisme', p: 0.02, make: (st) => { const c = calendar(st.startYear, st.minute); if (c.month !== 6 || st.events.some((e) => e.kind === 'tourisme' && e.end > st.minute)) return null; return { kind: 'tourisme', title: 'Saison touristique', text: 'Camping et château affichent complet jusqu\'à fin août.', start: st.minute, end: st.minute + 55 * MIN_D, district: 'tourisme', incidentFactor: 1.4 }; } },
  { kind: 'tempete', p: 0.006, make: (st, rng) => ({ kind: 'tempete', title: 'Tempête sur le Val-de-Clair', text: 'Vents violents : routes coupées, interventions ralenties, constatations difficiles.', start: st.minute, end: st.minute + rng.int(1, 2) * MIN_D, incidentFactor: 0.7 }) },
  { kind: 'neige', p: 0.008, make: (st, rng) => (calendar(st.startYear, st.minute).season === 'hiver' ? { kind: 'neige', title: 'Épisode neigeux', text: 'Chaussées glissantes : déplacements plus longs.', start: st.minute, end: st.minute + rng.int(1, 3) * MIN_D, incidentFactor: 0.8 } : null) },
  { kind: 'panne', p: 0.005, make: (st, rng) => (calendar(st.startYear, st.minute).year < 1990 ? null : { kind: 'panne', title: 'Panne informatique', text: 'Le réseau du service est indisponible : recherches et rédaction ralenties.', start: st.minute, end: st.minute + rng.int(6, 30) * MIN_H, incidentFactor: 1 }) },
  { kind: 'route', p: 0.008, make: (st, rng) => ({ kind: 'route', title: 'Fermeture de la N12', text: 'Travaux sur la nationale : déplacements vers les villages allongés.', start: st.minute, end: st.minute + rng.int(3, 10) * MIN_D, district: 'axes', incidentFactor: 1 }) },
  { kind: 'magistrat', p: 0.002, make: (st, rng) => {
    const m = makeMagistrate(rng, st, 'procureur');
    const old = st.magistrates.findIndex((x) => x.role === 'procureur');
    if (old >= 0) st.magistrates.splice(old, 1, m); else st.magistrates.push(m);
    return { kind: 'magistrat', title: 'Nouveau procureur', text: `${m.prenom} ${m.nom} est nommé${m.prenom.endsWith('e') ? 'e' : ''} ${MAG_LABEL.procureur.toLowerCase()} : ${m.rigueur > 0.65 ? 'réputation d\'exigence sur la qualité des dossiers' : 'réputation de pragmatisme'}.`, start: st.minute, end: st.minute + 7 * MIN_D, incidentFactor: 1 };
  } },
  { kind: 'restriction', p: 0.0015, make: (st, rng) => {
    const cut = rng.range(0.05, 0.12);
    for (const k of Object.keys(st.budget.envelope) as (keyof typeof st.budget.envelope)[]) st.budget.envelope[k] = Math.round(st.budget.envelope[k] * (1 - cut) / 100) * 100;
    return { kind: 'restriction', title: 'Restrictions budgétaires', text: `Gel de crédits : l'enveloppe annuelle est réduite de ${Math.round(cut * 100)} %.`, start: st.minute, end: st.minute + 90 * MIN_D, incidentFactor: 1 };
  } },
  { kind: 'reouverture', p: 0.003, make: (st, rng) => {
    const cands = st.cases.filter((c) => c.status === 'classee' && c.truth.culprit && c.clues.some((k) => !k.found) && st.minute - (c.outcome?.at ?? 0) > 60 * MIN_D);
    if (!cands.length) return null;
    const c = rng.pick(cands);
    reopen(st, c, rng.pick(['un témoin se manifeste après un article de presse', 'une technique d\'analyse nouvelle permet de réexaminer les scellés', 'la victime apporte un document retrouvé']));
    for (const k of c.clues) k.difficulty = Math.max(2, k.difficulty - 2);
    return { kind: 'reouverture', title: 'Réouverture d\'une affaire', text: `« ${c.title} » est rouvert.`, start: st.minute, end: st.minute + MIN_D, incidentFactor: 1 };
  } },
  { kind: 'mediatique', p: 0.004, make: (st, rng) => {
    const open = st.cases.filter((c) => c.status === 'ouverte' && c.mediaInterest > 0.3);
    if (!open.length) return null;
    const c = rng.pick(open);
    c.mediaInterest = Math.min(1, c.mediaInterest + 0.3);
    return { kind: 'mediatique', title: 'Affaire très médiatisée', text: `La presse nationale s'intéresse à « ${c.title} ».`, start: st.minute, end: st.minute + 10 * MIN_D, incidentFactor: 1 };
  } },
];

export function rollEvents(st: GameState, rng: Rng) {
  // appelé une fois par heure
  for (const d of EVENTS) {
    if (st.events.some((e) => e.kind === d.kind && e.end > st.minute)) continue;
    if (!rng.chance(d.p / 24)) continue; // p : probabilité par jour
    const ev = d.make(st, rng);
    if (!ev) continue;
    const e: CityEvent = { ...ev, id: `E${++st.counters.event}` };
    st.events.push(e);
    notify(st, { level: e.kind === 'tempete' || e.kind === 'restriction' || e.kind === 'reouverture' ? 'urgent' : 'alerte', text: `${e.title} — ${e.text}` });
  }
  st.events = st.events.filter((e) => e.end > st.minute - 60 * MIN_D);
}

export function incidentFactor(st: GameState, district?: string): number {
  let f = 1;
  for (const e of st.events) if (e.start <= st.minute && e.end > st.minute && (!e.district || e.district === district)) f *= e.incidentFactor;
  // zones rurales : la coopération avec la gendarmerie pèse sur la délinquance
  if ((district === 'rural' || district === 'villages' || district === 'foret') && st.partners) {
    const p = st.partners.list.find((x) => x.kind === 'gendarmerie');
    if (p) f *= 1.1 - p.relation / 100 * 0.25;
  }
  return f;
}

export function eventActive(st: GameState, kind: CityEvent['kind']) {
  return st.events.some((e) => e.kind === kind && e.start <= st.minute && e.end > st.minute);
}

// ————— Médias —————
export function mediaTick(st: GameState, rng: Rng) {
  // appelé une fois par heure
  const year = calendar(st.startYear, st.minute).year;
  const out = outlets(year);
  for (const c of st.cases) {
    if (c.mediaInterest < 0.25) continue;
    const ageD = (st.minute - c.openedAt) / MIN_D;
    const has = st.articles.filter((a) => a.caseId === c.id);
    // premier article : couverture de l'affaire (informations publiques uniquement)
    if (!has.length && ageD > 0.3 && rng.chance(c.mediaInterest * 0.15)) {
      article(st, rng.pick(out), c, `${c.title.replace(/—.*/, '').trim()} : l'enquête est ouverte`, `Une enquête a été confiée à la brigade de ${st.city.name}. Les enquêteurs n'ont fait aucun commentaire à ce stade.`, 0);
      if (rng.chance(0.4)) st.mediaRequests.push({ id: `MR${++st.counters.media}`, outlet: rng.pick(out), caseId: c.id, at: st.minute, until: st.minute + 2 * MIN_D, answered: false });
    } else if (c.status === 'ouverte' && ageD > 12 && has.length < 3 && rng.chance(c.mediaInterest * 0.02)) {
      article(st, rng.pick(out), c, `${c.title.split('—')[0].trim()} : l'enquête piétine-t-elle ?`, `Près de ${Math.round(ageD)} jours après les faits, aucune avancée n'a été rendue publique. Des riverains s'inquiètent.`, -0.6);
      st.publicTrust = Math.max(0, st.publicTrust - 1.5);
    } else if (c.outcome?.verdict && !has.some((a) => a.title.includes('jugement'))) {
      article(st, rng.pick(out), c, `${c.title.split('—')[0].trim()} : le jugement est tombé`, c.outcome.verdict === 'condamnation' ? 'Le tribunal a retenu la culpabilité de la personne poursuivie.' : 'La personne poursuivie a été relaxée.', c.outcome.verdict === 'condamnation' && c.outcome.correct ? 0.5 : -0.4);
    }
  }
  // une information erronée circule parfois ; elle peut être rectifiée par communiqué
  if (rng.chance(0.004)) {
    const c = st.cases.find((x) => x.status === 'ouverte' && x.mediaInterest > 0.3);
    if (c) article(st, rng.pick(out), c, `${c.title.split('—')[0].trim()} : une piste évoquée par la rumeur`, 'Selon une source non identifiée, un suspect aurait déjà été interpellé. Aucune confirmation officielle.', -0.3, true);
  }
  for (const r of st.mediaRequests) if (!r.answered && st.minute > r.until) {
    r.answered = true;
    const c = st.cases.find((x) => x.id === r.caseId);
    if (c) article(st, r.outlet, c, `${c.title.split('—')[0].trim()} : silence de la police`, 'Sollicitée, la brigade n\'a pas répondu à nos questions.', -0.3);
    st.publicTrust = Math.max(0, st.publicTrust - 0.5);
  }
  st.articles = st.articles.slice(-200);
  // demandes de déclaration traitées : conservées 30 jours, 60 au plus
  st.mediaRequests = st.mediaRequests.filter((r) => !r.answered || st.minute - r.until < 30 * MIN_D).slice(-60);
}

function article(st: GameState, outlet: string, c: Case, title: string, body: string, tone: number, erroneous = false) {
  st.articles.push({ id: `AR${++st.counters.media}`, outlet, minute: st.minute, title, body, tone, caseId: c.id, erroneous });
  notify(st, { level: tone < 0 ? 'alerte' : 'info', text: `${outlet} : « ${title} »`, caseId: c.id });
}

export type Statement = 'faits' | 'appel_temoins' | 'rectification' | 'aucun' | 'nommer';

/** Communication institutionnelle : faits confirmés uniquement. Citer un nom porte atteinte
 * à la présomption d'innocence et à la confidentialité de l'enquête. */
export function makeStatement(st: GameState, rng: Rng, c: Case, kind: Statement): string {
  const year = calendar(st.startYear, st.minute).year;
  const outlet = rng.pick(outlets(year));
  for (const r of st.mediaRequests) if (r.caseId === c.id) r.answered = true;
  if (kind === 'faits') {
    article(st, outlet, c, `${c.title.split('—')[0].trim()} : la brigade fait le point`, 'Le commandant a présenté les faits établis et rappelé que l\'enquête se poursuit.', 0.4);
    st.publicTrust = Math.min(100, st.publicTrust + (capacities(st).presse ? 2.5 : 1.5));
    return 'Communiqué diffusé : faits confirmés, sans élément confidentiel.';
  }
  if (kind === 'appel_temoins') {
    article(st, outlet, c, `${c.title.split('—')[0].trim()} : appel à témoins`, 'La brigade invite toute personne disposant d\'informations à se manifester.', 0.3);
    // un appel à témoins facilite l'enquête de voisinage
    for (const k of c.clues) if (k.action === 'voisinage' && !k.found) k.difficulty = Math.max(1, k.difficulty - 3);
    return 'Appel à témoins diffusé : les recherches de voisinage seront facilitées.';
  }
  if (kind === 'rectification') {
    const err = st.articles.find((a) => a.caseId === c.id && a.erroneous && !a.rectified);
    if (!err) return 'Aucune information erronée à rectifier.';
    err.rectified = true;
    article(st, err.outlet, c, `Rectificatif : ${err.title}`, 'Contrairement à ce qui avait été rapporté, aucune interpellation n\'a eu lieu à ce stade.', 0.2);
    st.publicTrust = Math.min(100, st.publicTrust + 1);
    return 'Rectificatif publié.';
  }
  if (kind === 'nommer') {
    const top = c.persons.filter((p) => p.known && p.role === 'suspect').map((p) => ({ p, ch: charges(c, p.pid).total })).sort((a, b) => b.ch - a.ch)[0];
    st.publicTrust = Math.max(0, st.publicTrust - 6);
    st.commander.reputation = Math.max(0, st.commander.reputation - 5);
    c.procedureFlaws++;
    const mag = st.magistrates.find((m) => m.role === 'procureur');
    if (mag) mag.relation = Math.max(0, mag.relation - 15);
    caseLog(st, c.id, 'Atteinte à la présomption d\'innocence : un nom a été communiqué à la presse. Le parquet rappelle la brigade à l\'ordre.');
    if (top) article(st, outlet, c, `${c.title.split('—')[0].trim()} : un nom circule`, `La police a laissé entendre que ${pname(st, top.p.pid)} serait impliqué.`, -0.8);
    return 'Le parquet vous rappelle à l\'ordre : la présomption d\'innocence et le secret de l\'enquête doivent être respectés.';
  }
  return 'Aucune déclaration.';
}

// ————— Accueil du public —————
export function receptionTick(st: GameState, rng: Rng, staffAtDesk: number) {
  const c = calendar(st.startYear, st.minute);
  if (c.hour < 8 || c.hour >= 19) return;
  const visitors = rng.chance(0.25 * Math.sqrt(st.city.population / 80000)) ? 1 : 0;
  if (!visitors) return;
  st.reception.visitors++;
  if (staffAtDesk > 0 && rng.chance(0.75 + Math.min(0.2, staffAtDesk * 0.1))) st.reception.satisfied++;
}

export function staffDeparture(st: GameState, rng: Rng) {
  // départ (mutation obtenue) d'un enquêteur au moral durablement bas
  const cand = st.staff.filter((s) => s.role !== 'commandant' && s.moral < 25 && s.requests.includes('mutation'));
  if (!cand.length || !rng.chance(0.02)) return;
  const s = rng.pick(cand);
  st.staff = st.staff.filter((x) => x !== s);
  for (const c of st.cases) {
    c.team = c.team.filter((x) => x !== s.id);
    if (c.lead === s.id) { c.lead = c.team[0] ?? null; caseLog(st, c.id, `Départ de ${fullName(s)} : le dossier doit être réattribué.`); }
  }
  st.events.push({ id: `E${++st.counters.event}`, kind: 'depart', title: 'Départ d\'un enquêteur', text: `${fullName(s)} a obtenu sa mutation et quitte la brigade.`, start: st.minute, end: st.minute + MIN_D, incidentFactor: 1 });
  notify(st, { level: 'urgent', text: `${fullName(s)} a obtenu sa mutation et quitte la brigade.` });
}
