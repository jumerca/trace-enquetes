import { age as ageOf, playerOvr } from '../data/generate';
import { fullName, type PlayerData } from '../data/model';
import { addNews, standings, user, type Career, type Offer } from './career';
import { extra } from './life';
import { salaryFor } from './world';

/**
 * Draft de l'American Pro League (fictive) : chaque été, les 12 clubs choisissent à tour de rôle
 * (du dernier au premier du classement, deux tours) les meilleurs espoirs de 19 à 22 ans
 * évoluant hors de la ligue. Un joueur ne peut être drafté qu'une fois.
 */
export interface DraftPick {
  pick: number;
  player: string;
  playerId: string;
  pos: string;
  age: number;
  from: string;
  to: string;
  toId: string;
  user: boolean;
}
export interface DraftState {
  results: { season: number; picks: DraftPick[] }[];
  rights: { clubId: string; pick: number; season: number } | null;
  userDrafted: boolean;
}

export function draftState(c: Career): DraftState {
  const x = extra(c) as ReturnType<typeof extra> & { draft?: DraftState };
  return (x.draft ??= { results: [], rights: null, userDrafted: false });
}

const LEAGUE = 'APL';
type Prospect = PlayerData & { drafted?: boolean };

export function draftExists(c: Career): boolean {
  return !!c.world.leagues[LEAGUE];
}

export function draftEligible(c: Career, p: Prospect): boolean {
  if (p.retired || p.drafted || !p.clubId) return false;
  const club = c.world.clubs[p.clubId];
  if (!club || club.leagueId === LEAGUE || !c.world.leagues[club.leagueId]) return false;
  const a = ageOf(p, c.world.season);
  return a >= 19 && a <= 22;
}

/** Cote d'un espoir aux yeux des recruteurs américains : potentiel d'abord, niveau actuel, exposition. */
export function draftScore(c: Career, p: PlayerData): number {
  const club = c.world.clubs[p.clubId!];
  const lvl = c.world.leagues[club.leagueId]?.level ?? 2;
  return p.potential * 0.58 + playerOvr(p) * 0.42 + (club.leagueId === 'NCB' ? 2.5 : lvl === 1 ? 1.5 : 0) + p.reputation / 25 - (ageOf(p, c.world.season) - 19) * 0.8;
}

/** Classement prévisionnel (« mock draft ») des 24 premiers choix. */
export function draftBoard(c: Career): { p: PlayerData; score: number }[] {
  return Object.values(c.world.players)
    .filter((p) => draftEligible(c, p))
    .map((p) => ({ p, score: draftScore(c, p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
}

export function userProjection(c: Career): { rank: number; eligible: boolean; reason: string } {
  const u = user(c) as Prospect;
  const st = draftState(c);
  if (!draftExists(c)) return { rank: 0, eligible: false, reason: 'La ligue américaine apparaîtra à la saison prochaine.' };
  if (st.userDrafted) return { rank: 0, eligible: false, reason: st.rights ? `Déjà drafté : ${c.world.clubs[st.rights.clubId]?.name} détient vos droits (choix n°${st.rights.pick}, ${st.rights.season}).` : 'Vous avez déjà été drafté.' };
  const a = ageOf(u, c.world.season);
  if (c.world.clubs[u.clubId!]?.leagueId === LEAGUE) return { rank: 0, eligible: false, reason: 'Vous évoluez déjà dans la ligue américaine.' };
  if (a < 19) return { rank: 0, eligible: false, reason: `Éligible à partir de 19 ans (dans ${19 - a} an(s)).` };
  if (a > 22) return { rank: 0, eligible: false, reason: 'La draft est réservée aux 19-22 ans. La ligue américaine reste accessible par un transfert.' };
  const rank = draftBoard(c).findIndex((x) => x.p.id === u.id) + 1;
  return { rank, eligible: true, reason: rank ? '' : 'Hors des 40 premiers espoirs suivis par les recruteurs.' };
}

function rookieSalary(ovr: number, pick: number): number {
  return Math.round((salaryFor(ovr, 1) * 5 * Math.max(0.5, 1.5 - pick * 0.04)) / 1000) * 1000;
}

export function rightsOffer(c: Career): Offer | null {
  const st = draftState(c);
  const u = user(c);
  if (!st.rights || c.world.clubs[u.clubId!]?.leagueId === LEAGUE) return null;
  const cl = c.world.clubs[st.rights.clubId];
  if (!cl) return null;
  return { id: `draft${c.world.season}`, clubId: cl.id, salary: rookieSalary(playerOvr(u), st.rights.pick), years: 3, role: st.rights.pick <= 5 ? 'starter' : 'rotation', note: `Draft APL · choix n°${st.rights.pick} (${st.rights.season}) · contrat rookie` };
}

/** Déroulement de la draft (appelé à l'intersaison, après les playoffs). */
export function runDraft(c: Career): void {
  if (!draftExists(c)) return;
  const w = c.world;
  const st = draftState(c);
  const u = user(c) as Prospect;
  const order = standings(c, LEAGUE).map((r) => r.clubId).reverse();
  const board = draftBoard(c).map((x) => x.p as Prospect);
  const picks: DraftPick[] = [];
  for (let n = 0; n < 24 && board.length; n++) {
    const clubId = order[n % order.length];
    const club = w.clubs[clubId];
    // Au second tour, les clubs privilégient un besoin de poste
    let i = 0;
    if (n >= 12) {
      const count = (pos: string) => club.roster.filter((id) => w.players[id]?.pos === pos).length;
      const need = board.slice(0, 5).findIndex((p) => count(p.pos) <= 2);
      if (need > 0) i = need;
    }
    const p = board.splice(i, 1)[0];
    const from = w.clubs[p.clubId!];
    p.drafted = true;
    picks.push({ pick: n + 1, player: fullName(p), playerId: p.id, pos: p.pos, age: ageOf(p, w.season), from: from.name, to: club.name, toId: clubId, user: p.id === u.id });
    if (p.id === u.id) {
      st.userDrafted = true;
      st.rights = { clubId, pick: n + 1, season: w.season };
      continue; // le joueur décide lui-même de traverser l'Atlantique ou non
    }
    // Premier tour : le joueur rejoint le club ; second tour : il reste dans son club (droits conservés)
    if (n < 12) {
      const out = club.roster.map((id) => w.players[id]).filter((x) => x && !x.isUser).sort((a, b) => playerOvr(a) - playerOvr(b))[0];
      from.roster = from.roster.filter((id) => id !== p.id);
      club.roster.push(p.id);
      p.clubId = clubId;
      p.contract = { clubId, salary: rookieSalary(playerOvr(p), n + 1), until: w.season + 3, role: 'rotation' };
      if (out) {
        club.roster = club.roster.filter((id) => id !== out.id);
        if (from.leagueId !== 'NCB') {
          from.roster.push(out.id);
          out.clubId = from.id;
          out.contract = { clubId: from.id, salary: salaryFor(playerOvr(out), w.leagues[from.leagueId].level), until: w.season + 2, role: 'starter' };
        } else {
          out.clubId = null;
          out.contract = null;
        }
      }
    }
  }
  st.results.unshift({ season: w.season, picks });
  st.results.length = Math.min(st.results.length, 6);
  const first = picks[0];
  if (first) addNews(c, 'league', `Draft APL : ${first.player} premier choix`, `${first.to} sélectionne ${first.player} (${first.pos}, ${first.age} ans, ${first.from}) en première position. Suivent ${picks.slice(1, 4).map((x) => `${x.player} (${x.to})`).join(', ')}.`, 'Hoops Wire');
  const mine = picks.find((x) => x.user);
  if (mine) {
    c.trophies.push({ season: w.season, title: `Drafté n°${mine.pick} par ${mine.to} (APL)`, kind: 'individual' });
    u.reputation = Math.min(100, u.reputation + (mine.pick <= 5 ? 12 : mine.pick <= 12 ? 8 : 4));
    addNews(c, 'award', `${fullName(u)} drafté en ${mine.pick}e position !`, `${mine.to} mise sur ${u.lastName} avec le choix n°${mine.pick} de la draft. ${mine.pick <= 12 ? 'Un choix du premier tour : le contrat est garanti.' : 'Choix du second tour : il faudra gagner sa place.'} Le joueur peut rejoindre la ligue américaine dès cet été ou poursuivre sa progression en Europe, le club conservant ses droits.`, 'Courtside Daily');
  } else if (draftEligible(c, { ...u, drafted: false } as Prospect) && ageOf(u, w.season) === 22) {
    addNews(c, 'league', `${u.lastName} non drafté`, `Dernière année d’éligibilité : aucun club américain n’a retenu ${fullName(u)}. La porte reste ouverte par un transfert classique.`, 'Hoops Wire');
  }
}

/** Article de projection en cours de saison (semaines 8 et 16). */
export function mockDraftNews(c: Career): void {
  if (!draftExists(c)) return;
  const pr = userProjection(c);
  const board = draftBoard(c);
  if (!board.length) return;
  const top = board.slice(0, 3).map((x, i) => `${i + 1}. ${fullName(x.p)} (${x.p.pos}, ${c.world.clubs[x.p.clubId!]?.short})`).join(' · ');
  const u = user(c);
  const mine = !pr.eligible ? '' : pr.rank && pr.rank <= 24 ? ` ${fullName(u)} est projeté en ${pr.rank}e position${pr.rank <= 12 ? ' : un premier tour' : ', au second tour'}.` : pr.rank ? ` ${u.lastName} pointe au ${pr.rank}e rang, hors des 24 choix pour l’instant.` : ` ${u.lastName} n’apparaît pas encore sur les tablettes des recruteurs.`;
  addNews(c, 'league', 'Draft APL : la projection de la rédaction', `Le trio de tête : ${top}.${mine}`, 'The Baseline');
}
