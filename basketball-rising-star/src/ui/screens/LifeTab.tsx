import { useState } from 'react';
import { useApp } from '../App';
import { user, userClub, type Career } from '../../career/career';
import { acceptSponsor, CAMPS, chooseCamp, chooseInjuryPlan, extra, INJURY_PLANS, mentorCandidates, rival, sponsorIncome, type CampId, ACTIVITIES, canLoan, LIFESTYLES, life, makeRequest, objectiveProgress, PRESS_ANSWERS, answerPress, STAFF, weeklyCosts, weeklyIncome, winterOpen, type ActivityKey, type Lifestyle, type StaffKey } from '../../career/life';
import { comps, natStandings, type Competition } from '../../career/competitions';
import { fullName } from '../../data/model';
import { playerOvr, age } from '../../data/generate';
import { perGame } from '../../career/career';

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

/** Onglet « Vie » : finances, staff personnel, activité de la semaine et demandes aux dirigeants. */
export function LifeTab({ c }: { c: Career }) {
  const app = useApp();
  const l = life(c);
  const [msg, setMsg] = useState<string | null>(null);
  const save = () => {
    app.bump();
    void app.persist(c);
  };
  const income = weeklyIncome(c) + sponsorIncome(c);
  const costs = weeklyCosts(c);
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-title">
          <h3>Finances</h3>
          <span className={`pill ${income - costs >= 0 ? 'green' : 'red'}`}>
            {income - costs >= 0 ? '+' : ''}
            {eur(income - costs)} / semaine
          </span>
        </div>
        <div className="kpis">
          <div className="kpi">
            <span>Épargne</span>
            <b className="stat-big" style={{ fontSize: '1.4rem' }}>
              {eur(l.money)}
            </b>
          </div>
          <div className="kpi">
            <span>Revenu net / sem.</span>
            <b className="stat-big" style={{ fontSize: '1.4rem' }}>
              {eur(income)}
            </b>
          </div>
          <div className="kpi">
            <span>Dépenses / sem.</span>
            <b className="stat-big" style={{ fontSize: '1.4rem' }}>
              {eur(costs)}
            </b>
          </div>
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Revenu net estimé après commission d'agent, impôts et charges. Si l'épargne ne couvre plus les dépenses, le staff personnel est suspendu automatiquement.
        </p>
      </div>
      <MoreLife c={c} onMsg={setMsg} save={save} />
      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Train de vie</h3>
          <div className="grid" style={{ gap: 8 }}>
            {(Object.keys(LIFESTYLES) as Lifestyle[]).map((k) => (
              <button
                key={k}
                className="choice"
                aria-pressed={l.lifestyle === k}
                onClick={() => {
                  l.lifestyle = k;
                  save();
                }}
              >
                <b>
                  {LIFESTYLES[k].label} · {eur(LIFESTYLES[k].weekly)}/sem.
                </b>
                <span className="small muted">{LIFESTYLES[k].desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Staff personnel</h3>
          <div className="grid" style={{ gap: 8 }}>
            {(Object.keys(STAFF) as StaffKey[]).map((k) => (
              <button
                key={k}
                className="choice"
                aria-pressed={!!l.staff[k]}
                onClick={() => {
                  if (!l.staff[k] && l.money < STAFF[k].weekly * 4) {
                    setMsg(`Épargne insuffisante pour engager ce professionnel (il faut au moins ${eur(STAFF[k].weekly * 4)}).`);
                    return;
                  }
                  l.staff[k] = !l.staff[k];
                  save();
                }}
              >
                <b>
                  {l.staff[k] ? '✓ ' : ''}
                  {STAFF[k].label} · {eur(STAFF[k].weekly)}/sem.
                </b>
                <span className="small muted">{STAFF[k].desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">
          <h3>Activité de la semaine</h3>
          {l.lastActivity && <span className="muted small">Semaine précédente : {l.lastActivity}</span>}
        </div>
        <div className="choice-grid">
          {(Object.keys(ACTIVITIES) as ActivityKey[]).map((k) => (
            <button
              key={k}
              className="choice"
              aria-pressed={l.activity === k}
              onClick={() => {
                l.activity = l.activity === k ? null : k;
                save();
              }}
            >
              <b>{ACTIVITIES[k].label}</b>
              <span className="small muted">{ACTIVITIES[k].desc}</span>
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Une seule activité par semaine, appliquée au passage à la semaine suivante.
        </p>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Demandes aux dirigeants et au coach</h3>
        <div className="row wrap">
          <button className="btn small" onClick={() => setMsg(doReq(c, 'minutes', save))}>
            Demander plus de temps de jeu
          </button>
          <button className="btn small" disabled={!canLoan(c)} title={canLoan(c) ? '' : 'Réservé aux jeunes peu utilisés d’un club d’élite, avant la 15e journée'} onClick={() => setMsg(doReq(c, 'loan', save))}>
            Demander un prêt
          </button>
          {l.transferRequest ? (
            <button className="btn small" onClick={() => setMsg(doReq(c, 'stay', save))}>
              Retirer ma demande de départ
            </button>
          ) : (
            <button className="btn small danger" onClick={() => setMsg(doReq(c, 'transfer', save))}>
              Demander un transfert
            </button>
          )}
        </div>
        {l.loanFrom && <p className="small" style={{ marginTop: 8 }}>En prêt jusqu'à la fin de la saison (club propriétaire : {c.world.clubs[l.loanFrom]?.name}).</p>}
        {winterOpen(c) && <p className="small" style={{ marginTop: 8, color: 'var(--gold)' }}>Mercato d'hiver ouvert : les offres reçues sont dans l'onglet Carrière.</p>}
        {msg && (
          <p className="small" style={{ marginTop: 10 }} role="status">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}

function doReq(c: Career, k: Parameters<typeof makeRequest>[1], save: () => void): string {
  const r = makeRequest(c, k);
  save();
  return r.text;
}

export function PressCard({ c }: { c: Career }) {
  const app = useApp();
  const l = life(c);
  if (!l.pendingPress) return null;
  return (
    <div className="card" style={{ borderColor: 'rgba(57,136,245,0.5)' }}>
      <div className="card-title">
        <h3 style={{ color: '#8ab8ff' }}>Conférence de presse</h3>
      </div>
      <p className="small">Les journalistes vous attendent après le match. Que répondez-vous ?</p>
      <div className="grid cols-2" style={{ gap: 8 }}>
        {PRESS_ANSWERS.map((a, i) => (
          <button
            key={a.label}
            className="choice"
            onClick={async () => {
              const eff = answerPress(c, i);
              await app.persist(c);
              app.bump();
              app.toast(eff);
            }}
          >
            <b>{a.label}</b>
            <span className="small muted">{a.effect}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ObjectivesCard({ c }: { c: Career }) {
  const l = life(c);
  if (!l.objectives.length) return null;
  return (
    <div className="card">
      <div className="card-title">
        <h3>Objectifs fixés par le coach</h3>
      </div>
      {l.objectives.map((o) => {
        const v = objectiveProgress(c, o);
        const pct = Math.min(100, (v / o.target) * 100);
        return (
          <div key={o.id} style={{ padding: '6px 0' }}>
            <div className="row spread small">
              <span>{o.label}</span>
              <b className="num">
                {o.kind === 'games' ? v : v.toFixed(1)} / {o.target}
              </b>
            </div>
            <div className={`bar ${pct >= 100 ? 'green' : ''}`}>
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CompetitionsCard({ c }: { c: Career }) {
  const all = Object.values(comps(c.world));
  const me = userClub(c).id;
  if (!all.length) return null;
  const status = (comp: Competition) => {
    if (comp.winner) return `Vainqueur : ${c.world.clubs[comp.winner]?.name ?? '—'}`;
    const inIt = comp.teams.some((t) => t === me || (comp.kind === 'nat' && c.world.clubs[t]?.roster.includes(c.userId)));
    const alive = comp.alive.some((t) => t === me || (comp.kind === 'nat' && c.world.clubs[t]?.roster.includes(c.userId)));
    return `${comp.rounds[comp.round]?.label ?? ''} (semaine ${comp.rounds[comp.round]?.week ?? '—'}) · ${!inIt ? 'non qualifié' : alive ? 'toujours en lice' : 'éliminé'}`;
  };
  return (
    <div className="card">
      <div className="card-title">
        <h3>Coupes et compétitions</h3>
      </div>
      {all.map((comp) => (
        <div key={comp.id} className="row spread small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <b>{comp.name}</b>
          <span className="muted">{status(comp)}</span>
        </div>
      ))}
      {comps(c.world).NAT && (
        <div style={{ marginTop: 8 }}>
          <div className="tiny muted">Poule du Tournoi des nations</div>
          {natStandings(c).map((r, i) => (
            <div key={r.id} className="row spread small">
              <span>
                {i + 1}. {c.world.clubs[r.id]?.name}
              </span>
              <span className="num">
                {r.w} V · {r.diff > 0 ? '+' : ''}
                {r.diff}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Comparaison avec les joueurs du même poste dans le championnat. */
export function Comparator({ c }: { c: Career }) {
  const u = user(c);
  const lid = userClub(c).leagueId;
  const rows = c.world.leagues[lid].teams
    .flatMap((t) => c.world.clubs[t].roster)
    .map((id) => c.world.players[id])
    .filter((p) => p && p.pos === u.pos)
    .sort((a, b) => playerOvr(b) - playerOvr(a));
  const rank = rows.findIndex((p) => p.id === u.id) + 1;
  return (
    <div className="card">
      <div className="card-title">
        <h3>Comparateur — poste {u.pos}</h3>
        <span className="pill">
          {rank}e sur {rows.length}
        </span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th>Club</th>
              <th className="r">Âge</th>
              <th className="r">Note</th>
              <th className="r">Pts</th>
              <th className="r">Rbd</th>
              <th className="r">Pd</th>
              <th className="r">Min</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((p, i) => {
              const pg = perGame(c.seasonStats[p.id]);
              return (
                <tr key={p.id} className={p.isUser ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>{fullName(p)}</td>
                  <td>{c.world.clubs[p.clubId!]?.short}</td>
                  <td className="r">{age(p, c.world.season)}</td>
                  <td className="r">{playerOvr(p)}</td>
                  <td className="r">{pg.ppg.toFixed(1)}</td>
                  <td className="r">{pg.rpg.toFixed(1)}</td>
                  <td className="r">{pg.apg.toFixed(1)}</td>
                  <td className="r">{pg.mpg.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoreLife({ c, onMsg, save }: { c: Career; onMsg: (m: string) => void; save: () => void }) {
  const x = extra(c);
  const u = user(c);
  const mentors = mentorCandidates(c);
  return (
    <>
      {u.injuryDays > 0 && !x.injuryPlan && (
        <div className="card" style={{ borderColor: 'rgba(229,72,77,0.5)' }}>
          <div className="card-title">
            <h3 style={{ color: '#ff8d90' }}>Blessure : choisir le protocole</h3>
            <span className="pill red">{Math.ceil(u.injuryDays / 7)} semaine(s)</span>
          </div>
          <div className="grid cols-3" style={{ gap: 8 }}>
            {(Object.keys(INJURY_PLANS) as (keyof typeof INJURY_PLANS)[]).map((k) => (
              <button
                key={k}
                className="choice"
                onClick={() => {
                  onMsg(chooseInjuryPlan(c, k));
                  save();
                }}
              >
                <b>{INJURY_PLANS[k].label}</b>
                <span className="small muted">{INJURY_PLANS[k].desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h3>Réseaux sociaux et sponsors</h3>
            <span className="pill blue">{x.followers.toLocaleString('fr-FR')} abonnés</span>
          </div>
          {x.sponsorOffers.map((sp) => (
            <div key={sp.id} className="news-item">
              <b>
                Proposition : {sp.brand} <span className="muted small">({sp.sector})</span>
              </b>
              <div className="small muted">
                {sp.weekly.toLocaleString('fr-FR')} €/semaine jusqu'en {sp.until + 1} · une journée promotionnelle par mois
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn small primary" onClick={() => (acceptSponsor(c, sp.id, true), save())}>
                  Signer
                </button>
                <button className="btn small" onClick={() => (acceptSponsor(c, sp.id, false), save())}>
                  Refuser
                </button>
              </div>
            </div>
          ))}
          {x.sponsors.length === 0 && x.sponsorOffers.length === 0 && <p className="small muted">Aucun partenaire pour l'instant. Les marques arrivent avec la réputation et le nombre d'abonnés.</p>}
          {x.sponsors.map((sp) => (
            <div key={sp.id} className="row spread small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
              <span>✓ {sp.brand}</span>
              <span className="num">{sp.weekly.toLocaleString('fr-FR')} €/sem. · fin {sp.until + 1}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Mentor dans le vestiaire</h3>
          </div>
          {mentors.length === 0 ? (
            <p className="small muted">Aucun joueur expérimenté (27 ans et plus) à votre poste dans l'effectif.</p>
          ) : (
            <div className="grid" style={{ gap: 6 }}>
              {mentors.map((m) => (
                <button
                  key={m.id}
                  className="choice"
                  aria-pressed={x.mentorId === m.id}
                  onClick={() => {
                    x.mentorId = x.mentorId === m.id ? null : m.id;
                    save();
                  }}
                >
                  <b>
                    {fullName(m)} · {m.pos} · {age(m, c.world.season)} ans · note {playerOvr(m)}
                  </b>
                  <span className="small muted">Leadership {m.attrs.leadership}/20 · vous transmet ses points forts chaque semaine</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {c.phase === 'offseason' && (
        <div className="card">
          <div className="card-title">
            <h3>Stage d'été</h3>
            <span className="muted small">Effets appliqués au lancement de la saison suivante</span>
          </div>
          <div className="choice-grid">
            {(Object.keys(CAMPS) as CampId[]).map((k) => (
              <button
                key={k}
                className="choice"
                aria-pressed={x.campChoice === k}
                onClick={() => {
                  onMsg(chooseCamp(c, x.campChoice === k ? null : k));
                  save();
                }}
              >
                <b>{CAMPS[k].label}</b>
                <span className="small muted">
                  {CAMPS[k].desc} · {CAMPS[k].cost.toLocaleString('fr-FR')} €
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function RivalCard({ c }: { c: Career }) {
  const r = rival(c);
  const u = user(c);
  if (!r) return null;
  const a = perGame(c.seasonStats[u.id]);
  const b = perGame(c.seasonStats[r.id]);
  const row = (label: string, x: string | number, y: string | number) => (
    <div className="row spread small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
      <b className="num" style={{ width: 60 }}>{x}</b>
      <span className="muted">{label}</span>
      <b className="num" style={{ width: 60, textAlign: 'right' }}>{y}</b>
    </div>
  );
  return (
    <div className="card">
      <div className="card-title">
        <h3>Concurrent direct</h3>
        <span className="pill">{fullName(r)}</span>
      </div>
      {row('Note globale', playerOvr(u), playerOvr(r))}
      {row('Âge', age(u, c.world.season), age(r, c.world.season))}
      {row('Minutes / match', a.mpg.toFixed(1), b.mpg.toFixed(1))}
      {row('Points / match', a.ppg.toFixed(1), b.ppg.toFixed(1))}
      {row('Forme', Math.round(u.form * 100), Math.round(r.form * 100))}
      <p className="tiny muted" style={{ marginTop: 6 }}>Vous (à gauche) contre le joueur qui vous précède dans la hiérarchie du coach à votre poste.</p>
    </div>
  );
}
