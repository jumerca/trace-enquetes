import { useApp } from '../App';
import { depthChart, perGame, rulesFor, standings, teamLevel, user, userClub, userFixture, userRole, type Career } from '../../career/career';
import { fullName } from '../../data/model';
import { playerOvr } from '../../data/generate';
import { Portrait } from '../components/Art';

export function PreMatch() {
  const app = useApp();
  const c = app.career!;
  const f = userFixture(c);
  if (!f) {
    return (
      <div className="screen-pad">
        <p>Aucun match à jouer cette semaine.</p>
        <button className="btn" onClick={() => app.go({ name: 'hub', tab: 'home' })}>
          Retour
        </button>
      </div>
    );
  }
  const club = userClub(c);
  const opp = c.world.clubs[f.home === club.id ? f.away : f.home];
  const role = userRole(c);
  const u = user(c);
  const rules = rulesFor(c, f.leagueId);
  const st = standings(c, f.leagueId);
  const stake = f.stage === 'final' ? 'Finale : le titre est en jeu.' : f.stage === 'semi' ? 'Demi-finale à élimination directe.' : st.findIndex((r) => r.clubId === club.id) < 4 ? 'Garder sa place dans le Final Four.' : 'Recoller au groupe de tête.';
  const objective = role.rank < 5 ? 'Objectif personnel : note ≥ 6,5 et peser des deux côtés du terrain.' : role.minutes > 0 ? `Objectif personnel : convaincre en ${Math.round(role.minutes)} minutes environ.` : 'Objectif personnel : rester prêt, le coach peut faire appel à vous.';
  return (
    <div className="screen-pad fade-in">
      <div className="row spread wrap" style={{ marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => app.go({ name: 'hub', tab: 'home' })}>
          ← Retour
        </button>
        <span className="pill orange">
          {c.world.leagues[f.leagueId].name} · {f.stage === 'regular' ? `Journée ${f.round}` : f.stage === 'semi' ? 'Demi-finale' : 'Finale'}
        </span>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row spread wrap">
          <TeamHead c={c} id={f.home} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: '2.2rem', fontWeight: 800 }}>VS</div>
            <div className="tiny muted">
              {rules.label} · {rules.quarterMin} min par quart-temps{rules.quarterMin < (rules.id === 'NBA' ? 12 : 10) ? ' (option arcade)' : ''}
            </div>
          </div>
          <TeamHead c={c} id={f.away} />
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          <b>Enjeu :</b> {stake} <br />
          <b>Votre rôle :</b> {role.label}
          {role.minutes > 0 ? ` (~${Math.round(role.minutes)} min prévues)` : ''}. {objective}
          <br />
          <b>Consignes du coach {club.coach.name} :</b> rythme {club.coach.tactics.pace > 0.6 ? 'élevé' : club.coach.tactics.pace < 0.4 ? 'contrôlé' : 'moyen'}, défense {club.coach.tactics.defense === 'zone23' ? 'de zone 2-3' : club.coach.tactics.defense === 'switch' ? 'avec changements systématiques' : 'homme à homme'}, {club.coach.tactics.pnrFreq > 0.6 ? 'beaucoup de pick-and-roll' : 'jeu de passes'}.
        </p>
      </div>
      <div className="grid cols-2">
        <Lineup c={c} id={club.id} />
        <Lineup c={c} id={opp.id} watch />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row spread wrap">
          <div className="small muted">
            Vous contrôlez {fullName(u)} uniquement. {role.rank >= 5 ? 'Vous commencez sur le banc : vous pourrez accélérer le temps jusqu’à votre entrée.' : 'Vous êtes dans le cinq de départ.'}
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => app.go({ name: 'match' })}>
              Entrer sur le parquet ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamHead({ c, id }: { c: Career; id: string }) {
  const cl = c.world.clubs[id];
  const st = standings(c, cl.leagueId);
  const r = st.find((x) => x.clubId === id);
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4, minWidth: 120 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: cl.colors[0], color: cl.colors[1], border: `2px solid ${cl.colors[1]}`, display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.3rem' }}>{cl.short}</div>
      <b style={{ textAlign: 'center' }}>{cl.name}</b>
      <span className="tiny muted">
        Niveau {Math.round(teamLevel(c, id))} · {r ? `${r.w}V-${r.l}D` : ''} · forme {r?.last5 || '—'}
      </span>
    </div>
  );
}

function Lineup({ c, id, watch }: { c: Career; id: string; watch?: boolean }) {
  const dc = depthChart(c, id);
  const cl = c.world.clubs[id];
  const star = [...dc.order].sort((a, b) => (perGame(c.seasonStats[b.id]).ppg || playerOvr(b) / 10) - (perGame(c.seasonStats[a.id]).ppg || playerOvr(a) / 10))[0];
  return (
    <div className="card">
      <div className="card-title">
        <h3>{cl.short} — cinq majeur</h3>
        {watch && star && <span className="pill gold">À surveiller : {star.lastName}</span>}
      </div>
      {dc.starters.map((p) => (
        <div key={p.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <Portrait a={p.appearance} colors={cl.colors} number={p.number} size={34} />
          <span style={{ flex: 1, fontWeight: p.isUser ? 800 : 500, color: p.isUser ? 'var(--orange-2)' : undefined }}>
            {p.pos} · {fullName(p)}
          </span>
          <b className="num">{playerOvr(p)}</b>
        </div>
      ))}
      <div className="small muted" style={{ marginTop: 8 }}>
        Banc :{' '}
        {dc.bench
          .filter((p) => p.injuryDays <= 0)
          .slice(0, 7)
          .map((p) => `${p.isUser ? '★ ' : ''}${p.lastName} (${playerOvr(p)})`)
          .join(', ')}
      </div>
    </div>
  );
}
