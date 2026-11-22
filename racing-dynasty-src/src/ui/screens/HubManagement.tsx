// Onglets de gestion : pilotes (titulaires, réserve, académie, marché), usine (R&D, personnel), sponsors, palmarès.
import { useState } from 'react';
import type { GameApi } from '../App';
import {
  driverById, freeAgents, hireDriver, playerTeam, releaseCost, releaseDriver, signingFee, teamById, teamDrivers, teamStandings,
  UPGRADE_LABEL, MAX_SPONSORS,
} from '../../game/career';
import {
  academyDrivers, extendContract, extensionDemand, hireStaff, MAX_ACADEMY, MAX_PROJECTS, moraleLabel, moraleOf, negotiateSponsor,
  projectTerms, reserveDriver, setDriverRole, signYouth, sponsorStance, staffSigningFee, startProject, STAFF_ROLES, topBy,
  youthProspects, type StatLine,
} from '../../game/management';
import { carRating, driverRating, OBJECTIVE_LABEL, STAFF_LABEL, type Driver, type SponsorOffer } from '../../game/data';
import type { CarStats } from '../../engine/types';
import { Modal, StatBar, money } from '../common';
import { DriverCard } from './Hub';

// ================================================================ Pilotes

export function DriversTab({ api }: { api: GameApi }) {
  const c = api.career;
  const mine = teamDrivers(c, c.playerTeamId);
  const reserve = reserveDriver(c);
  const academy = academyDrivers(c);
  const [nego, setNego] = useState<Driver | null>(null);
  const [ext, setExt] = useState<Driver | null>(null);
  const [view, setView] = useState<'libres' | 'espoirs' | 'grille'>('libres');
  const locked = !!c.weekend;
  const role = (d: Driver, r: 'titulaire' | 'reserve' | 'academie') => api.act((cc) => setDriverRole(cc, d.id, r));
  const release = (d: Driver) => {
    if (confirm(`Libérer ${d.first} ${d.last} ? Indemnité : ${money(releaseCost(c, d.id))}.`)) api.act((cc) => releaseDriver(cc, d.id));
  };
  return (
    <div>
      {locked && <p className="panel warn">Week-end en cours : le marché et les changements de rôle sont fermés.</p>}
      <section className="panel">
        <h2>Titulaires ({mine.length}/2)</h2>
        <div className="cards">
          {mine.map((d) => (
            <DriverCard key={d.id} d={d}>
              <div className="row wrap">
                {d.contract && <button className="btn small" disabled={locked} onClick={() => setExt(d)}>Prolonger</button>}
                <button className="btn small" disabled={locked || !!reserve} onClick={() => role(d, 'reserve')}>En réserve</button>
                <button className="btn small danger" disabled={locked} onClick={() => release(d)}>Libérer</button>
              </div>
            </DriverCard>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Pilote de réserve</h2>
        {reserve ? (
          <div className="cards">
            <DriverCard d={reserve}>
              <div className="row wrap">
                <button className="btn small" disabled={locked || mine.length >= 2} onClick={() => role(reserve, 'titulaire')}>Titulaire</button>
                <button className="btn small danger" disabled={locked} onClick={() => release(reserve)}>Libérer</button>
              </div>
            </DriverCard>
          </div>
        ) : <p className="muted">Aucun. En cas de maladie ou de blessure d’un titulaire (3 % de risque par Grand Prix), un pilote libre sera appelé en urgence pour 0,4 M€. Passez un jeune de l’académie en réserve pour l’éviter.</p>}
      </section>
      <section className="panel">
        <h2>Académie ({academy.length}/{MAX_ACADEMY})</h2>
        <p className="muted">Les jeunes progressent après chaque Grand Prix vers leur potentiel (plus vite avec un bon ingénieur de course).</p>
        <div className="cards">
          {academy.map((d) => (
            <DriverCard key={d.id} d={d} compact>
              <div className="row wrap">
                <button className="btn small" disabled={locked || !!reserve} onClick={() => role(d, 'reserve')}>Réserve</button>
                <button className="btn small" disabled={locked || mine.length >= 2} onClick={() => role(d, 'titulaire')}>Titulaire</button>
                <button className="btn small danger" disabled={locked} onClick={() => release(d)}>Libérer</button>
              </div>
            </DriverCard>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="row spread">
          <h2>Marché</h2>
          <div className="seg">
            <button className={view === 'libres' ? 'on' : ''} onClick={() => setView('libres')}>Pilotes libres</button>
            <button className={view === 'espoirs' ? 'on' : ''} onClick={() => setView('espoirs')}>Espoirs</button>
            <button className={view === 'grille' ? 'on' : ''} onClick={() => setView('grille')}>Grille</button>
          </div>
        </div>
        {view === 'libres' && (
          <div className="cards">
            {freeAgents(c).map((d) => (
              <DriverCard key={d.id} d={d} compact>
                <div className="row spread">
                  <small>Demande : <b>{money(d.askSalary)}</b>/saison</small>
                  <button className="btn small primary" disabled={mine.length >= 2 || locked} onClick={() => setNego(d)}>Négocier</button>
                </div>
              </DriverCard>
            ))}
          </div>
        )}
        {view === 'espoirs' && (
          <div className="cards">
            {youthProspects(c).map((d) => (
              <DriverCard key={d.id} d={d} compact>
                <div className="row spread">
                  <small>Académie : 0,1 M€ + 0,2 M€/saison</small>
                  <button className="btn small primary" disabled={locked || academy.length >= MAX_ACADEMY} onClick={() => api.act((cc) => signYouth(cc, d.id))}>Signer</button>
                </div>
              </DriverCard>
            ))}
          </div>
        )}
        {view === 'grille' && (
          <table className="table">
            <thead><tr><th>Pilote</th><th>Écurie</th><th>Âge</th><th>Note</th><th>Moral</th><th>Contrat</th></tr></thead>
            <tbody>
              {c.drivers.filter((d) => d.teamId && (d.role ?? 'titulaire') === 'titulaire').sort((a, b) => driverRating(b.stats) - driverRating(a.stats)).map((d) => (
                <tr key={d.id} className={d.teamId === c.playerTeamId ? 'me' : ''}>
                  <td>{d.first[0]}. {d.last}</td><td><i className="dot" style={{ background: teamById(c, d.teamId!).color }} />{teamById(c, d.teamId!).short}</td>
                  <td>{d.age}</td><td>{driverRating(d.stats).toFixed(1)}</td><td>{moraleOf(d)}</td><td>{d.contract ? `${d.contract.years} an(s)` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {nego && <HireModal api={api} d={nego} onClose={() => setNego(null)} />}
      {ext && <ExtendModal api={api} d={ext} onClose={() => setExt(null)} />}
    </div>
  );
}

function HireModal({ api, d, onClose }: { api: GameApi; d: Driver; onClose: () => void }) {
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
      <p className="muted">Prime de signature : {money(signingFee(salary))} · Coût par Grand Prix : {money(salary / api.career.calendar.length)}.</p>
      {msg && <p className="warn">{msg}</p>}
      <button className="btn primary big" onClick={() => {
        const err = api.act((cc) => hireDriver(cc, d.id, salary, years));
        if (err) setMsg(err);
        else onClose();
      }}>Proposer le contrat</button>
    </Modal>
  );
}

function ExtendModal({ api, d, onClose }: { api: GameApi; d: Driver; onClose: () => void }) {
  const need = extensionDemand(d);
  const [salary, setSalary] = useState(Math.max(need, d.contract?.salary ?? need));
  const [years, setYears] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Modal title={`Prolongation — ${d.first} ${d.last}`} onClose={onClose}>
      <p>Moral : <b>{moraleLabel(moraleOf(d))}</b> ({moraleOf(d)}/100). Contrat actuel : {money(d.contract?.salary ?? 0)}/saison, encore {d.contract?.years} saison(s).</p>
      <p className="muted">Un pilote motivé est moins exigeant ; un pilote contrarié demande davantage, et refuse en dessous de 30 de moral.</p>
      <label>Nouveau salaire : <b>{money(salary)}</b>
        <input type="range" min={Math.max(0.2, need * 0.6)} max={need * 1.8} step={0.05} value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
      </label>
      <div className="choices">
        {[1, 2, 3].map((y) => <button key={y} className={'chip' + (y === years ? ' on' : '')} onClick={() => setYears(y)}>+{y} saison{y > 1 ? 's' : ''}</button>)}
      </div>
      {msg && <p className="warn">{msg}</p>}
      <button className="btn primary big" onClick={() => {
        const err = api.act((cc) => extendContract(cc, d.id, salary, years));
        if (err) setMsg(err);
        else onClose();
      }}>Proposer la prolongation</button>
    </Modal>
  );
}

// ================================================================ Usine : R&D et personnel

export function FactoryTab({ api }: { api: GameApi }) {
  const c = api.career;
  const t = playerTeam(c);
  const keys: (keyof CarStats)[] = ['moteur', 'aero', 'chassis', 'fiabilite'];
  const projects = c.projects ?? [];
  const rivals = teamStandings(c).map((s) => teamById(c, s.teamId));
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Recherche & développement</h2>
        <p className="muted">Chaque projet coûte au lancement et aboutit après plusieurs Grands Prix, avec une chance de réussite (et parfois une percée à +2). {MAX_PROJECTS} projets en parallèle au maximum.</p>
        {keys.map((k) => {
          const pr = projects.find((p) => p.stat === k);
          const terms = projectTerms(c, k);
          return (
            <div key={k} className="rnd">
              <StatBar label={UPGRADE_LABEL[k]} value={t.car[k]} />
              {pr ? (
                <div className="rnd-progress">
                  <div className="bar"><i style={{ width: (pr.progress / pr.duration) * 100 + '%' }} /></div>
                  <small>En cours : {pr.progress}/{pr.duration} GP · réussite {Math.round(pr.chance * 100)} %</small>
                </div>
              ) : (
                <button className="btn small" disabled={projects.length >= MAX_PROJECTS || t.car[k] >= 20} onClick={() => api.act((cc) => startProject(cc, k))}>
                  Lancer · {money(terms.cost)} · {terms.duration} GP · {Math.round(terms.chance * 100)} %
                </button>
              )}
            </div>
          );
        })}
        <StatBar label="Équipe aux stands" value={t.pitCrew} />
        <p className="muted">Les réglages (aileron, suspensions, boîte) se font pendant les essais libres.</p>
      </section>
      <section className="panel">
        <h2>Personnel clé</h2>
        {STAFF_ROLES.map((r) => {
          const cur = c.staff?.[r];
          const cands = (c.staffMarket ?? []).filter((m) => m.role === r);
          return (
            <div key={r} className="staff">
              <h3>{STAFF_LABEL[r].title}</h3>
              <small className="muted">{STAFF_LABEL[r].effect}</small>
              {cur && <div className="staff-cur"><b>{cur.name}</b><StatBar label="Niveau" value={cur.rating} /><small>{money(cur.salary)}/saison</small></div>}
              <div className="staff-cands">
                {cands.map((m) => (
                  <div key={m.id} className="staff-cand">
                    <span>{m.name} · niveau <b>{m.rating}</b> · {money(m.salary)}/saison</span>
                    <button className="btn small" disabled={!!c.weekend} onClick={() => {
                      if (confirm(`Recruter ${m.name} ? Prime ${money(staffSigningFee(m))}, et indemnité de départ pour ${cur?.name}.`)) api.act((cc) => hireStaff(cc, m.id));
                    }}>Recruter</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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

// ================================================================ Sponsors

export function SponsorsTab({ api }: { api: GameApi }) {
  const c = api.career;
  const rep = playerTeam(c).reputation;
  const [talk, setTalk] = useState<SponsorOffer | null>(null);
  const offers = c.sponsorOffers.filter((s) => !c.sponsors.some((x) => x.id === s.id));
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Partenaires ({c.sponsors.length}/{MAX_SPONSORS})</h2>
        {c.sponsors.length === 0 && <p className="muted">Aucun sponsor : chaque Grand Prix coûte sans rien rapporter.</p>}
        {c.sponsors.map((s) => (
          <div key={s.id} className="sponsor signed" style={{ borderLeftColor: s.color }}>
            <b>{s.name}</b> <small>({s.slot} · {s.years ?? 1} saison(s) restante(s))</small>
            <span>{money(s.perRace)} par GP · bonus {money(s.bonus)} si : {OBJECTIVE_LABEL[s.objective].toLowerCase()}</span>
          </div>
        ))}
        <p className="muted">Le sponsor principal s’affiche sur les pontons de vos voitures. Les contrats d’une saison reviennent en renouvellement à l’intersaison, avec des montants qui suivent votre réputation.</p>
      </section>
      <section className="panel">
        <h2>Offres</h2>
        {offers.map((s) => (
          <div key={s.id} className="sponsor" style={{ borderLeftColor: s.color }}>
            <div><b>{s.name}</b> <small>{s.sector}</small></div>
            <span>{money(s.perRace)} par GP · signature {money(s.signing)}</span>
            <span>Bonus {money(s.bonus)} : {OBJECTIVE_LABEL[s.objective]}</span>
            {s.minReputation > rep
              ? <small className="warn">Réputation requise : {s.minReputation} (vous : {rep})</small>
              : <button className="btn small primary" disabled={c.sponsors.length >= MAX_SPONSORS} onClick={() => setTalk(s)}>Négocier</button>}
          </div>
        ))}
      </section>
      {talk && <SponsorModal api={api} s={talk} onClose={() => setTalk(null)} />}
    </div>
  );
}

function SponsorModal({ api, s, onClose }: { api: GameApi; s: SponsorOffer; onClose: () => void }) {
  const c = api.career;
  const [mult, setMult] = useState(1);
  const [years, setYears] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const stance = sponsorStance(c, s, mult, years);
  return (
    <Modal title={`Négociation — ${s.name}`} onClose={onClose}>
      <p>Proposition de base : {money(s.perRace)} par GP, bonus {money(s.bonus)}, signature {money(s.signing)}.</p>
      <label>Montants demandés : <b>{mult >= 1 ? '+' : ''}{Math.round((mult - 1) * 100)} %</b> ({money(s.perRace * mult)} par GP)
        <input type="range" min={0.9} max={1.4} step={0.01} value={mult} onChange={(e) => setMult(Number(e.target.value))} />
      </label>
      <div className="choices">
        {[1, 2, 3].map((y) => <button key={y} className={'chip' + (y === years ? ' on' : '')} onClick={() => setYears(y)}>{y} saison{y > 1 ? 's' : ''}</button>)}
      </div>
      <p className={'stance ' + stance}>Réaction du sponsor : {stance === 'favorable' ? '😀 favorable' : stance === 'hesitant' ? '😐 hésitant' : '😠 réticent'}</p>
      <p className="muted">Un engagement plus long rassure le sponsor. Deux refus et il quitte la table pour la saison.</p>
      {msg && <p className="warn">{msg}</p>}
      <button className="btn primary big" onClick={() => {
        const err = api.act((cc) => negotiateSponsor(cc, s.id, mult, years));
        if (err) setMsg(err);
        else onClose();
      }}>Faire l’offre</button>
    </Modal>
  );
}

// ================================================================ Palmarès

export function PalmaresTab({ api }: { api: GameApi }) {
  const c = api.career;
  const st = c.stats;
  const team = playerTeam(c);
  const myLine: StatLine | undefined = st?.teams[team.id];
  const name = (id: string, kind: 'drivers' | 'teams') => {
    if (kind === 'teams') return c.teams.find((t) => t.id === id)?.name ?? id;
    const d = c.drivers.find((x) => x.id === id);
    return d ? `${d.first[0]}. ${d.last}` : id;
  };
  const board = (title: string, kind: 'drivers' | 'teams', key: keyof StatLine) => {
    const top = topBy(c, kind, key, 5);
    return (
      <div className="record">
        <h3>{title}</h3>
        {top.length === 0 ? <p className="muted">—</p> : <ol>{top.map((x) => <li key={x.id}>{name(x.id, kind)} <b>{x.value}</b></li>)}</ol>}
      </div>
    );
  };
  const myDrivers = c.drivers.filter((d) => d.teamId === c.playerTeamId);
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Champions</h2>
        {c.history.length === 0 ? <p className="muted">Aucune saison terminée pour l’instant.</p> : (
          <table className="table">
            <thead><tr><th>Saison</th><th>Pilote</th><th>Constructeurs</th><th>Vous</th></tr></thead>
            <tbody>{c.history.map((h) => <tr key={h.season}><td>{h.season}</td><td>{h.driverChampion}</td><td>{h.teamChampion}</td><td>{h.playerTeamPos}ᵉ</td></tr>)}</tbody>
          </table>
        )}
        <h2>{team.name}</h2>
        {myLine ? (
          <ul className="facts">
            <li>Départs : <b>{myLine.starts}</b> · Victoires : <b>{myLine.wins}</b> · Podiums : <b>{myLine.podiums}</b></li>
            <li>Pole positions : <b>{myLine.poles}</b> · Meilleurs tours : <b>{myLine.fastest}</b> · Points : <b>{myLine.points}</b></li>
            <li>Titres : <b>{myLine.titles}</b> · Meilleur résultat : <b>{myLine.best < 99 ? myLine.best + 'ᵉ' : '—'}</b></li>
          </ul>
        ) : <p className="muted">Pas encore de course disputée.</p>}
        <h3>Vos pilotes</h3>
        <table className="table">
          <thead><tr><th>Pilote</th><th>GP</th><th>V</th><th>Pod.</th><th>Poles</th><th>Pts</th><th>Ab.</th></tr></thead>
          <tbody>
            {myDrivers.map((d) => {
              const l = st?.drivers[d.id];
              return <tr key={d.id}><td>{d.first[0]}. {d.last}</td><td>{l?.starts ?? 0}</td><td>{l?.wins ?? 0}</td><td>{l?.podiums ?? 0}</td><td>{l?.poles ?? 0}</td><td>{l?.points ?? 0}</td><td>{l?.dnf ?? 0}</td></tr>;
            })}
          </tbody>
        </table>
      </section>
      <section className="panel records">
        <h2>Records</h2>
        {board('Victoires (pilotes)', 'drivers', 'wins')}
        {board('Pole positions', 'drivers', 'poles')}
        {board('Podiums', 'drivers', 'podiums')}
        {board('Titres (pilotes)', 'drivers', 'titles')}
        {board('Victoires (écuries)', 'teams', 'wins')}
        {board('Titres (constructeurs)', 'teams', 'titles')}
      </section>
    </div>
  );
}

export function moraleClass(m: number): string {
  return m >= 70 ? 'hi' : m >= 50 ? 'mid' : 'lo';
}

void driverById;
