import { useState } from 'react';
import { hashString, Rng } from '../../core/rng';
import { type TransferLog, perGame, REGULAR_WEEKS, standings, user, userClub, userTeams, type Career } from '../../career/career';
import { comps } from '../../career/competitions';
import { extra, WINTER_WINDOW } from '../../career/life';
import { marketValue } from '../../career/scouting';
import { INTENSITY, PROGRAMS, autoProgram } from '../../career/training';
import { playerOvr } from '../../data/generate';
import { fullName } from '../../data/model';
import { Bar } from './Hub';

const eur = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M€` : `${Math.round(n / 1000)} k€`);

/** Fiche club : salle, public, finances, infrastructures, staff, palmarès, contrats. */
export function ClubProfile({ c }: { c: Career }) {
  const club = userClub(c);
  const rng = new Rng(hashString(club.id));
  const capacity = Math.round((1800 + club.reputation * 95) / 100) * 100;
  const fill = Math.min(1, 0.55 + club.reputation / 250 + (standings(c, club.leagueId).findIndex((r) => r.clubId === club.id) < 4 ? 0.08 : 0));
  const salaries = club.roster.reduce((s, id) => s + (c.world.players[id]?.contract?.salary ?? 0), 0);
  const value = club.roster.reduce((s, id) => s + (c.world.players[id] ? marketValue(c, c.world.players[id]) : 0), 0);
  const titles = extra(c).history.filter((h) => h.champion === club.name).length;
  const staff = [
    { role: 'Entraîneur principal', name: club.coach.name, val: club.coach.development },
    { role: 'Entraîneur adjoint', name: rng.pick(['Marc Delorme', 'Yannick Rousset', 'Nicolas Ferrand', 'Hakim Benali', 'Julien Carré']), val: rng.int(8, 17) },
    { role: 'Préparateur physique', name: rng.pick(['Sébastien Vial', 'Cédric Morin', 'Anthony Lebrun', 'Paul Granger']), val: rng.int(8, 18) },
    { role: 'Responsable médical', name: rng.pick(['Dr Claire Henry', 'Dr Hugo Masson', 'Dr Inès Barre', 'Dr Luc Perret']), val: rng.int(8, 18) },
    { role: 'Recruteur en chef', name: rng.pick(['Damien Lenoir', 'Karim Saïdi', 'Olivier Bertrand', 'Franck Aubert']), val: rng.int(7, 17) },
  ];
  const arena = `${rng.pick(['Palais des sports', 'Arena', 'Salle', 'Dôme'])} ${club.city}`;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card club-hero" style={{ borderColor: club.colors[0] }}>
        <div className="club-crest" style={{ background: club.colors[0], color: club.colors[1], borderColor: club.colors[1] }}>
          {club.short}
        </div>
        <div style={{ minWidth: 0 }}>
          <h2>{club.name}</h2>
          <div className="small muted">
            {club.city} · {c.world.leagues[club.leagueId]?.name} · réputation {club.reputation}/100 · {titles} titre(s) depuis le début de votre carrière
          </div>
          <div className="info-grid" style={{ marginTop: 12 }}>
            {(
              [
                ['Salle', `${arena} (${capacity.toLocaleString('fr-FR')} places)`],
                ['Affluence moyenne', `${Math.round(capacity * fill).toLocaleString('fr-FR')} (${Math.round(fill * 100)} %)`],
                ['Budget annuel', eur(club.budget)],
                ['Masse salariale', eur(salaries)],
                ['Valeur de l’effectif', eur(value)],
                ['Philosophie', club.philosophy === 'youth' ? 'Formation des jeunes' : club.philosophy === 'win-now' ? 'Résultats immédiats' : 'Équilibrée'],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid cols-3">
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Infrastructures</h3>
          {(
            [
              ['Centre d’entraînement', club.facilities],
              ['Centre de formation', club.youth],
              ['Pôle médical', Math.round((club.facilities + club.youth) / 2)],
              ['Recrutement', Math.round(club.reputation / 5)],
            ] as [string, number][]
          ).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div className="row spread small">
                <span>{k}</span>
                <b>{v}/20</b>
              </div>
              <Bar v={v} max={20} tone="green" />
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Staff technique</h3>
          {staff.map((s) => (
            <div key={s.role} className="row spread small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                <b>{s.name}</b>
                <br />
                <span className="muted tiny">{s.role}</span>
              </span>
              <span className="pill">{s.val}/20</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Identité de jeu</h3>
          {(
            [
              ['Rythme', club.coach.tactics.pace],
              ['Tirs à 3 points', club.coach.tactics.threeRate],
              ['Pick-and-roll', club.coach.tactics.pnrFreq],
              ['Pression défensive', club.coach.tactics.pressure],
              ['Rebond offensif', club.coach.tactics.crashBoards],
              ['Confiance aux jeunes', club.coach.youthTrust],
            ] as [string, number][]
          ).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div className="row spread small">
                <span>{k}</span>
                <b>{Math.round(v * 100)}</b>
              </div>
              <Bar v={v * 100} tone="orange" />
            </div>
          ))}
          <p className="tiny muted">Défense de base : {club.coach.tactics.defense === 'zone23' ? 'zone 2-3' : club.coach.tactics.defense === 'switch' ? 'changements systématiques' : 'homme à homme'}.</p>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Contrats de l'effectif</h3>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Poste</th>
                <th className="r">Note</th>
                <th className="r">Salaire</th>
                <th className="r">Fin</th>
                <th className="r">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {club.roster
                .map((id) => c.world.players[id])
                .filter(Boolean)
                .sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0))
                .map((p) => (
                  <tr key={p.id} className={p.isUser ? 'me' : ''}>
                    <td>{fullName(p)}</td>
                    <td>{p.pos}</td>
                    <td className="r">{playerOvr(p)}</td>
                    <td className="r">{p.contract?.salary ? eur(p.contract.salary) : '—'}</td>
                    <td className="r">{(p.contract?.until ?? c.world.season) + 1}</td>
                    <td className="r">{eur(marketValue(c, p))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Ligue : résultats par journée, statistiques d'équipes, leaders. */
export function LeagueCenter({ c }: { c: Career }) {
  const lid = userClub(c).leagueId;
  const played = c.world.fixtures.filter((f) => f.leagueId === lid && f.stage === 'regular' && f.played);
  const lastRound = played.reduce((m, f) => Math.max(m, f.round), 1);
  const [round, setRound] = useState(lastRound);
  const fx = c.world.fixtures.filter((f) => f.leagueId === lid && f.round === round && f.stage === 'regular');
  const teams = c.world.leagues[lid].teams.map((id) => {
    const gms = played.filter((f) => f.home === id || f.away === id);
    const pf = gms.reduce((s, f) => s + (f.home === id ? f.hs : f.as), 0);
    const pa = gms.reduce((s, f) => s + (f.home === id ? f.as : f.hs), 0);
    const homeW = gms.filter((f) => f.home === id && f.hs > f.as).length;
    const awayW = gms.filter((f) => f.away === id && f.as > f.hs).length;
    return { id, gp: gms.length, off: gms.length ? pf / gms.length : 0, def: gms.length ? pa / gms.length : 0, homeW, awayW };
  });
  const ids = c.world.leagues[lid].teams.flatMap((t) => c.world.clubs[t].roster);
  const rows = ids.map((id) => ({ p: c.world.players[id], s: c.seasonStats[id] })).filter((r) => r.p && r.s && r.s.gp >= Math.max(1, Math.floor(c.week / 3)));
  const cat = (title: string, f: (r: (typeof rows)[number]) => number, fmt: (v: number) => string) => (
    <div className="card" key={title}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      {[...rows]
        .sort((a, b) => f(b) - f(a))
        .slice(0, 6)
        .map((r, i) => (
          <div key={r.p.id} className="row spread small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)', color: r.p.isUser ? 'var(--orange-2)' : undefined, fontWeight: r.p.isUser ? 800 : 400 }}>
            <span>
              {i + 1}. {fullName(r.p)} <span className="muted">({c.world.clubs[r.p.clubId!]?.short})</span>
            </span>
            <b className="num">{fmt(f(r))}</b>
          </div>
        ))}
    </div>
  );
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-title">
          <h3>Résultats — journée {round}</h3>
          <div className="row">
            <button className="btn small" disabled={round <= 1} onClick={() => setRound(round - 1)} aria-label="Journée précédente">
              ←
            </button>
            <button className="btn small" disabled={round >= REGULAR_WEEKS} onClick={() => setRound(round + 1)} aria-label="Journée suivante">
              →
            </button>
          </div>
        </div>
        <div className="results-grid">
          {fx.map((f) => (
            <div key={f.id} className={`result ${userTeams(c).includes(f.home) || userTeams(c).includes(f.away) ? 'mine' : ''}`}>
              <span style={{ fontWeight: f.played && f.hs > f.as ? 800 : 400 }}>{c.world.clubs[f.home].name}</span>
              <b className="num">{f.played ? `${f.hs} - ${f.as}` : '—'}</b>
              <span style={{ fontWeight: f.played && f.as > f.hs ? 800 : 400, textAlign: 'right' }}>{c.world.clubs[f.away].name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Statistiques des équipes</h3>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Club</th>
                <th className="r">MJ</th>
                <th className="r">Pts marqués</th>
                <th className="r">Pts encaissés</th>
                <th className="r">Écart</th>
                <th className="r">V dom.</th>
                <th className="r">V ext.</th>
              </tr>
            </thead>
            <tbody>
              {teams
                .sort((a, b) => b.off - b.def - (a.off - a.def))
                .map((t) => (
                  <tr key={t.id} className={t.id === userClub(c).id ? 'me' : ''}>
                    <td>{c.world.clubs[t.id].name}</td>
                    <td className="r">{t.gp}</td>
                    <td className="r">{t.off.toFixed(1)}</td>
                    <td className="r">{t.def.toFixed(1)}</td>
                    <td className="r">{(t.off - t.def > 0 ? '+' : '') + (t.off - t.def).toFixed(1)}</td>
                    <td className="r">{t.homeW}</td>
                    <td className="r">{t.awayW}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <TransfersCard c={c} />
      <div className="grid cols-3">
        {cat('Points', (r) => r.s.pts / r.s.gp, (v) => v.toFixed(1))}
        {cat('Rebonds', (r) => r.s.reb / r.s.gp, (v) => v.toFixed(1))}
        {cat('Passes décisives', (r) => r.s.ast / r.s.gp, (v) => v.toFixed(1))}
        {cat('Interceptions', (r) => r.s.stl / r.s.gp, (v) => v.toFixed(1))}
        {cat('Contres', (r) => r.s.blk / r.s.gp, (v) => v.toFixed(1))}
        {cat('Adresse à 3 pts (min. 15 tirs)', (r) => (r.s.tpa >= 15 ? r.s.tpm / r.s.tpa : 0), (v) => `${(v * 100).toFixed(1)} %`)}
      </div>
    </div>
  );
}

/** Calendrier mensuel : une journée par semaine (le samedi), coupes en semaine. */
export function MonthCalendar({ c }: { c: Career }) {
  const start = new Date(c.world.season, 9, 3); // premier samedi d'octobre (approximation)
  while (start.getDay() !== 6) start.setDate(start.getDate() + 1);
  const dateOfWeek = (w: number, midweek = false) => {
    const d = new Date(start);
    d.setDate(d.getDate() + (w - 1) * 7 - (midweek ? 3 : 0));
    return d;
  };
  const teams = userTeams(c);
  const events = new Map<string, { label: string; kind: string }[]>();
  const add = (d: Date, label: string, kind: string) => {
    const k = d.toDateString();
    events.set(k, [...(events.get(k) ?? []), { label, kind }]);
  };
  for (const f of c.world.fixtures) {
    if (!teams.includes(f.home) && !teams.includes(f.away)) continue;
    const mid = f.stage === 'cup' || f.stage === 'youth';
    const opp = c.world.clubs[teams.includes(f.home) ? f.away : f.home];
    const res = f.played ? ` ${f.hs}-${f.as}` : '';
    add(dateOfWeek(f.week, mid), `${f.stage === 'youth' ? 'Espoirs' : opp?.short ?? ''}${res}`, f.stage);
  }
  add(dateOfWeek(WINTER_WINDOW[0]), 'Mercato ouvert', 'info');
  const [month, setMonth] = useState(() => dateOfWeek(Math.max(1, Math.min(c.week, 28))).getMonth());
  const year = month >= 9 ? c.world.season : c.world.season + 1;
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: offset + days }, (_, i) => (i < offset ? null : new Date(year, month, i - offset + 1)));
  const today = dateOfWeek(Math.min(c.week, 28)).toDateString();
  return (
    <div className="card">
      <div className="card-title">
        <h3 style={{ textTransform: 'capitalize' }}>{first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
        <div className="row">
          <button className="btn small" onClick={() => setMonth((m) => (m + 11) % 12)} aria-label="Mois précédent">
            ←
          </button>
          <button className="btn small" onClick={() => setMonth((m) => (m + 1) % 12)} aria-label="Mois suivant">
            →
          </button>
        </div>
      </div>
      <div className="month-grid">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="month-head">
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className={`month-cell ${d && d.toDateString() === today ? 'today' : ''}`}>
            {d && (
              <>
                <span className="tiny muted">{d.getDate()}</span>
                {(events.get(d.toDateString()) ?? []).map((ev, k) => (
                  <span key={k} className={`ev ev-${ev.kind}`}>
                    {ev.label}
                  </span>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="row wrap tiny muted" style={{ gap: 12, marginTop: 8 }}>
        <span className="ev ev-regular">Championnat</span>
        <span className="ev ev-cup">Coupe / Europe</span>
        <span className="ev ev-youth">Espoirs</span>
        <span className="ev ev-nat">Sélection</span>
        <span className="ev ev-info">Mercato</span>
        <span>Compétitions : {Object.values(comps(c.world)).map((x) => x.name).join(', ')}</span>
      </div>
    </div>
  );
}

/** Semaine type d'entraînement, construite à partir du programme et de l'intensité. */
export function TrainingWeek({ c }: { c: Career }) {
  const u = user(c);
  const prog = c.plan.mode === 'manual' ? c.plan.program : autoProgram(u, c.plan.mode);
  const inten = INTENSITY[c.plan.intensity];
  const hasMatchMid = c.world.fixtures.some((f) => f.week === c.week && (f.stage === 'cup' || f.stage === 'youth') && userTeams(c).includes(f.home));
  const load = (l: number) => Math.round(l * inten.mul * 100) / 100;
  const days: { d: string; am: string; pm: string; load: number }[] = [
    { d: 'Lundi', am: 'Récupération active', pm: 'Vidéo du dernier match', load: load(0.3) },
    { d: 'Mardi', am: PROGRAMS[prog].label, pm: 'Collectif : systèmes offensifs', load: load(1) },
    { d: 'Mercredi', am: hasMatchMid ? 'Activation' : 'Musculation', pm: hasMatchMid ? 'MATCH (coupe / Espoirs)' : PROGRAMS[prog].label, load: load(hasMatchMid ? 1.1 : 0.9) },
    { d: 'Jeudi', am: PROGRAMS[prog].label, pm: 'Défense et rotations', load: load(1) },
    { d: 'Vendredi', am: 'Mise en place tactique', pm: 'Lancers francs et repos', load: load(0.5) },
    { d: 'Samedi', am: 'Réveil musculaire', pm: 'MATCH de championnat', load: 1.2 },
    { d: 'Dimanche', am: 'Repos', pm: 'Repos', load: 0 },
  ];
  return (
    <div className="card">
      <div className="card-title">
        <h3>Semaine d'entraînement</h3>
        <span className="muted small">
          Programme : {PROGRAMS[prog].label} · intensité {inten.label.toLowerCase()} · fraîcheur {Math.round(100 - u.fatigue)} %
        </span>
      </div>
      <div className="week-grid">
        {days.map((x) => (
          <div key={x.d} className="week-day">
            <b>{x.d}</b>
            <span className="small">{x.am}</span>
            <span className="small muted">{x.pm}</span>
            <div className={`bar ${x.load > 1 ? 'orange' : 'green'}`} title={`Charge ${x.load}`}>
              <i style={{ width: `${Math.min(100, x.load * 70)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        La charge de travail s'additionne à la fatigue des matchs : au-delà de 60 de fatigue, la progression ralentit et le risque de blessure augmente.
      </p>
    </div>
  );
}

export { perGame };

/** Derniers transferts entre clubs (marché simulé à chaque intersaison). */
export function TransfersCard({ c }: { c: Career }) {
  const list = ((extra(c) as ReturnType<typeof extra> & { transfers?: TransferLog[] }).transfers ?? []).slice(0, 25);
  return (
    <div className="card">
      <div className="card-title">
        <h3>Marché des transferts</h3>
        <span className="muted small">Mouvements entre clubs, toutes ligues confondues</span>
      </div>
      {list.length === 0 ? (
        <p className="small muted">Le marché s'anime à chaque intersaison : les clubs ambitieux renforcent leur poste le plus faible.</p>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Saison</th>
                <th>Joueur</th>
                <th>Poste</th>
                <th className="r">Note</th>
                <th>De</th>
                <th>Vers</th>
                <th className="r">Indemnité</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={i}>
                  <td>{t.season}</td>
                  <td>{t.player}</td>
                  <td>{t.pos}</td>
                  <td className="r">{t.ovr}</td>
                  <td>{t.from}</td>
                  <td>{t.to}</td>
                  <td className="r">{eur(t.fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
