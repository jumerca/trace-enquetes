import type { Rng } from '../core/rng';
import { age as ageOf, playerOvr } from '../data/generate';
import { fullName } from '../data/model';
import { addNews, perGame, rngFor, standings, teamLevel, user, userClub, type Career } from './career';
import { fixtureName } from './competitions';
import type { SeasonStat } from './fastsim';
import { desk, extra } from './life';
import type { Fixture, UserGameLine } from './world';

/**
 * Presse : tous les articles sont écrits à partir de faits réellement simulés (scores, statistiques,
 * classements, séries, intérêt des clubs). Les médias sont fictifs et dépendent du pays du championnat.
 */
const OUTLETS: Record<string, string[]> = {
  FRA: ['Basket Hebdo', 'Le Parquet', 'Radio Sport Info', 'La Gazette du Cercle'],
  ESP: ['Canasta Diaria', 'El Rebote'],
  ITA: ['Gazzetta del Canestro', 'Tiro Libero'],
  GER: ['Korb Kurier', 'Sport Rundschau'],
  GRE: ['Basket Nea', 'Athlitiki Imera'],
  TUR: ['Pota Gazetesi', 'Spor Akşam'],
  USA: ['Courtside Daily', 'Hoops Wire', 'The Baseline'],
};

export function outlet(c: Career, rng: Rng): string {
  const country = userClub(c).country;
  return rng.pick(OUTLETS[country] ?? OUTLETS.FRA);
}

function who(c: Career): string {
  const u = user(c);
  const a = ageOf(u, c.world.season);
  const r = u.reputation;
  if (r >= 75) return `la star ${u.lastName}`;
  if (r >= 50) return `${u.lastName}, valeur sûre du championnat`;
  if (a <= 20) return `le jeune ${u.lastName} (${a} ans)`;
  if (a >= 32) return `le vétéran ${u.lastName}`;
  return fullName(u);
}

function pct(m: number, a: number): string {
  return a ? `${Math.round((m / a) * 100)} %` : '—';
}

/** Compte rendu de match : ton et angle selon l'écart, l'enjeu, la performance et le meilleur marqueur réel. */
export function matchArticle(c: Career, f: Fixture, l: UserGameLine, won: boolean, lines: Map<string, SeasonStat>, sideId: string): void {
  const u = user(c);
  const me = c.world.clubs[sideId];
  const opp = c.world.clubs[f.home === sideId ? f.away : f.home];
  const us = f.home === sideId ? f.hs : f.as;
  const them = f.home === sideId ? f.as : f.hs;
  const margin = Math.abs(us - them);
  const rng = rngFor(c, 'press' + f.id);
  const src = outlet(c, rng);
  const comp = fixtureName(c, f);
  const home = f.home === sideId;
  // Meilleur marqueur du match (toutes équipes)
  let top: { id: string; pts: number } | null = null;
  for (const [id, st] of lines) if (!top || st.pts > top.pts) top = { id, pts: st.pts };
  const topP = top ? c.world.players[top.id] : null;
  const topTxt = topP && top && topP.id !== u.id ? ` ${fullName(topP)} termine meilleur marqueur de la rencontre avec ${top.pts} points.` : top && topP?.id === u.id ? ` ${u.lastName} est le meilleur marqueur du match.` : '';
  const shape = margin >= 18 ? 'blowout' : margin <= 4 ? 'close' : 'normal';
  const venue = home ? 'devant son public' : `sur le parquet de ${opp.name}`;
  const res =
    shape === 'blowout'
      ? won
        ? rng.pick([`${me.name} déroule ${venue}`, `Démonstration de ${me.short} (${us}-${them})`, `${me.short} ne fait qu’une bouchée de ${opp.short}`])
        : rng.pick([`${me.name} sombre ${venue}`, `Lourde défaite pour ${me.short} (${us}-${them})`, `${opp.short} inflige une correction à ${me.short}`])
      : shape === 'close'
        ? won
          ? rng.pick([`${me.short} arrache la victoire (${us}-${them})`, `Succès au bout du suspense pour ${me.name}`, `${me.short} tient bon dans le money time`])
          : rng.pick([`${me.short} craque sur le fil (${us}-${them})`, `Cruelle défaite pour ${me.name}`, `${opp.short} s’impose d’un souffle`])
        : won
          ? rng.pick([`${me.short} s’impose face à ${opp.short} (${us}-${them})`, `Victoire maîtrisée pour ${me.name}`, `${me.short} fait le travail ${venue}`])
          : rng.pick([`${me.short} s’incline face à ${opp.short} (${us}-${them})`, `${me.name} n’a pas trouvé la solution`, `Coup d’arrêt pour ${me.short}`]);
  const stake = f.stage === 'final' ? ' Le titre était en jeu.' : f.stage === 'semi' ? ' Match à élimination directe.' : f.stage === 'cup' ? ` ${f.label ?? 'Coupe'} : ${won ? 'la qualification est acquise' : 'l’aventure s’arrête là'}.` : f.stage === 'nat' ? ' Rencontre internationale.' : f.stage === 'youth' ? ' Rencontre du championnat Espoirs.' : '';
  let title = res;
  let para: string;
  if (l.min <= 0) {
    para = `${rng.pick([`${who(c)} n’a pas quitté le banc.`, `Pas de temps de jeu pour ${u.lastName} ce soir.`, `${u.lastName} est resté en survêtement.`])} ${rng.pick(['Le staff lui demande de rester patient.', 'Il faudra convaincre à l’entraînement.', 'La concurrence à son poste est rude.'])}`;
  } else {
    const stat = `${l.pts} points (${l.fgm}/${l.fga} aux tirs${l.tpa ? `, ${l.tpm}/${l.tpa} à 3 points` : ''}), ${l.reb} rebonds et ${l.ast} passes en ${l.min} minutes`;
    const dd = [l.pts, l.reb, l.ast].filter((v) => v >= 10).length;
    if (dd >= 3) title = `Triple-double pour ${u.lastName} !`;
    else if (l.rating >= 8.5 || l.pts >= 25) title = rng.pick([`${u.lastName} crève l’écran contre ${opp.short}`, `Récital de ${u.lastName}`, `${u.lastName}, la soirée parfaite`, `${l.pts} points : ${u.lastName} en état de grâce`]);
    else if (l.rating < 4.3 && l.min >= 12) title = rng.pick([`Soirée à oublier pour ${u.lastName}`, `${u.lastName} passe à côté`, `${u.lastName} en manque de repères`]);
    const verdict =
      l.rating >= 8
        ? rng.pick(['Une prestation de patron.', 'Il a porté son équipe.', 'Le public s’est levé plus d’une fois.'])
        : l.rating >= 6.5
          ? rng.pick(['Une copie propre.', 'Solide des deux côtés du terrain.', 'Une sortie convaincante.'])
          : l.rating >= 5
            ? rng.pick(['Une prestation honnête, sans éclat.', 'Du bon et du moins bon.', 'Il peut mieux faire.'])
            : rng.pick(['Trop de déchet ce soir.', 'Il n’a jamais trouvé son rythme.', 'Une soirée compliquée.']);
    const extraLine = dd === 2 ? ' Il signe un double-double.' : l.tpm >= 4 ? ` Avec ${l.tpm} tirs primés, il a fait mal de loin.` : l.stl + l.blk >= 4 ? ' Son activité défensive a pesé.' : l.tov >= 5 ? ` Ses ${l.tov} balles perdues ont coûté cher.` : l.pm >= 12 ? ` Avec lui sur le parquet, son équipe a dominé (+${l.pm}).` : l.pm <= -12 ? ` Son équipe a souffert quand il était en jeu (${l.pm}).` : '';
    para = `${who(c).replace(/^./, (x) => x.toUpperCase())} compile ${stat}, note ${l.rating.toFixed(1)}. ${verdict}${extraLine}`;
  }
  const coachQ = won
    ? rng.pick(['« On a défendu ensemble, c’est la clé. »', '« Je suis content de l’énergie du banc. »', '« Il faudra confirmer la semaine prochaine. »', '« Le groupe a répondu présent. »', '« On a respecté le plan de jeu pendant quarante minutes. »'])
    : rng.pick(['« Trop de pertes de balle, on doit être plus lucides. »', '« On n’a pas su contrôler le rebond. »', '« La défense n’a pas tenu dans les moments clés. »', '« On a manqué d’agressivité. »', '« Il faut vite relever la tête. »']);
  addNews(c, 'match', title, `${comp}. ${me.name} ${won ? 'bat' : 's’incline contre'} ${opp.name} ${us}-${them}.${stake} ${para}${topTxt} ${me.coach.name} : ${coachQ}`, src);
}

interface PressMem {
  repTier?: number;
  ptsMile?: number;
  lastStreak?: string;
}
function mem(c: Career): PressMem {
  const x = extra(c) as ReturnType<typeof extra> & { press?: PressMem };
  return (x.press ??= {});
}

/** Articles de la semaine : rubrique tournante + sujets déclenchés par des faits (séries, caps, coach menacé…). */
export function weeklyPress(c: Career, rng: Rng): void {
  const w = c.world;
  const u = user(c);
  const club = userClub(c);
  const lid = club.leagueId;
  const league = w.leagues[lid];
  if (!league) return;
  const st = standings(c, lid);
  const src = outlet(c, rng);
  const myRank = st.findIndex((r) => r.clubId === club.id) + 1;
  const m = mem(c);
  if (c.phase === 'regular') {
    switch (c.week % 8) {
      case 0: {
        const lead = w.clubs[st[0].clubId];
        const second = w.clubs[st[1].clubId];
        const gap = st[0].w - st[1].w;
        addNews(c, 'league', gap >= 2 ? rng.pick([`${lead.name} creuse l’écart`, `${lead.name} s’envole en tête`, `Qui arrêtera ${lead.name} ?`]) : rng.pick([`${lead.name} et ${second.name} au coude-à-coude`, `Duel au sommet entre ${lead.short} et ${second.short}`, `${league.name} : la tête ne tient qu’à un fil`]), `Après ${c.week} journées de ${league.name}, ${lead.name} mène avec ${st[0].w} victoires pour ${st[0].l} défaites, devant ${second.name} (${st[1].w}-${st[1].l}). ${club.name} est ${myRank}e. ${myRank <= 4 ? 'Le Final Four est à portée.' : myRank >= st.length - 1 ? 'La zone rouge inquiète.' : `Il manque ${Math.max(1, st[3].w - (st[myRank - 1]?.w ?? 0))} victoire(s) pour entrer dans le top 4.`}`, src);
        break;
      }
      case 1: {
        const rows = league.teams.flatMap((t) => w.clubs[t].roster).map((id) => ({ p: w.players[id], s: perGame(c.seasonStats[id]) })).filter((r) => r.p && r.s.gp >= Math.max(2, c.week / 3)).sort((a, b) => b.s.ppg - a.s.ppg).slice(0, 5);
        if (rows.length >= 3) {
          const pos = rows.findIndex((r) => r.p.isUser);
          addNews(c, 'league', rng.pick([`Les meilleurs marqueurs de ${league.name}`, `${fullName(rows[0].p)} domine le classement des marqueurs`, `Course au titre de meilleur marqueur : le point`]), `${rows.map((r, i) => `${i + 1}. ${fullName(r.p)} (${w.clubs[r.p.clubId!]?.short}) ${r.s.ppg.toFixed(1)} pts`).join(' · ')}. ${pos >= 0 ? `${u.lastName} figure à la ${pos + 1}e place.` : perGame(c.seasonStats[u.id]).gp ? `${u.lastName} tourne à ${perGame(c.seasonStats[u.id]).ppg.toFixed(1)} points.` : ''}`, src);
        }
        break;
      }
      case 2: {
        const hot = [...st].filter((r) => r.streak.startsWith('V')).sort((a, b) => Number(b.streak.slice(1)) - Number(a.streak.slice(1)))[0];
        const cold = [...st].filter((r) => r.streak.startsWith('D')).sort((a, b) => Number(b.streak.slice(1)) - Number(a.streak.slice(1)))[0];
        if (hot && Number(hot.streak.slice(1)) >= 3) addNews(c, 'league', `${w.clubs[hot.clubId].name} : ${hot.streak.slice(1)} victoires de rang`, `L’équipe en forme du moment en ${league.name}. ${cold && Number(cold.streak.slice(1)) >= 3 ? `À l’inverse, ${w.clubs[cold.clubId].name} reste sur ${cold.streak.slice(1)} défaites consécutives.` : ''}`, src);
        else if (cold && Number(cold.streak.slice(1)) >= 3) addNews(c, 'league', `${w.clubs[cold.clubId].name} s’enfonce`, `${cold.streak.slice(1)} défaites de suite : l’inquiétude grandit${cold.clubId === club.id ? ' dans votre vestiaire' : ''}.`, src);
        break;
      }
      case 4: {
        const key = c.week % 16 < 8 ? 'rpg' : 'apg';
        const rows = league.teams.flatMap((t) => w.clubs[t].roster).map((id) => ({ p: w.players[id], s: perGame(c.seasonStats[id]) })).filter((r) => r.p && r.s.gp >= Math.max(2, c.week / 3)).sort((a, b) => b.s[key] - a.s[key]).slice(0, 4);
        if (rows.length >= 3) addNews(c, 'league', key === 'rpg' ? `${fullName(rows[0].p)}, roi du rebond` : `${fullName(rows[0].p)}, meilleur passeur du championnat`, `${rows.map((r, i) => `${i + 1}. ${fullName(r.p)} (${w.clubs[r.p.clubId!]?.short}) ${r.s[key].toFixed(1)}`).join(' · ')} ${key === 'rpg' ? 'rebonds' : 'passes décisives'} par match.`, src);
        break;
      }
      case 5: {
        const played = w.fixtures.filter((f) => f.leagueId === lid && f.stage === 'regular' && f.played);
        const avg = league.teams.map((id) => {
          const g = played.filter((f) => f.home === id || f.away === id);
          return { id, off: g.reduce((s2, f) => s2 + (f.home === id ? f.hs : f.as), 0) / Math.max(1, g.length), def: g.reduce((s2, f) => s2 + (f.home === id ? f.as : f.hs), 0) / Math.max(1, g.length) };
        });
        const bestO = [...avg].sort((a, b) => b.off - a.off)[0];
        const bestD = [...avg].sort((a, b) => a.def - b.def)[0];
        const mine = avg.find((a) => a.id === club.id)!;
        addNews(c, 'league', rng.pick([`${w.clubs[bestD.id].name}, la muraille du championnat`, `${w.clubs[bestO.id].name}, l’attaque de feu`, 'Attaques et défenses : les chiffres']), `Meilleure attaque : ${w.clubs[bestO.id].name} (${bestO.off.toFixed(1)} points marqués par match). Meilleure défense : ${w.clubs[bestD.id].name} (${bestD.def.toFixed(1)} encaissés). ${club.name} marque ${mine.off.toFixed(1)} points et en encaisse ${mine.def.toFixed(1)}.`, src);
        break;
      }
      case 6: {
        const young = league.teams.flatMap((t) => w.clubs[t].roster).map((id) => ({ p: w.players[id], s: perGame(c.seasonStats[id]) })).filter((r) => r.p && ageOf(r.p, w.season) <= 21 && r.s.gp >= 2).sort((a, b) => b.s.ppg + b.s.rpg + b.s.apg - (a.s.ppg + a.s.rpg + a.s.apg))[0];
        if (young) addNews(c, 'league', young.p.isUser ? `${u.lastName}, le jeune qui monte` : `Jeune à suivre : ${fullName(young.p)}`, `À ${ageOf(young.p, w.season)} ans, ${fullName(young.p)} (${w.clubs[young.p.clubId!]?.name}) tourne à ${young.s.ppg.toFixed(1)} points, ${young.s.rpg.toFixed(1)} rebonds et ${young.s.apg.toFixed(1)} passes en ${young.s.mpg.toFixed(0)} minutes. ${young.p.isUser ? 'Les recruteurs prennent des notes.' : `${u.lastName} a un concurrent pour le titre de meilleur jeune.`}`, src);
        break;
      }
      case 7: {
        const mineG = w.fixtures.filter((f) => f.leagueId === lid && f.stage === 'regular' && f.played && (f.home === club.id || f.away === club.id));
        const homeW = mineG.filter((f) => f.home === club.id && f.hs > f.as).length;
        const homeG = mineG.filter((f) => f.home === club.id).length;
        const awayW = mineG.filter((f) => f.away === club.id && f.as > f.hs).length;
        const awayG = mineG.length - homeG;
        if (mineG.length >= 4) addNews(c, 'league', `Le chiffre : ${homeW}/${homeG} à domicile pour ${club.short}`, `${club.name} a gagné ${homeW} de ses ${homeG} matchs à domicile et ${awayW} de ses ${awayG} déplacements. ${homeW / Math.max(1, homeG) > awayW / Math.max(1, awayG) + 0.25 ? 'Une équipe à deux visages, bien plus forte devant son public.' : awayW >= homeW ? 'Une équipe qui voyage bien.' : 'Un bilan équilibré.'}`, src);
        break;
      }
      default: {
        const next = w.fixtures.find((f) => f.week === c.week + 1 && f.leagueId === lid && (f.home === club.id || f.away === club.id));
        if (next) {
          const opp = w.clubs[next.home === club.id ? next.away : next.home];
          const d = teamLevel(c, club.id) - teamLevel(c, opp.id) + (next.home === club.id ? 1.5 : -1.5);
          const oppRank = st.findIndex((r) => r.clubId === opp.id) + 1;
          addNews(c, 'league', rng.pick([`Pronostic : ${club.short} – ${opp.short}`, `Avant-match : ${club.short} face à ${opp.short}`, `${opp.name}, prochain rendez-vous de ${club.short}`]), `${opp.name} (${oppRank}e) ${next.home === club.id ? 'se déplace chez' : 'reçoit'} ${club.name} (${myRank}e). Notre pronostic : ${d > 3 ? `avantage net à ${club.short}` : d > 0.8 ? `léger avantage à ${club.short}` : d < -3 ? `${opp.short} largement favori` : d < -0.8 ? `léger avantage à ${opp.short}` : 'match très ouvert'}.`, src);
        }
      }
    }
    // Entraîneur menacé
    if (c.week >= 8 && c.week % 5 === 3 && myRank >= st.length - 2) addNews(c, 'coach', `${club.coach.name} sur la sellette ?`, `${club.name} pointe à la ${myRank}e place. En coulisses, les dirigeants s’interrogent sur l’avenir de l’entraîneur.`, src);
  }
  // Cap de réputation franchi : portrait
  const tier = u.reputation >= 80 ? 4 : u.reputation >= 60 ? 3 : u.reputation >= 40 ? 2 : u.reputation >= 20 ? 1 : 0;
  if (tier > (m.repTier ?? 0)) {
    m.repTier = tier;
    const pg = perGame(c.seasonStats[u.id]);
    const titles = ['', `Qui est ${fullName(u)} ?`, `${u.lastName}, l’ascension continue`, `${u.lastName} change de dimension`, `${u.lastName}, visage du basket ${club.country === 'USA' ? 'mondial' : 'européen'}`];
    addNews(c, 'event', `Portrait — ${titles[tier]}`, `Né à ${u.birthCity}, ${u.lastName} (${ageOf(u, w.season)} ans, ${u.heightCm} cm) s’impose peu à peu à ${club.name}. ${pg.gp ? `Cette saison : ${pg.ppg.toFixed(1)} points, ${pg.rpg.toFixed(1)} rebonds et ${pg.apg.toFixed(1)} passes de moyenne.` : ''} ${tier >= 3 ? 'Les plus grands clubs suivent le dossier.' : 'Les observateurs commencent à retenir son nom.'}`, src);
  }
  // Cap de points en carrière
  const careerPts = u.history.reduce((s, h) => s + h.pts, 0) + (c.seasonStats[u.id]?.pts ?? 0);
  const mile = Math.floor(careerPts / 500) * 500;
  if (mile >= 500 && mile > (m.ptsMile ?? 0)) {
    m.ptsMile = mile;
    addNews(c, 'award', `${u.lastName} franchit les ${mile} points en carrière`, `Un cap symbolique pour ${who(c)}, qui en est à ${careerPts} points toutes saisons confondues en championnat.`, src);
  }
  // Rumeur fondée sur l'intérêt réel des clubs
  const top = Object.entries(desk(c).interest).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 35 && rng.chance(0.15)) {
    const cl = w.clubs[top[0]];
    if (cl) addNews(c, 'rumor', rng.pick([`${cl.name} garde un œil sur ${u.lastName}`, `Mercato : ${u.lastName} dans le viseur de ${cl.short}`, `${cl.short} aurait coché le nom de ${u.lastName}`]), `Selon nos informations, ${cl.name} (${w.leagues[cl.leagueId]?.name}) ${top[1] >= 65 ? 'prépare une offre pour cet été' : 'a envoyé un observateur à ses derniers matchs'}. ${playerOvr(u) >= teamLevel(c, cl.id) ? 'Il y aurait un rôle important à la clé.' : 'Il devrait toutefois y gagner sa place.'}`, src);
  }
}

/** Bilan de fin de saison du joueur. */
export function seasonRecap(c: Career): void {
  const u = user(c);
  const club = userClub(c);
  const pg = perGame(c.seasonStats[u.id]);
  const st = c.seasonStats[u.id];
  const rng = rngFor(c, 'recap');
  const rank = standings(c, club.leagueId).findIndex((r) => r.clubId === club.id) + 1;
  if (!st || !pg.gp) {
    addNews(c, 'league', `Saison blanche pour ${u.lastName}`, `${fullName(u)} n’a disputé aucun match de championnat avec ${club.name}. Un été décisif l’attend.`, outlet(c, rng));
    return;
  }
  const verdict = pg.ppg >= 18 ? 'une saison de très haut niveau' : pg.ppg >= 12 ? 'une saison pleine' : pg.mpg >= 15 ? 'une saison d’apprentissage utile' : 'une saison dans l’ombre';
  addNews(c, 'league', `Le bilan de ${u.lastName} : ${verdict}`, `${pg.gp} matchs, ${pg.mpg.toFixed(1)} minutes, ${pg.ppg.toFixed(1)} points, ${pg.rpg.toFixed(1)} rebonds, ${pg.apg.toFixed(1)} passes (${pct(st.fgm, st.fga)} aux tirs, ${pct(st.tpm, st.tpa)} à 3 points, ${pct(st.ftm, st.fta)} aux lancers). ${club.name} termine ${rank}e. Note globale en fin de saison : ${playerOvr(u)}.`, outlet(c, rng));
}
