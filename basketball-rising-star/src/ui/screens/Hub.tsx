import { useState, type ReactNode } from 'react';
import { useApp } from '../App';
import { Logo, Portrait } from '../components/Art';
import {
  acceptOffer,
  advanceWeek,
  AGENTS,
  champion,
  depthChart,
  perGame,
  REGULAR_WEEKS,
  resolveEvent,
  retirePlayer,
  roleLabel,
  standings,
  startNextSeason,
  teamLevel,
  user,
  userClub,
  userFixture,
  userRole,
  type Career,
} from '../../career/career';
import { age, playerOvr } from '../../data/generate';
import { ARCHETYPES, ATTR_LABELS, ATTRIBUTE_GROUPS, POSITION_LABELS, type AttrGroup, type AttrKey } from '../../data/attributes';
import { fullName, type PlayerData } from '../../data/model';
import { NATIONS } from '../../data/names';
import { INTENSITY, PROGRAMS, autoProgram, type Intensity, type ProgramId, type TrainingMode } from '../../career/training';
import { createMatch, finishMatch } from '../../career/matchBridge';
import { simulateAsync } from '../simulate';
import { Modal } from '../components/Modal';
import { PlayerTab } from './PlayerTab';
import { FocusCard, InboxTab, InterestCard } from './InboxTab';
import { unread } from '../../career/life';
import { ClubProfile, DraftCard, LeagueCenter, MonthCalendar, TrainingWeek } from './ExtraTabs';
import { Comparator, CompetitionsCard, LifeTab, ObjectivesCard, PressCard, RivalCard } from './LifeTab';
import { careerVerdict, extra, legacyScore, negotiate } from '../../career/life';
import { fixtureName } from '../../career/competitions';
import { userSideId, userTeams } from '../../career/career';
import { winterOpen } from '../../career/life';

export type HubTab = 'home' | 'inbox' | 'player' | 'training' | 'life' | 'club' | 'calendar' | 'career';

const NAV: { id: HubTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Accueil', icon: '⌂' },
  { id: 'player', label: 'Joueur', icon: '◉' },
  { id: 'inbox', label: 'Messagerie', icon: '✉' },
  { id: 'training', label: 'Entraînement', icon: '◎' },
  { id: 'life', label: 'Vie', icon: '♥' },
  { id: 'club', label: 'Club', icon: '◈' },
  { id: 'calendar', label: 'Calendrier', icon: '▦' },
  { id: 'career', label: 'Carrière', icon: '★' },
];

const MOBILE_MAIN: HubTab[] = ['home', 'player', 'training', 'club'];

export function valClass(v: number): string {
  return v >= 17 ? 'v-elite' : v >= 14 ? 'v-great' : v >= 11 ? 'v-good' : v >= 7 ? 'v-mid' : 'v-low';
}

export function Hub({ tab }: { tab: HubTab }) {
  const app = useApp();
  const c = app.career!;
  const u = user(c);
  const club = userClub(c);
  const go = (t: HubTab) => app.go({ name: 'hub', tab: t });
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo compact />
        </div>
        {NAV.map((n) => (
          <button key={n.id} className="nav-item" aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            <span aria-hidden="true">{n.icon}</span> {n.label}
            {n.id === 'inbox' && unread(c) > 0 && <span className="count">{unread(c)}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={() => app.go({ name: 'settings', back: { name: 'hub', tab } })}>
          ⚙ Paramètres
        </button>
        <button className="nav-item" onClick={() => app.go({ name: 'help', back: { name: 'hub', tab } })}>
          ? Comment jouer
        </button>
        <button
          className="nav-item"
          onClick={async () => {
            await app.persist();
            app.go({ name: 'home' });
          }}
        >
          ⏏ Sauver et quitter
        </button>
        <div className="signature" style={{ padding: '10px 12px' }}>
          JLG CREATIVE
        </div>
      </aside>
      <main className="main fade-in" key={tab}>
        <div className="topbar">
          <div>
            <div className="muted tiny" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
              Saison {c.world.season}-{c.world.season + 1} · {c.phase === 'regular' ? `Semaine ${c.week}/${REGULAR_WEEKS}` : c.phase === 'playoffs' ? 'Playoffs' : 'Intersaison'}
            </div>
            <h2 style={{ fontSize: '1.35rem' }}>{club.name}</h2>
          </div>
          <div className="row">
            <button className="icon-btn" aria-label="Sauvegarder" title="Sauvegarder" onClick={async () => (await app.persist(), app.toast('Carrière sauvegardée.'))}>
              💾
            </button>
            <button className="icon-btn hide-desktop" aria-label="Paramètres" onClick={() => app.go({ name: 'settings', back: { name: 'hub', tab } })}>
              ⚙
            </button>
            <button
              className="icon-btn hide-desktop"
              aria-label="Sauver et quitter"
              onClick={async () => {
                await app.persist();
                app.go({ name: 'home' });
              }}
            >
              ⏏
            </button>
          </div>
        </div>
        {tab === 'home' && <HomeTab c={c} />}
        {tab === 'training' && <TrainingTab c={c} />}
        {tab === 'club' && <ClubTab c={c} />}
        {tab === 'calendar' && <CalendarTab c={c} />}
        {tab === 'career' && <CareerTab c={c} />}
        {tab === 'player' && <PlayerTab c={c} />}
        {tab === 'inbox' && <InboxTab c={c} />}
        {tab === 'life' && <LifeTab c={c} />}
        <div className="muted tiny" style={{ marginTop: 26, textAlign: 'center' }}>
          Univers fictif : clubs, compétitions et joueurs sont inventés. {fullName(u)} · {NATIONS[u.nationality]?.flag}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Navigation">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.id)).map((n) => (
          <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            <span style={{ fontSize: '1.25rem' }} aria-hidden="true">
              {n.icon}
            </span>
            {n.label}
          </button>
        ))}
        <button aria-current={!MOBILE_MAIN.includes(tab) ? 'page' : undefined} aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
          <span style={{ fontSize: '1.25rem' }} aria-hidden="true">
            ⋯
          </span>
          Plus
        </button>
      </nav>
      {moreOpen && (
        <div className="more-sheet fade-in" onClick={() => setMoreOpen(false)}>
          <div className="more-panel" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !MOBILE_MAIN.includes(n.id)).map((n) => (
              <button key={n.id} className="nav-item" aria-current={tab === n.id ? 'page' : undefined} onClick={() => (setMoreOpen(false), go(n.id))}>
                <span aria-hidden="true">{n.icon}</span> {n.label}
              </button>
            ))}
            <button className="nav-item" onClick={() => app.go({ name: 'settings', back: { name: 'hub', tab } })}>
              ⚙ Paramètres
            </button>
            <button className="nav-item" onClick={() => app.go({ name: 'help', back: { name: 'hub', tab } })}>
              ? Comment jouer
            </button>
          </div>
        </div>
      )}
      <style>{`@media (min-width: 861px){ .hide-desktop{ display:none !important } }`}</style>
    </div>
  );
}

// ------------------------------------------------------------------ Composants partagés
export function Bar({ v, max = 100, tone = '' }: { v: number; max?: number; tone?: string }) {
  return (
    <div className={`bar ${tone}`} role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );
}

function Gauge({ label, v, tone }: { label: string; v: number; tone?: string }) {
  return (
    <div>
      <div className="row spread small">
        <span className="muted">{label}</span>
        <b className="num">{Math.round(v)}</b>
      </div>
      <Bar v={v} tone={tone} />
    </div>
  );
}

export function PlayerHeader({ c }: { c: Career }) {
  const u = user(c);
  const club = userClub(c);
  const role = userRole(c);
  const ovr = playerOvr(u);
  return (
    <div className="card">
      <div className="player-card">
        <Portrait a={u.appearance} colors={club.colors} number={u.number} size={96} />
        <div style={{ minWidth: 0 }}>
          <div className="row spread wrap">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{fullName(u)}</div>
              <div className="muted small">
                {age(u, c.world.season)} ans · {u.pos}/{u.pos2} · {ARCHETYPES[u.archetype].label} · {u.heightCm} cm
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ovr" style={{ color: ovr >= 75 ? 'var(--gold)' : ovr >= 65 ? 'var(--green)' : 'var(--white)' }}>{ovr}</div>
              <div className="tiny muted">NOTE GLOBALE</div>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
            <span className={`pill ${role.rank < 5 ? 'green' : role.rank < 9 ? 'blue' : 'red'}`}>{role.label}</span>
            {u.injuryDays > 0 && <span className="pill red">Blessé · {Math.ceil(u.injuryDays / 7)} sem.</span>}
            <span className="pill">Réputation {Math.round(u.reputation)}</span>
          </div>
        </div>
      </div>
      <div className="grid cols-3" style={{ marginTop: 14, gap: 10 }}>
        <Gauge label="Confiance du coach" v={c.trust} tone="orange" />
        <Gauge label="Forme" v={u.form * 100} tone="green" />
        <Gauge label="Fraîcheur" v={100 - u.fatigue} />
        <Gauge label="Moral" v={u.morale} tone="green" />
        <Gauge label="Confiance en soi" v={u.confidence} tone="gold" />
        <Gauge label="Intégration" v={c.relations.teammates} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Accueil
function HomeTab({ c }: { c: Career }) {
  const app = useApp();
  const u = user(c);
  const club = userClub(c);
  const f = userFixture(c);
  const [busy, setBusy] = useState<string | null>(null);
  const mySide = f ? userSideId(c, f) : club.id;
  const me = c.world.clubs[mySide] ?? club;
  const opp = f ? c.world.clubs[f.home === mySide ? f.away : f.home] : null;
  const st = standings(c, club.leagueId);
  const rank = st.findIndex((r) => r.clubId === club.id) + 1;
  const pg = perGame(c.seasonStats[u.id]);

  const simulate = async () => {
    if (!f) return;
    setBusy('Simulation du match avec le moteur complet…');
    const e = createMatch(c, f);
    await simulateAsync(e);
    const line = finishMatch(c, f, e, false);
    app.setLastMatch({ engine: e, line, fixtureId: f.id, quick: false, reputationBefore: u.reputation });
    setBusy(null);
    app.go({ name: 'postmatch' });
  };
  const nextWeek = async () => {
    try {
      const r = advanceWeek(c);
      await app.persist(c);
      app.bump();
      app.toast(r.injuries[0] ?? (r.training.changed.length ? `Progrès : ${r.training.changed.map((k) => ATTR_LABELS[k]).join(', ')}` : 'Semaine terminée.'));
    } catch (e) {
      app.toast((e as Error).message);
    }
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <PlayerHeader c={c} />
      {c.event && <EventCard c={c} />}
      <PressCard c={c} />
      {unread(c) > 0 && (
        <button className="card" style={{ textAlign: 'left', borderColor: 'rgba(221,182,90,0.5)' }} onClick={() => app.go({ name: 'hub', tab: 'inbox' })}>
          <b>✉ {unread(c)} message(s) non lu(s)</b> <span className="muted small">· coach, agent, direction, médias</span>
        </button>
      )}
      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h3>{c.phase === 'offseason' ? 'Intersaison' : 'Prochaine échéance'}</h3>
            {f && <span className="pill orange">{fixtureName(c, f)}</span>}
          </div>
          {f && opp ? (
            <>
              <div className="row spread" style={{ margin: '6px 0 12px' }}>
                <TeamBadge name={me.short} colors={me.colors} />
                <div style={{ textAlign: 'center' }}>
                  <div className="muted tiny">{f.home === mySide ? 'DOMICILE' : 'EXTÉRIEUR'}</div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', fontWeight: 800 }}>VS</div>
                </div>
                <TeamBadge name={opp.short} colors={opp.colors} />
              </div>
              <div className="muted small" style={{ marginBottom: 12 }}>
                {opp.name} · niveau {Math.round(teamLevel(c, opp.id))} (vous : {Math.round(teamLevel(c, me.id))}){f.stage === 'youth' ? ' · équipe Espoirs (moins de 21 ans)' : ''}
              </div>
              {busy ? (
                <div className="muted">{busy}</div>
              ) : (
                <div className="row wrap">
                  <button className="btn primary" onClick={() => app.go({ name: 'prematch' })}>
                    Préparer et jouer le match
                  </button>
                  <button className="btn" onClick={simulate}>
                    Simuler le match
                  </button>
                </div>
              )}
              {u.injuryDays > 0 && <p className="small" style={{ color: '#ff8d90' }}>Vous êtes blessé : l'équipe jouera sans vous.</p>}
            </>
          ) : c.phase === 'offseason' ? (
            <Offseason c={c} />
          ) : (
            <>
              <p className="muted">Pas de match pour votre équipe cette semaine. Entraînez-vous puis passez à la semaine suivante.</p>
              <button className="btn primary" onClick={nextWeek}>
                Semaine suivante →
              </button>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Votre saison</h3>
            <span className="pill">{rank}e / {st.length}</span>
          </div>
          <div className="kpis">
            <div className="kpi">
              <span>Matchs</span>
              <b className="stat-big">{pg.gp}</b>
            </div>
            <div className="kpi">
              <span>Min</span>
              <b className="stat-big">{pg.mpg.toFixed(1)}</b>
            </div>
            <div className="kpi">
              <span>Pts</span>
              <b className="stat-big">{pg.ppg.toFixed(1)}</b>
            </div>
            <div className="kpi">
              <span>Rbd</span>
              <b className="stat-big">{pg.rpg.toFixed(1)}</b>
            </div>
            <div className="kpi">
              <span>Pd</span>
              <b className="stat-big">{pg.apg.toFixed(1)}</b>
            </div>
          </div>
          {c.lastTraining && (
            <p className="small" style={{ marginTop: 12 }}>
              <b>Dernier entraînement :</b> {c.lastTraining.note}
              {c.lastTraining.changed.length > 0 && <> — {c.lastTraining.changed.map((k) => `${ATTR_LABELS[k]} +`).join(', ')}</>}
            </p>
          )}
          <button className="btn small" style={{ marginTop: 6 }} onClick={() => app.go({ name: 'hub', tab: 'training' })}>
            Programme : {c.plan.mode === 'manual' ? PROGRAMS[c.plan.program].label : c.plan.mode === 'auto-weakness' ? 'auto (faiblesses)' : 'auto (objectifs)'} · {INTENSITY[c.plan.intensity].label}
          </button>
        </div>
      </div>
      <div className="grid cols-3">
        <ObjectivesCard c={c} />
        <CompetitionsCard c={c} />
        <RivalCard c={c} />
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h3>Actualités</h3>
          </div>
          {c.news.slice(0, 6).map((n) => (
            <div key={n.id} className="news-item">
              <b>{n.title}</b>
              <div className="small muted">{n.body}</div>
              <div className="tiny muted">
                {n.source ? `${n.source} · ` : ''}{kindLabel(n.kind)} · S{n.week}
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Classement — {c.world.leagues[club.leagueId].name}</h3>
          </div>
          <StandingsTable c={c} leagueId={club.leagueId} limit={8} />
        </div>
      </div>
    </div>
  );
}

function kindLabel(k: string): string {
  return ({ match: 'Match', transfer: 'Transfert', rumor: 'Rumeur', award: 'Récompense', injury: 'Infirmerie', coach: 'Staff', league: 'Championnat', national: 'Sélection', training: 'Entraînement', event: 'Décision' } as Record<string, string>)[k] ?? k;
}

function TeamBadge({ name, colors }: { name: string; colors: [string, string] }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
      <div style={{ width: 54, height: 54, borderRadius: 14, background: colors[0], color: colors[1], display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.1rem', border: `2px solid ${colors[1]}` }}>{name}</div>
    </div>
  );
}

function EventCard({ c }: { c: Career }) {
  const app = useApp();
  const ev = c.event!;
  return (
    <div className="card" style={{ borderColor: 'rgba(221,182,90,0.5)' }}>
      <div className="card-title">
        <h3 style={{ color: 'var(--gold)' }}>Décision : {ev.title}</h3>
      </div>
      <p>{ev.body}</p>
      <div className="grid" style={{ gap: 8 }}>
        {ev.choices.map((ch, i) => (
          <button
            key={i}
            className="choice"
            onClick={async () => {
              resolveEvent(c, i);
              await app.persist(c);
              app.bump();
            }}
          >
            <b>{ch.label}</b>
            <span className="small muted">{ch.effect}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Offseason({ c }: { c: Career }) {
  const app = useApp();
  const u = user(c);
  const club = userClub(c);
  const champ = champion(c, club.leagueId);
  const contractEnds = u.contract && u.contract.until <= c.world.season;
  return (
    <div className="grid" style={{ gap: 10 }}>
      <p className="small">
        Champion {c.world.leagues[club.leagueId].name} : <b>{champ ? c.world.clubs[champ].name : '—'}</b>. {contractEnds ? 'Votre contrat arrive à échéance : étudiez les offres.' : `Sous contrat jusqu'en ${(u.contract?.until ?? c.world.season) + 1}.`}
      </p>
      <p className="small muted">{c.offers.length} offre(s) disponible(s) dans l'onglet Carrière.</p>
      <div className="row wrap">
        <button className="btn" onClick={() => app.go({ name: 'hub', tab: 'career' })}>
          Voir les offres
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            startNextSeason(c);
            await app.persist(c);
            app.bump();
            app.toast(`Saison ${c.world.season}-${c.world.season + 1} lancée.`);
          }}
        >
          Lancer la saison suivante →
        </button>
      </div>
      {age(u, c.world.season) >= 33 && (
        <button
          className="btn danger small"
          onClick={async () => {
            retirePlayer(c);
            await app.persist(c);
            app.go({ name: 'hub', tab: 'career' });
          }}
        >
          Annoncer ma retraite
        </button>
      )}
    </div>
  );
}

export function StandingsTable({ c, leagueId, limit }: { c: Career; leagueId: string; limit?: number }) {
  const st = standings(c, leagueId);
  const me = userClub(c).id;
  const rows = limit ? st.slice(0, limit) : st;
  const showMe = limit && !rows.some((r) => r.clubId === me) ? st.find((r) => r.clubId === me) : null;
  const all = showMe ? [...rows, showMe] : rows;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>#</th>
            <th>Club</th>
            <th className="r">V</th>
            <th className="r">D</th>
            <th className="r">Diff</th>
            <th className="r">Série</th>
          </tr>
        </thead>
        <tbody>
          {all.map((r) => (
            <tr key={r.clubId} className={r.clubId === me ? 'me' : ''}>
              <td>{st.indexOf(r) + 1}</td>
              <td>{c.world.clubs[r.clubId].name}</td>
              <td className="r">{r.w}</td>
              <td className="r">{r.l}</td>
              <td className="r">{r.pf - r.pa > 0 ? '+' : ''}{r.pf - r.pa}</td>
              <td className="r">{r.streak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ Entraînement
function TrainingTab({ c }: { c: Career }) {
  const app = useApp();
  const u = user(c);
  const club = userClub(c);
  const set = (patch: Partial<typeof c.plan>) => {
    c.plan = { ...c.plan, ...patch };
    app.bump();
    void app.persist(c);
  };
  const auto = autoProgram(u, c.plan.mode);
  const effective: ProgramId = c.plan.mode === 'manual' ? c.plan.program : auto;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <TrainingWeek c={c} />
      <FocusCard c={c} />
      <div className="card">
        <div className="card-title">
          <h3>Mode de programmation</h3>
        </div>
        <div className="seg">
          {(
            [
              ['manual', 'Manuel'],
              ['auto-weakness', 'Automatique : faiblesses'],
              ['auto-objectives', 'Automatique : objectifs & matchs'],
            ] as [TrainingMode, string][]
          ).map(([m, l]) => (
            <button key={m} aria-pressed={c.plan.mode === m} onClick={() => set({ mode: m })}>
              {l}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Programme appliqué cette semaine : <b style={{ color: 'var(--white)' }}>{PROGRAMS[effective].label}</b>. Staff : {club.coach.name} (développement {club.coach.development}/20), infrastructures {club.facilities}/20.
        </p>
      </div>
      <div className="card">
        <div className="card-title">
          <h3>Programmes individuels</h3>
        </div>
        <div className="choice-grid">
          {(Object.keys(PROGRAMS) as ProgramId[]).map((id) => (
            <button key={id} className="choice" aria-pressed={effective === id} disabled={c.plan.mode !== 'manual'} onClick={() => set({ program: id })} style={c.plan.mode !== 'manual' && effective !== id ? { opacity: 0.55 } : undefined}>
              <b>{PROGRAMS[id].label}</b>
              <span className="small muted">{PROGRAMS[id].desc}</span>
              {PROGRAMS[id].attrs.length > 0 && (
                <span className="tiny muted">
                  {PROGRAMS[id].attrs.map((k) => `${ATTR_LABELS[k]} ${u.attrs[k]}`).join(' · ')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h3>Intensité</h3>
          </div>
          <div className="seg">
            {(Object.keys(INTENSITY) as Intensity[]).map((i) => (
              <button key={i} aria-pressed={c.plan.intensity === i} onClick={() => set({ intensity: i })}>
                {INTENSITY[i].label}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Une charge intense accélère la progression mais augmente réellement la fatigue et le risque de blessure (fraîcheur actuelle : {Math.round(100 - u.fatigue)}%).
          </p>
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Préparateur individuel</h3>
            <span className={`pill ${c.plan.specialistCoach ? 'green' : ''}`}>{c.plan.specialistCoach ? 'Engagé' : 'Non engagé'}</span>
          </div>
          <p className="small muted">Le préparateur individuel (+18 % de progression), le nutritionniste, le kiné et le préparateur mental s'engagent et se paient dans l'onglet Vie.</p>
          <button className="btn small" onClick={() => app.go({ name: 'hub', tab: 'life' })}>
            Gérer mon staff personnel
          </button>
        </div>
      </div>
      <AttributesCard p={u} />
    </div>
  );
}

export function AttributesCard({ p }: { p: PlayerData }) {
  const [g, setG] = useState<AttrGroup>('offense');
  return (
    <div className="card">
      <div className="card-title">
        <h3>Attributs (sur 20)</h3>
        <span className="pill gold">Potentiel estimé : {p.potential >= 85 ? 'exceptionnel' : p.potential >= 75 ? 'élevé' : p.potential >= 65 ? 'bon' : 'limité'}</span>
      </div>
      <div className="seg" style={{ marginBottom: 10 }}>
        {(Object.keys(ATTRIBUTE_GROUPS) as AttrGroup[]).map((k) => (
          <button key={k} aria-pressed={g === k} onClick={() => setG(k)}>
            {ATTRIBUTE_GROUPS[k].label}
          </button>
        ))}
      </div>
      <div className="grid cols-2" style={{ gap: '0 24px' }}>
        {(ATTRIBUTE_GROUPS[g].keys as readonly AttrKey[]).map((k) => (
          <div key={k} className="attr-row">
            <span>{ATTR_LABELS[k]}</span>
            <span className={`attr-val ${valClass(p.attrs[k])}`}>{p.attrs[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Club
function ClubTab({ c }: { c: Career }) {
  const club = userClub(c);
  const dc = depthChart(c, club.id);
  const [view, setView] = useState<'squad' | 'table' | 'leaders' | 'compare' | 'profile'>('profile');
  const lid = club.leagueId;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row spread wrap">
          <div>
            <h3>{club.name}</h3>
            <div className="small muted">
              {club.city} · {c.world.leagues[lid].name} · Coach {club.coach.name} · Philosophie : {club.philosophy === 'youth' ? 'formation' : club.philosophy === 'win-now' ? 'résultats immédiats' : 'équilibrée'} · Budget {(club.budget / 1e6).toFixed(1)} M€
            </div>
          </div>
          <div className="seg">
            <button aria-pressed={view === 'profile'} onClick={() => setView('profile')}>
              Le club
            </button>
            <button aria-pressed={view === 'squad'} onClick={() => setView('squad')}>
              Effectif
            </button>
            <button aria-pressed={view === 'table'} onClick={() => setView('table')}>
              Classement
            </button>
            <button aria-pressed={view === 'leaders'} onClick={() => setView('leaders')}>
              Meilleurs joueurs
            </button>
            <button aria-pressed={view === 'compare'} onClick={() => setView('compare')}>
              Comparateur
            </button>
          </div>
        </div>
      </div>
      {view === 'squad' && (
        <div className="card">
          <div className="card-title">
            <h3>Hiérarchie du coach</h3>
            <span className="muted small">Tactique : rythme {Math.round(club.coach.tactics.pace * 100)} · tirs à 3 pts {Math.round(club.coach.tactics.threeRate * 100)} · défense {club.coach.tactics.defense === 'zone23' ? 'zone 2-3' : club.coach.tactics.defense === 'switch' ? 'switch' : 'homme à homme'}</span>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Rôle</th>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Poste</th>
                  <th className="r">Âge</th>
                  <th className="r">Note</th>
                  <th className="r">Min. prévues</th>
                  <th className="r">Pts/m</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {dc.order.map((p, i) => {
                  const pg = perGame(c.seasonStats[p.id]);
                  return (
                    <tr key={p.id} className={p.isUser ? 'me' : ''}>
                      <td>{i < 5 ? <span className="pill green">5 majeur</span> : i < 9 ? <span className="pill blue">Rotation</span> : <span className="pill">Banc</span>}</td>
                      <td>{p.number}</td>
                      <td>{fullName(p)}</td>
                      <td>{p.pos}</td>
                      <td className="r">{age(p, c.world.season)}</td>
                      <td className="r">{playerOvr(p)}</td>
                      <td className="r">{Math.round(dc.minutes[p.id] ?? 0)}</td>
                      <td className="r">{pg.ppg.toFixed(1)}</td>
                      <td>{p.injuryDays > 0 ? <span className="pill red">Blessé</span> : p.fatigue > 60 ? <span className="pill orange">Fatigué</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {view === 'table' && (
        <div className="card">
          <StandingsTable c={c} leagueId={lid} />
        </div>
      )}
      {view === 'leaders' && <Leaders c={c} leagueId={lid} />}
      {view === 'compare' && <Comparator c={c} />}
      {view === 'profile' && <ClubProfile c={c} />}
    </div>
  );
}

function Leaders({ c, leagueId }: { c: Career; leagueId: string }) {
  const w = c.world;
  const ids = w.leagues[leagueId].teams.flatMap((t) => w.clubs[t].roster);
  const rows = ids
    .map((id) => ({ p: w.players[id], s: perGame(c.seasonStats[id]) }))
    .filter((r) => r.p && r.s.gp >= Math.max(1, Math.floor(c.week / 3)));
  const col = (title: string, key: 'ppg' | 'rpg' | 'apg') => (
    <div className="card">
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      {[...rows]
        .sort((a, b) => b.s[key] - a.s[key])
        .slice(0, 8)
        .map((r, i) => (
          <div key={r.p.id} className="row spread small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)', fontWeight: r.p.isUser ? 800 : 400, color: r.p.isUser ? 'var(--orange-2)' : undefined }}>
            <span>
              {i + 1}. {fullName(r.p)} <span className="muted">({w.clubs[r.p.clubId!]?.short})</span>
            </span>
            <b className="num">{r.s[key].toFixed(1)}</b>
          </div>
        ))}
    </div>
  );
  return (
    <div className="grid cols-3">
      {col('Points', 'ppg')}
      {col('Rebonds', 'rpg')}
      {col('Passes décisives', 'apg')}
    </div>
  );
}

// ------------------------------------------------------------------ Calendrier
function CalendarTab({ c }: { c: Career }) {
  const club = userClub(c);
  const [league, setLeague] = useState(club.leagueId);
  const mine = userTeams(c);
  const fx = c.world.fixtures.filter((f) => mine.includes(f.home) || mine.includes(f.away)).sort((a, b) => a.week - b.week);
  return (
    <div className="grid" style={{ gap: 14 }}>
      <CalView c={c} />
      <div className="card">
        <div className="card-title">
          <h3>Calendrier de {club.short}</h3>
          <span className="muted small">Entraînements chaque semaine · Final Four après la {REGULAR_WEEKS}e journée</span>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Sem.</th>
                <th>Compétition</th>
                <th>Adversaire</th>
                <th>Lieu</th>
                <th className="r">Score</th>
                <th className="r">Vos stats</th>
              </tr>
            </thead>
            <tbody>
              {fx.map((f) => {
                const home = mine.includes(f.home);
                const opp = c.world.clubs[home ? f.away : f.home] ?? club;
                const us = home ? f.hs : f.as;
                const them = home ? f.as : f.hs;
                return (
                  <tr key={f.id} className={f.week === c.week && !f.played ? 'me' : ''}>
                    <td>{f.week}</td>
                    <td>{fixtureName(c, f)}</td>
                    <td>{opp.name}</td>
                    <td>{home ? 'Dom.' : 'Ext.'}</td>
                    <td className="r">{f.played ? <b style={{ color: us > them ? 'var(--green)' : '#ff8d90' }}>{us > them ? 'V' : 'D'} {us}-{them}</b> : f.week === c.week ? 'Cette semaine' : '—'}</td>
                    <td className="r">{f.userLine ? (f.userLine.min > 0 ? `${f.userLine.pts} pts · ${f.userLine.reb} rbd · ${f.userLine.ast} pd · ${f.userLine.rating.toFixed(1)}` : 'N’a pas joué') : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-title">
          <h3>Autres championnats</h3>
          <select className="input" style={{ width: 'auto' }} value={league} onChange={(e) => setLeague(e.target.value)} aria-label="Championnat">
            {Object.values(c.world.leagues).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <StandingsTable c={c} leagueId={league} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Carrière
function CareerTab({ c }: { c: Career }) {
  const app = useApp();
  const u = user(c);
  const [view, setView] = useState<'profile' | 'contract' | 'history' | 'media' | 'legacy' | 'draft'>('profile');
  const [agentModal, setAgentModal] = useState(false);
  const agent = AGENTS.find((a) => a.id === c.agentId) ?? AGENTS[0];
  const club = userClub(c);
  return (
    <div className="grid" style={{ gap: 14 }}>
      {c.retired && <RetirementCard c={c} />}
      <div className="seg">
        {(
          [
            ['profile', 'Profil'],
            ['contract', `Contrat & offres${c.offers.length ? ` (${c.offers.length})` : ''}`],
            ['history', 'Historique & palmarès'],
            ['media', 'Médias & relations'],
            ['draft', 'Draft APL'],
            ['legacy', 'Histoire & héritage'],
          ] as [typeof view, string][]
        ).map(([k, l]) => (
          <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>
            {l}
          </button>
        ))}
      </div>
      {view === 'profile' && (
        <>
          <PlayerHeader c={c} />
          <div className="grid cols-2">
            <AttributesCard p={u} />
            <div className="card">
              <div className="card-title">
                <h3>Progression de la note</h3>
              </div>
              <Sparkline points={c.ovrHistory.map((h) => h.ovr)} />
              <p className="small muted">
                Né le {new Date(u.birthDate).toLocaleDateString('fr-FR')} à {u.birthCity} · {u.hand === 'L' ? 'gaucher' : 'droitier'} · {u.weightKg} kg · poste {POSITION_LABELS[u.pos]} (secondaire : {POSITION_LABELS[u.pos2]})
              </p>
            </div>
          </div>
        </>
      )}
      {view === 'contract' && <InterestCard c={c} />}
      {view === 'contract' && (
        <div className="grid cols-2">
          <div className="card">
            <h3>Contrat actuel</h3>
            <p>
              {club.name} · {u.contract?.salary ? `${Math.round(u.contract.salary / 1000)} k€/an` : 'Bourse / contrat espoir'} · jusqu'en {(u.contract?.until ?? c.world.season) + 1} · rôle {roleLabel(u.contract?.role ?? 'rotation')}
            </p>
            <h3 style={{ marginTop: 14 }}>Agent</h3>
            <p className="small">
              {agent.name} — réseau {agent.network}/20, négociation {agent.negotiation}/20, commission {agent.commission} %, zone {agent.region}
            </p>
            <button className="btn small" onClick={() => setAgentModal(true)}>
              Changer d'agent
            </button>
          </div>
          <div className="card">
            <h3>Offres reçues</h3>
            {c.offers.length === 0 && <p className="muted small">Aucune offre pour le moment. Les clubs se manifestent en fin de saison selon vos performances, votre réputation et le réseau de votre agent.</p>}
            {c.offers.map((o) => {
              const cl = c.world.clubs[o.clubId];
              return (
                <div key={o.id} className="news-item">
                  <b>{cl.name}</b>
                  <div className="small muted">
                    {o.note} · {roleLabel(o.role)} · {o.salary ? `${Math.round(o.salary / 1000)} k€/an` : 'bourse'} · {o.years} an(s)
                  </div>
                  <button
                    className="btn small primary"
                    style={{ marginTop: 6 }}
                    disabled={c.phase !== 'offseason' && !winterOpen(c)}
                    onClick={async () => {
                      acceptOffer(c, o.id);
                      await app.persist(c);
                      app.bump();
                      app.toast('Contrat signé.');
                    }}
                  >
                    Accepter
                  </button>{' '}
                  {(['salary', 'role'] as const).map((k) => (
                    <button
                      key={k}
                      className="btn small"
                      style={{ marginTop: 6 }}
                      onClick={async () => {
                        const r = negotiate(c, o.id, k);
                        await app.persist(c);
                        app.bump();
                        app.toast(r.text);
                      }}
                    >
                      {k === 'salary' ? 'Demander +15 % de salaire' : 'Exiger un rôle plus important'}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {view === 'history' && (
        <>
          <div className="card">
            <h3>Palmarès</h3>
            {c.trophies.length === 0 ? <p className="muted small">Aucun titre pour l'instant.</p> : c.trophies.map((t, i) => <div key={i} className="row spread small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}><span>{t.kind === 'team' ? '🏆' : '🏅'} {t.title}</span><span className="muted">{t.season}-{t.season + 1}</span></div>)}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Statistiques par saison</h3>
            <SeasonTable c={c} />
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Hors championnat (saison en cours)</h3>
            {Object.keys(c.compStats ?? {}).length === 0 ? (
              <p className="muted small">Aucun match de coupe, d'Europe, Espoirs ou de sélection cette saison.</p>
            ) : (
              <div className="table-wrap">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Compétition</th>
                      <th className="r">MJ</th>
                      <th className="r">Pts</th>
                      <th className="r">Rbd</th>
                      <th className="r">Pd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(c.compStats).map(([k, st]) => (
                      <tr key={k}>
                        <td>{({ cup: 'Coupes nationales', euro: 'EuroCoupe', youth: 'Espoirs (U21)', nat: 'Sélection nationale' } as Record<string, string>)[k] ?? k}</td>
                        <td className="r">{st.gp}</td>
                        <td className="r">{st.gp ? (st.pts / st.gp).toFixed(1) : '-'}</td>
                        <td className="r">{st.gp ? (st.reb / st.gp).toFixed(1) : '-'}</td>
                        <td className="r">{st.gp ? (st.ast / st.gp).toFixed(1) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Meilleures performances</h3>
            {c.bestGames.length === 0 && <p className="muted small">Jouez des matchs pour alimenter cette liste.</p>}
            {c.bestGames.map((g, i) => (
              <div key={i} className="row spread small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span>
                  {g.season} S{g.week} vs {g.opp}
                </span>
                <span className="num">
                  {g.pts} pts · {g.reb} rbd · {g.ast} pd · note {g.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {view === 'draft' && <DraftCard c={c} />}
      {view === 'legacy' && (
        <div className="grid cols-2">
          <div className="card">
            <div className="card-title">
              <h3>Score d'héritage</h3>
              <span className="pill gold">{legacyScore(c)}</span>
            </div>
            <p className="small muted">Calculé à partir des matchs, des points, des titres collectifs et individuels, des sélections et de la réputation. Une légende du jeu dépasse 1 500.</p>
            <div className="kpis" style={{ marginTop: 8 }}>
              <div className="kpi">
                <span>Saisons</span>
                <b className="stat-big">{u.history.length}</b>
              </div>
              <div className="kpi">
                <span>Titres</span>
                <b className="stat-big">{c.trophies.filter((t) => t.kind === 'team').length}</b>
              </div>
              <div className="kpi">
                <span>Distinctions</span>
                <b className="stat-big">{c.trophies.filter((t) => t.kind === 'individual').length}</b>
              </div>
              <div className="kpi">
                <span>Abonnés</span>
                <b className="stat-big" style={{ fontSize: '1.3rem' }}>{extra(c).followers.toLocaleString('fr-FR')}</b>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Histoire des championnats</h3>
            {extra(c).history.length === 0 ? (
              <p className="small muted">Le palmarès des saisons jouées s'affichera ici (champions et MVP de chaque ligue).</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 420 }}>
                <table className="t">
                  <thead>
                    <tr>
                      <th>Saison</th>
                      <th>Ligue</th>
                      <th>Champion</th>
                      <th>MVP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extra(c).history.map((h, i) => (
                      <tr key={i} className={h.userTeam ? 'me' : ''}>
                        <td>{h.season}-{(h.season + 1) % 100}</td>
                        <td>{h.league}</td>
                        <td>{h.champion}</td>
                        <td>{h.mvp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {view === 'media' && (
        <div className="grid cols-2">
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Relations</h3>
            <div className="grid" style={{ gap: 10 }}>
              {(
                [
                  ['Entraîneur', c.relations.coach],
                  ['Coéquipiers', c.relations.teammates],
                  ['Capitaine', c.relations.captain],
                  ['Supporters', c.relations.fans],
                  ['Médias', c.relations.media],
                  ['Staff médical', c.relations.medical],
                  ['Dirigeants', c.relations.board],
                ] as [string, number][]
              ).map(([l, v]) => (
                <Gauge key={l} label={l} v={v} />
              ))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Toutes les actualités</h3>
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              {c.news.map((n) => (
                <div key={n.id} className="news-item">
                  <b>{n.title}</b>
                  <div className="small muted">{n.body}</div>
                  <div className="tiny muted">
                    {n.source ? `${n.source} · ` : ''}{kindLabel(n.kind)} · {n.season} S{n.week}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {agentModal && (
        <Modal title="Choisir un agent" onClose={() => setAgentModal(false)}>
          <div className="grid" style={{ gap: 8 }}>
            {AGENTS.map((a) => (
              <button
                key={a.id}
                className="choice"
                aria-pressed={a.id === c.agentId}
                onClick={async () => {
                  c.agentId = a.id;
                  c.relations.agent = 55;
                  await app.persist(c);
                  setAgentModal(false);
                  app.bump();
                }}
              >
                <b>{a.name}</b>
                <span className="small muted">
                  Réseau {a.network}/20 · Négociation {a.negotiation}/20 · Commission {a.commission} % · {a.region}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function SeasonTable({ c }: { c: Career }) {
  const u = user(c);
  const cur = c.seasonStats[u.id];
  const club = userClub(c);
  const rows = [...u.history.map((h) => ({ ...h, cur: false }))];
  if (cur) rows.push({ season: c.world.season, clubId: club.id, clubName: club.name, league: c.world.leagues[club.leagueId].name, ...cur, cur: true });
  if (!rows.length) return <p className="muted small">Pas encore de match disputé.</p>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>Saison</th>
            <th>Club</th>
            <th className="r">MJ</th>
            <th className="r">Min</th>
            <th className="r">Pts</th>
            <th className="r">Rbd</th>
            <th className="r">Pd</th>
            <th className="r">Int</th>
            <th className="r">Ctr</th>
            <th className="r">Tirs</th>
            <th className="r">3 pts</th>
            <th className="r">LF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.cur ? 'me' : ''}>
              <td>{r.season}-{(r.season + 1) % 100}</td>
              <td>{r.clubName}</td>
              <td className="r">{r.gp}</td>
              <td className="r">{r.gp ? (r.min / r.gp).toFixed(1) : '-'}</td>
              <td className="r">{r.gp ? (r.pts / r.gp).toFixed(1) : '-'}</td>
              <td className="r">{r.gp ? (r.reb / r.gp).toFixed(1) : '-'}</td>
              <td className="r">{r.gp ? (r.ast / r.gp).toFixed(1) : '-'}</td>
              <td className="r">{r.gp ? (r.stl / r.gp).toFixed(1) : '-'}</td>
              <td className="r">{r.gp ? (r.blk / r.gp).toFixed(1) : '-'}</td>
              <td className="r">{r.fga ? `${((r.fgm / r.fga) * 100).toFixed(0)}%` : '-'}</td>
              <td className="r">{r.tpa ? `${((r.tpm / r.tpa) * 100).toFixed(0)}%` : '-'}</td>
              <td className="r">{r.fta ? `${((r.ftm / r.fta) * 100).toFixed(0)}%` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Sparkline({ points }: { points: number[] }): ReactNode {
  if (points.length < 2) return <p className="muted small">La courbe apparaîtra après quelques semaines.</p>;
  const w = 420;
  const h = 120;
  const min = Math.min(...points) - 2;
  const max = Math.max(...points) + 2;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * (w - 20) + 10, h - 10 - ((v - min) / (max - min)) * (h - 20)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Note globale : de ${points[0]} à ${points[points.length - 1]}`}>
      <path d={`${d} L${xy[xy.length - 1][0]} ${h} L${xy[0][0]} ${h} Z`} fill="rgba(57,136,245,0.15)" />
      <path d={d} fill="none" stroke="#3988F5" strokeWidth="2.5" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="4" fill="#F36B32" />
      <text x={w - 10} y={14} textAnchor="end" fontSize="12" fill="#9aa6bd">
        {points[0]} → {points[points.length - 1]}
      </text>
    </svg>
  );
}

function CalView({ c }: { c: Career }) {
  const [v, setV] = useState<'month' | 'league'>('month');
  return (
    <>
      <div className="seg">
        <button aria-pressed={v === 'month'} onClick={() => setV('month')}>
          Vue mensuelle
        </button>
        <button aria-pressed={v === 'league'} onClick={() => setV('league')}>
          Centre de la ligue
        </button>
      </div>
      {v === 'month' ? <MonthCalendar c={c} /> : <LeagueCenter c={c} />}
    </>
  );
}

/** Bilan de fin de carrière : place dans l'histoire, temple de la renommée, maillot retiré. */
function RetirementCard({ c }: { c: Career }) {
  const u = user(c);
  const v = careerVerdict(c);
  return (
    <div className="card" style={{ borderColor: 'var(--gold)' }}>
      <div className="card-title">
        <h3 style={{ color: 'var(--gold)' }}>Carrière terminée — {v.tier}</h3>
        <span className="pill gold">Héritage {v.score}</span>
      </div>
      <p>
        {fullName(u)} range ses chaussures après {v.seasons} saison(s). {v.text}
      </p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, margin: '10px 0' }}>
        {(
          [
            ['Matchs', v.gp],
            ['Points', v.pts],
            ['Rebonds', v.reb],
            ['Passes', v.ast],
            ['Moyenne', `${v.ppg.toFixed(1)} pts`],
            ['Titres collectifs', v.teamTitles],
            ['Distinctions', v.individual],
            ['Sélections', v.caps],
          ] as [string, string | number][]
        ).map(([l, x]) => (
          <div key={l}>
            <div className="tiny muted">{l.toUpperCase()}</div>
            <b className="num" style={{ fontSize: '1.2rem' }}>
              {x}
            </b>
          </div>
        ))}
      </div>
      {v.best && (
        <p className="small">
          Meilleure saison : {v.best.season}-{v.best.season + 1} avec {v.best.club} ({v.best.ppg.toFixed(1)} points de moyenne).
        </p>
      )}
      <p className="small">Clubs : {v.clubs.map((k) => `${k.name} (${k.seasons} saison${k.seasons > 1 ? 's' : ''})`).join(', ') || '—'}.</p>
      <p className="small" style={{ color: v.hallOfFame ? 'var(--gold)' : undefined }}>
        {v.hallOfFame ? '★ Élu au Temple de la renommée dès la première année d’éligibilité.' : 'Le Temple de la renommée reste hors de portée : il fallait un héritage d’au moins 600.'}
      </p>
      {v.retiredJersey && (
        <p className="small" style={{ color: 'var(--gold)' }}>
          ★ {v.retiredJersey} retire le numéro {u.number} : plus personne ne le portera.
        </p>
      )}
    </div>
  );
}
