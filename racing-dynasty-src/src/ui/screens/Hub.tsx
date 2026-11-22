import { useState } from 'react';
import type { GameApi } from '../App';
import {
  availableSponsors, buyUpgrade, canRace, driverById, driverStandings, forecastFor, freeAgents, hireDriver, playerTeam,
  raceLaps, releaseCost, releaseDriver, seasonOver, signSponsor, signingFee, startNextSeason, startWeekend, teamById,
  teamDrivers, teamStandings, upgradeCost, UPGRADE_LABEL, MAX_SPONSORS,
} from '../../game/career';
import { carRating, driverRating, NAT_LABEL, OBJECTIVE_LABEL, type Driver } from '../../game/data';
import { getTrack } from '../../engine/tracks';
import type { CarStats } from '../../engine/types';
import { EmblemIcon, Modal, StatBar, money } from '../common';
import { TrackMap } from './TrackMap';

type Tab = 'qg' | 'pilotes' | 'voiture' | 'sponsors' | 'classements' | 'finances';
const TABS: [Tab, string, string][] = [
  ['qg', 'QG', '🏠'], ['pilotes', 'Pilotes', '🪖'], ['voiture', 'Voiture', '🔧'], ['sponsors', 'Sponsors', '🤝'],
  ['classements', 'Classements', '🏆'], ['finances', 'Finances', '€'],
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
        {tab === 'pilotes' && <Drivers api={api} />}
        {tab === 'voiture' && <CarTab api={api} />}
        {tab === 'sponsors' && <Sponsors api={api} />}
        {tab === 'classements' && <Standings api={api} />}
        {tab === 'finances' && <Finances api={api} />}
      </main>
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
            <p key={h.season}>Champion : <b>{h.driverChampion}</b> · Constructeurs : <b>{h.teamChampion}</b> · Votre écurie : <b>{h.playerTeamPos}ᵉ</b></p>
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
      </section>
      <section className="panel news">
        <h3>Actualités</h3>
        <ul>{c.news.slice(0, 8).map((n, i) => <li key={i}>{n.text}</li>)}</ul>
      </section>
    </div>
  );
}

export function DriverCard({ d, compact, children }: { d: Driver; compact?: boolean; children?: React.ReactNode }) {
  return (
    <div className="driver-card">
      <header>
        <span className="num">{d.number}</span>
        <div><b>{d.first} {d.last}</b><small>{NAT_LABEL[d.nat] ?? d.nat} · {d.age} ans · note {driverRating(d.stats).toFixed(1)}</small></div>
      </header>
      {!compact && STAT_LABELS.map(([k, l]) => <StatBar key={k} label={l} value={d.stats[k]} />)}
      {compact && <div className="mini-stats">{STAT_LABELS.map(([k, l]) => <span key={k} title={l}>{l.slice(0, 3)} <b>{d.stats[k]}</b></span>)}</div>}
      {d.contract && <small className="contract">Contrat : {money(d.contract.salary)}/saison · {d.contract.years} saison(s)</small>}
      {children}
    </div>
  );
}

function Drivers({ api }: { api: GameApi }) {
  const c = api.career;
  const mine = teamDrivers(c, c.playerTeamId);
  const [nego, setNego] = useState<Driver | null>(null);
  const [view, setView] = useState<'libres' | 'grille'>('libres');
  return (
    <div>
      <section className="panel">
        <h2>Pilotes titulaires ({mine.length}/2)</h2>
        <div className="cards">
          {mine.map((d) => (
            <DriverCard key={d.id} d={d}>
              <button className="btn small danger" onClick={() => {
                if (confirm(`Libérer ${d.first} ${d.last} ? Indemnité : ${money(releaseCost(c, d.id))}.`)) api.act((cc) => releaseDriver(cc, d.id));
              }}>Libérer ({money(releaseCost(c, d.id))})</button>
            </DriverCard>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="row spread">
          <h2>Marché des pilotes</h2>
          <div className="seg">
            <button className={view === 'libres' ? 'on' : ''} onClick={() => setView('libres')}>Agents libres</button>
            <button className={view === 'grille' ? 'on' : ''} onClick={() => setView('grille')}>Grille actuelle</button>
          </div>
        </div>
        {view === 'libres' ? (
          <div className="cards">
            {freeAgents(c).map((d) => (
              <DriverCard key={d.id} d={d}>
                <div className="row spread">
                  <small>Demande : <b>{money(d.askSalary)}</b>/saison</small>
                  <button className="btn small primary" disabled={mine.length >= 2 || !!c.weekend} onClick={() => setNego(d)}>Négocier</button>
                </div>
              </DriverCard>
            ))}
          </div>
        ) : (
          <table className="table">
            <thead><tr><th>Pilote</th><th>Écurie</th><th>Note</th><th>Vit.</th><th>Rég.</th><th>Dép.</th><th>Pneus</th></tr></thead>
            <tbody>
              {c.drivers.filter((d) => d.teamId).sort((a, b) => driverRating(b.stats) - driverRating(a.stats)).map((d) => (
                <tr key={d.id} className={d.teamId === c.playerTeamId ? 'me' : ''}>
                  <td>{d.first[0]}. {d.last}</td><td><i className="dot" style={{ background: teamById(c, d.teamId!).color }} />{teamById(c, d.teamId!).short}</td>
                  <td>{driverRating(d.stats).toFixed(1)}</td><td>{d.stats.vitesse}</td><td>{d.stats.regularite}</td><td>{d.stats.depassement}</td><td>{d.stats.pneus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {nego && <Negotiation api={api} d={nego} onClose={() => setNego(null)} />}
    </div>
  );
}

function Negotiation({ api, d, onClose }: { api: GameApi; d: Driver; onClose: () => void }) {
  const [salary, setSalary] = useState(d.askSalary);
  const [years, setYears] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Modal title={`Contrat — ${d.first} ${d.last}`} onClose={onClose}>
      <DriverCard d={d} />
      <label>Salaire annuel : <b>{money(salary)}</b>
        <input type="range" min={Math.max(0.2, d.askSalary * 0.6)} max={d.askSalary * 1.6} step={0.05} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
      </label>
      <div className="choices">
        {[1, 2, 3].map((y) => <button key={y} className={'chip' + (y === years ? ' on' : '')} onClick={() => setYears(y)}>{y} saison{y > 1 ? 's' : ''}</button>)}
      </div>
      <p className="muted">Prime de signature : {money(signingFee(salary))} · Coût par Grand Prix : {money(salary / api.career.calendar.length)}. Les contrats longs exigent un salaire plus élevé.</p>
      {msg && <p className="warn">{msg}</p>}
      <button className="btn primary big" onClick={() => {
        const err = api.act((cc) => hireDriver(cc, d.id, salary, years));
        if (err) setMsg(err);
        else onClose();
      }}>Proposer le contrat</button>
    </Modal>
  );
}

function CarTab({ api }: { api: GameApi }) {
  const c = api.career;
  const t = playerTeam(c);
  const rivals = teamStandings(c).map((s) => teamById(c, s.teamId));
  const keys: (keyof CarStats)[] = ['moteur', 'aero', 'chassis', 'fiabilite'];
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Monoplace {new Date().getFullYear()}</h2>
        {keys.map((k) => (
          <div key={k} className="upgrade">
            <StatBar label={UPGRADE_LABEL[k]} value={t.car[k]} />
            <button className="btn small" disabled={!!c.weekend || t.car[k] >= 20} onClick={() => api.act((cc) => buyUpgrade(cc, k))}>
              Évolution · {money(upgradeCost(t.car[k]))}
            </button>
          </div>
        ))}
        <StatBar label="Équipe aux stands" value={t.pitCrew} />
        <p className="muted">Moteur : vitesse de pointe et accélération. Aéro : vitesse en courbe. Châssis : freinage et adhérence mécanique. Fiabilité : risque de casse.</p>
        <p className="muted">Les réglages (aileron, suspensions, boîte) se font pendant les essais libres de chaque Grand Prix.</p>
      </section>
      <section className="panel">
        <h2>Comparatif des voitures</h2>
        <table className="table">
          <thead><tr><th>Écurie</th><th>Mot.</th><th>Aéro</th><th>Châs.</th><th>Fiab.</th><th>Note</th></tr></thead>
          <tbody>
            {[...rivals].sort((a, b) => carRating(b.car) - carRating(a.car)).map((r) => (
              <tr key={r.id} className={r.isPlayer ? 'me' : ''}>
                <td><i className="dot" style={{ background: r.color }} />{r.name}</td>
                <td>{r.car.moteur}</td><td>{r.car.aero}</td><td>{r.car.chassis}</td><td>{r.car.fiabilite}</td><td>{carRating(r.car).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Sponsors({ api }: { api: GameApi }) {
  const c = api.career;
  const rep = playerTeam(c).reputation;
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Partenaires ({c.sponsors.length}/{MAX_SPONSORS})</h2>
        {c.sponsors.length === 0 && <p className="muted">Aucun sponsor : chaque Grand Prix coûte sans rien rapporter.</p>}
        {c.sponsors.map((s) => (
          <div key={s.id} className="sponsor signed" style={{ borderLeftColor: s.color }}>
            <b>{s.name}</b> <small>({s.slot})</small>
            <span>{money(s.perRace)} par GP · bonus {money(s.bonus)} si : {OBJECTIVE_LABEL[s.objective].toLowerCase()}</span>
          </div>
        ))}
        <p className="muted">Les contrats courent jusqu’à la fin de la saison.</p>
      </section>
      <section className="panel">
        <h2>Offres</h2>
        {availableSponsors(c).map((s) => (
          <div key={s.id} className="sponsor" style={{ borderLeftColor: s.color }}>
            <div><b>{s.name}</b> <small>{s.sector}</small></div>
            <span>{money(s.perRace)} par GP · signature {money(s.signing)}</span>
            <span>Bonus {money(s.bonus)} : {OBJECTIVE_LABEL[s.objective]}</span>
            {s.minReputation > rep
              ? <small className="warn">Réputation requise : {s.minReputation} (vous : {rep})</small>
              : <button className="btn small primary" disabled={c.sponsors.length >= MAX_SPONSORS} onClick={() => api.act((cc) => signSponsor(cc, s.id))}>Signer</button>}
          </div>
        ))}
      </section>
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
          <thead><tr><th>#</th><th>Pilote</th>{c.calendar.map((r) => <th key={r.round}>{getTrack(r.trackId).def.gp.split(' ').pop()!.slice(0, 3).toUpperCase()}</th>)}<th>Pts</th></tr></thead>
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
  const perRaceOut = mine.reduce((a, d) => a + (d.contract?.salary ?? 0), 0) / c.calendar.length + 1.4;
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Prévision par Grand Prix</h2>
        <ul className="facts">
          <li>Recettes garanties (sponsors + participation) : <b>{money(perRaceIn)}</b></li>
          <li>Dépenses (salaires + logistique) : <b>{money(-perRaceOut)}</b></li>
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
