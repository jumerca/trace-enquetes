import { useContext, useState } from 'react';
import { CareerCtx } from '../App';
import { DriverPortrait } from '../Visuals';
import type { GameApi } from '../App';
import {
  canRace, driverById, driverStandings, forecastFor, playerTeam,
  raceLaps, seasonOver, startNextSeason, startWeekend, teamById,
  teamDrivers, teamStandings, MAX_SPONSORS,
} from '../../game/career';
import { carRating, driverRating, NAT_LABEL, type Driver } from '../../game/data';
import { getTrack } from '../../engine/tracks';
import { EmblemIcon, StatBar, money } from '../common';
import { TrackMap } from './TrackMap';
import { DriversTab, FactoryTab, PalmaresTab, SponsorsTab, moraleClass } from './HubManagement';
import { ArticleCard, DirectorPanel, FiredOverlay, PressTab } from './HubCareer';
import { moraleLabel, moraleOf, staffSalaries } from '../../game/management';

type Tab = 'qg' | 'pilotes' | 'usine' | 'sponsors' | 'presse' | 'classements' | 'palmares' | 'finances';
const TABS: [Tab, string, string][] = [
  ['qg', 'QG', '🏠'], ['pilotes', 'Pilotes', '🪖'], ['usine', 'Usine', '🔧'], ['sponsors', 'Sponsors', '🤝'], ['presse', 'Presse', '📰'],
  ['classements', 'Classements', '🏆'], ['palmares', 'Palmarès', '📜'], ['finances', 'Finances', '€'],
];

const STAT_LABELS: [keyof Driver['stats'], string][] = [
  ['vitesse', 'Vitesse'], ['regularite', 'Régularité'], ['depassement', 'Dépassement'], ['defense', 'Défense'],
  ['pneus', 'Gestion pneus'], ['pluie', 'Pluie'], ['mental', 'Mental'],
];

export function Hub({ api }: { api: GameApi }) {
  const [tab, setTab] = useState<Tab>('qg');
  const c = api.career;
  const team = playerTeam(c);
  return (
    <div className="page hub" style={{ ['--c1' as string]: team.color, ['--c2' as string]: team.color2 }}>
      <header className="hubhead">
        <EmblemIcon emblem={team.emblem} color={team.color} color2={team.color2} size={38} />
        <div className="hubtitle">
          <h1>{team.name}</h1>
          <small>Saison {c.season} · Réputation {team.reputation}/100</small>
        </div>
        <div className="budget"><small>Budget</small><b className={c.budget < 0 ? 'neg' : ''}>{money(c.budget)}</b></div>
        <button className="icon" onClick={() => api.go('settings')} aria-label="Paramètres">⚙</button>
      </header>
      <nav className="tabs">
        {TABS.map(([t, label, ico]) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}><span>{ico}</span>{label}</button>
        ))}
      </nav>
      <main className="hubmain">
        {tab === 'qg' && <Dashboard api={api} setTab={setTab} />}
        {tab === 'pilotes' && <DriversTab api={api} />}
        {tab === 'usine' && <FactoryTab api={api} />}
        {tab === 'sponsors' && <SponsorsTab api={api} />}
        {tab === 'presse' && <PressTab api={api} />}
        {tab === 'classements' && <Standings api={api} />}
        {tab === 'palmares' && <PalmaresTab api={api} />}
        {tab === 'finances' && <Finances api={api} />}
      </main>
      <FiredOverlay api={api} />
    </div>
  );
}

function Dashboard({ api, setTab }: { api: GameApi; setTab: (t: Tab) => void }) {
  const c = api.career;
  const mine = teamDrivers(c, c.playerTeamId);
  const blocked = canRace(c);
  const over = seasonOver(c);
  const next = !over ? c.calendar[c.round] : null;
  const tr = next ? getTrack(next.trackId).def : null;
  const fc = next ? forecastFor(c, c.round) : null;
  const ts = teamStandings(c);
  const pos = ts.findIndex((t) => t.teamId === c.playerTeamId) + 1;
  const todo: { text: string; tab: Tab }[] = [];
  if (mine.length < 2) todo.push({ text: `Recruter ${2 - mine.length} pilote(s)`, tab: 'pilotes' });
  if (c.sponsors.length < MAX_SPONSORS) todo.push({ text: 'Signer un sponsor', tab: 'sponsors' });
  return (
    <div className="dash">
      {over ? (
        <section className="panel hero-card">
          <h2>Saison {c.season} terminée</h2>
          {c.history.slice(-1).map((h) => (
            <p key={h.season}>Champion : <b>{h.driverChampion}</b> · Constructeurs : <b>{h.teamChampion}</b> · Votre écurie : <b>{h.playerTeamPos}ᵉ</b>
              {h.objective ? (h.playerTeamPos <= h.objective ? ` · objectif (${h.objective}ᵉ) atteint ✔` : ` · objectif (${h.objective}ᵉ) manqué ✘`) : ''}</p>
          ))}
          <button className="btn primary big" onClick={() => api.act((cc) => startNextSeason(cc))}>Lancer la saison {c.season + 1}</button>
        </section>
      ) : (
        <section className="panel hero-card next-gp">
          <div>
            <small>Grand Prix {c.round + 1}/{c.calendar.length}</small>
            <h2>{tr!.gp}</h2>
            <p>{tr!.name} — {tr!.place}</p>
            <p className="muted">{tr!.description}</p>
            <p>{raceLaps(c)} tours · {(getTrack(next!.trackId).length / 1000).toFixed(2)} km · Prévision : {fc!.rainProb > 0.45 ? '🌧' : fc!.rainProb > 0.2 ? '⛅' : '☀'} risque de pluie {Math.round(fc!.rainProb * 100)} %</p>
            {blocked ? <p className="warn">{blocked}</p> : null}
            <button className="btn primary big" disabled={!!blocked} onClick={() => { const e = api.act((cc) => startWeekend(cc)); if (!e) api.go('weekend'); }}>
              {c.weekend ? 'Reprendre le week-end →' : 'Aller au week-end de course →'}
            </button>
          </div>
          <TrackMap trackId={next!.trackId} />
        </section>
      )}
      {todo.length > 0 && (
        <section className="panel todo">
          <h3>À faire</h3>
          {todo.map((t) => <button key={t.text} className="btn" onClick={() => setTab(t.tab)}>☐ {t.text}</button>)}
        </section>
      )}
      <section className="panel">
        <h3>Vos pilotes</h3>
        {mine.length === 0 && <p className="muted">Aucun pilote sous contrat.</p>}
        <div className="cards">
          {mine.map((d) => <DriverCard key={d.id} d={d} compact />)}
        </div>
      </section>
      <section className="panel">
        <h3>Championnat constructeurs</h3>
        <p>Position actuelle : <b>{c.results.length ? pos + 'ᵉ' : '—'}</b> · Voiture : note <b>{carRating(playerTeam(c).car).toFixed(1)}</b>/20</p>
        <p className={'objective ' + (c.results.length ? (pos <= c.objective.target ? 'ok' : 'ko') : '')}>
          🎯 Objectif des actionnaires : <b>{c.objective.target}ᵉ</b> au championnat constructeurs
          {c.results.length ? (pos <= c.objective.target ? ' — en bonne voie' : ' — en retard') : ''}
        </p>
      </section>
      <DirectorPanel api={api} />
      {c.press?.[0] && (
        <section className="panel">
          <h3>À la une</h3>
          <ArticleCard c={c} a={c.press[0]} compact />
          <button className="btn small" onClick={() => setTab('presse')}>Toute la presse →</button>
        </section>
      )}
      <section className="panel news">
        <h3>Actualités</h3>
        <ul>{c.news.slice(0, 8).map((n, i) => <li key={i}>{n.text}</li>)}</ul>
      </section>
    </div>
  );
}

export function DriverCard({ d, compact, children }: { d: Driver; compact?: boolean; children?: React.ReactNode }) {
  const career = useContext(CareerCtx);
  const team = d.teamId ? career?.teams.find((t) => t.id === d.teamId) : undefined;
  return (
    <div className="driver-card">
      <header>
        <div className="portrait-wrap">
          <DriverPortrait id={d.id} color={team?.color ?? '#8a8f99'} color2={team?.color2 ?? '#f4f1ea'} size={54} />
          <span className="num">{d.number}</span>
        </div>
        <div><b>{d.first} {d.last}</b><small>{NAT_LABEL[d.nat] ?? d.nat} · {d.age} ans · note {driverRating(d.stats).toFixed(1)}</small></div>
      </header>
      {!compact && STAT_LABELS.map(([k, l]) => <StatBar key={k} label={l} value={d.stats[k]} />)}
      {compact && <div className="mini-stats">{STAT_LABELS.map(([k, l]) => <span key={k} title={l}>{l.slice(0, 3)} <b>{d.stats[k]}</b></span>)}</div>}
      <div className="morale"><span>Moral</span><div className="bar"><i className={moraleClass(moraleOf(d))} style={{ width: moraleOf(d) + '%' }} /></div><small>{moraleLabel(moraleOf(d))}</small></div>
      {d.potential !== undefined && d.age <= 23 && <small className="muted">Potentiel : {'★'.repeat(Math.max(1, Math.round((d.potential - 10) / 2)))} ({d.potential.toFixed(0)})</small>}
      {d.contract && <small className="contract">Contrat : {money(d.contract.salary)}/saison · {d.contract.years} saison(s)</small>}
      {children}
    </div>
  );
}

function Standings({ api }: { api: GameApi }) {
  const c = api.career;
  const ds = driverStandings(c);
  const ts = teamStandings(c);
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Pilotes</h2>
        <table className="table">
          <thead><tr><th>#</th><th>Pilote</th>{c.calendar.map((r) => <th key={r.round} title={getTrack(r.trackId).def.gp}>{r.trackId.slice(0, 3).toUpperCase()}</th>)}<th>Pts</th></tr></thead>
          <tbody>
            {ds.map((s, i) => {
              const d = driverById(c, s.driverId);
              const t = s.teamId ? teamById(c, s.teamId) : null;
              return (
                <tr key={s.driverId} className={s.teamId === c.playerTeamId ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td><i className="dot" style={{ background: t?.color ?? '#999' }} />{d.first[0]}. {d.last}</td>
                  {c.calendar.map((r) => { const e = s.results[r.round]; return <td key={r.round} className={e?.position === 1 ? 'gold' : ''}>{e ? (e.status === 'abandon' ? 'Ab' : e.position) : '·'}</td>; })}
                  <td><b>{s.points}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Constructeurs</h2>
        <table className="table">
          <thead><tr><th>#</th><th>Écurie</th><th>Vict.</th><th>Pts</th></tr></thead>
          <tbody>
            {ts.map((s, i) => {
              const t = teamById(c, s.teamId);
              return (
                <tr key={s.teamId} className={t.isPlayer ? 'me' : ''}>
                  <td>{i + 1}</td><td><i className="dot" style={{ background: t.color }} />{t.name}</td><td>{s.wins}</td><td><b>{s.points}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3>Calendrier</h3>
        <ol className="calendar">
          {c.calendar.map((r) => {
            const res = c.results.find((x) => x.round === r.round);
            const tr = getTrack(r.trackId).def;
            return (
              <li key={r.round} className={r.round === c.round ? 'next' : res ? 'done' : ''}>
                <b>{tr.gp}</b> <small>{tr.name}</small>
                {res && <span> — vainqueur : {driverById(c, res.entries[0].driverId).last}{res.weather === 'pluie' ? ' 🌧' : ''}</span>}
              </li>
            );
          })}
        </ol>
        {c.history.length > 0 && (
          <>
            <h3>Palmarès</h3>
            <ul>{c.history.map((h) => <li key={h.season}>Saison {h.season} : {h.driverChampion} / {h.teamChampion} (vous : {h.playerTeamPos}ᵉ)</li>)}</ul>
          </>
        )}
      </section>
    </div>
  );
}

function Finances({ api }: { api: GameApi }) {
  const c = api.career;
  const mine = teamDrivers(c, c.playerTeamId);
  const perRaceIn = c.sponsors.reduce((a, s) => a + s.perRace, 0) + 0.5;
  const perRaceOut = (c.drivers.filter((d) => d.teamId === c.playerTeamId).reduce((a, d) => a + (d.contract?.salary ?? 0), 0) + staffSalaries(c)) / c.calendar.length + 1.4;
  void mine;
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Prévision par Grand Prix</h2>
        <ul className="facts">
          <li>Recettes garanties (sponsors + participation) : <b>{money(perRaceIn)}</b></li>
          <li>Dépenses (pilotes, personnel, logistique) : <b>{money(-perRaceOut)}</b></li>
          <li>Solde hors primes : <b className={perRaceIn - perRaceOut < 0 ? 'neg' : 'pos'}>{money(perRaceIn - perRaceOut, true)}</b></li>
        </ul>
        <p className="muted">Primes de résultat : 0,12 M€ par point marqué, plus les bonus d’objectifs sponsors.</p>
      </section>
      <section className="panel">
        <h2>Mouvements</h2>
        <table className="table">
          <tbody>
            {[...c.ledger].reverse().slice(0, 40).map((l, i) => (
              <tr key={i}><td><small>S{l.season}</small></td><td>{l.label}</td><td className={l.amount < 0 ? 'neg' : 'pos'}>{money(l.amount, true)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
