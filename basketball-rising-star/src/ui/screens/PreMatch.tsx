import { useState } from 'react';
import { useApp } from '../App';
import { perGame, rulesFor, standings, teamInput, teamLevel, user, userFixture, userRole, userSideId, type Career } from '../../career/career';
import { fullName } from '../../data/model';
import { playerOvr } from '../../data/generate';
import { Portrait } from '../components/Art';
import { fixtureName } from '../../career/competitions';
import type { Fixture } from '../../career/world';

const STYLE_CHOICES = {
  shooting: { label: 'Prise de tirs', opts: [[-0.8, 'Collectif d’abord'], [0, 'Équilibrée'], [0.8, 'Prendre ses responsabilités']] },
  defense: { label: 'Défense', opts: [[0.15, 'Prudente (peu de fautes)'], [0.5, 'Normale'], [0.95, 'Agressive (interceptions)']] },
  hustle: { label: 'Effort', opts: [[0.15, 'Gérer son énergie'], [0.5, 'Normal'], [0.95, 'À fond (rebond, repli)']] },
} as const;

export function PreMatch() {
  const app = useApp();
  const c = app.career!;
  const f = userFixture(c);
  const [, force] = useState(0);
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
  const mySide = userSideId(c, f);
  const club = c.world.clubs[mySide];
  const oppId = f.home === mySide ? f.away : f.home;
  const role = userRole(c);
  const u = user(c);
  const rules = rulesFor(c, f.leagueId);
  const inLeague = !!c.world.leagues[f.leagueId];
  const st = inLeague ? standings(c, f.leagueId) : [];
  const stake =
    f.stage === 'final'
      ? 'Finale : le titre est en jeu.'
      : f.stage === 'semi'
        ? 'Demi-finale à élimination directe.'
        : f.stage === 'cup'
          ? `${f.label} : élimination directe, pas de match retour.`
          : f.stage === 'youth'
            ? 'Match Espoirs : l’occasion de montrer au staff que vous méritez des minutes en équipe première.'
            : f.stage === 'nat'
              ? 'Vous portez le maillot de votre pays.'
              : st.findIndex((r) => r.clubId === club.id) < 4
                ? 'Garder sa place dans le Final Four.'
                : 'Recoller au groupe de tête.';
  const starter = f.stage === 'youth' || f.stage === 'nat' || role.rank < 5;
  return (
    <div className="screen-pad fade-in">
      <div className="row spread wrap" style={{ marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => app.go({ name: 'hub', tab: 'home' })}>
          ← Retour
        </button>
        <span className="pill orange">{fixtureName(c, f)}</span>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row spread wrap">
          <TeamHead c={c} id={f.home} f={f} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: '2.2rem', fontWeight: 800 }}>VS</div>
            <div className="tiny muted">
              {rules.label} · {rules.quarterMin} min par quart-temps{rules.quarterMin < (rules.id === 'NBA' ? 12 : 10) ? ' (option arcade)' : ''}
            </div>
          </div>
          <TeamHead c={c} id={f.away} f={f} />
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          <b>Enjeu :</b> {stake}
          <br />
          {f.stage !== 'youth' && f.stage !== 'nat' && (
            <>
              <b>Votre rôle :</b> {role.label}
              {role.minutes > 0 ? ` (~${Math.round(role.minutes)} min prévues)` : ''}.<br />
              <b>Consignes du coach {club.coach.name} :</b> rythme {club.coach.tactics.pace > 0.6 ? 'élevé' : club.coach.tactics.pace < 0.4 ? 'contrôlé' : 'moyen'}, défense {club.coach.tactics.defense === 'zone23' ? 'de zone 2-3' : club.coach.tactics.defense === 'switch' ? 'avec changements systématiques' : 'homme à homme'}, {club.coach.tactics.pnrFreq > 0.6 ? 'beaucoup de pick-and-roll' : 'jeu de passes'}.
            </>
          )}
        </p>
      </div>
      <div className="grid cols-2">
        <Lineup c={c} id={mySide} f={f} />
        <Lineup c={c} id={oppId} f={f} watch />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">
          <h3>Vos consignes personnelles</h3>
          <span className="muted small">Modifiables aussi pendant le match</span>
        </div>
        <div className="grid cols-3">
          {(Object.keys(STYLE_CHOICES) as (keyof typeof STYLE_CHOICES)[]).map((k) => (
            <div key={k} className="field">
              <label>{STYLE_CHOICES[k].label}</label>
              <div className="seg">
                {STYLE_CHOICES[k].opts.map(([v, l]) => (
                  <button
                    key={l}
                    aria-pressed={Math.abs(c.style[k] - v) < 0.2}
                    onClick={() => {
                      c.style = { ...c.style, [k]: v };
                      force((x) => x + 1);
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row spread wrap">
          <div className="small muted">
            {fullName(u)} est joué par l'intelligence artificielle selon vos consignes : vous suivez le match, changez la vitesse, la caméra et vos consignes. {starter ? 'Vous êtes dans le cinq de départ.' : 'Vous commencez sur le banc : vous pourrez accélérer jusqu’à votre entrée.'}
          </div>
          <button
            className="btn primary"
            onClick={() => {
              void app.persist(c);
              app.go({ name: 'match' });
            }}
          >
            Lancer le match ▶
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamHead({ c, id, f }: { c: Career; id: string; f: Fixture }) {
  const cl = c.world.clubs[id];
  const st = c.world.leagues[cl.leagueId] ? standings(c, cl.leagueId) : [];
  const r = st.find((x) => x.clubId === id);
  const name = f.stage === 'youth' ? `${cl.name} (Espoirs)` : cl.name;
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 4, minWidth: 120 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: cl.colors[0], color: cl.colors[1], border: `2px solid ${cl.colors[1]}`, display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.3rem' }}>{cl.short}</div>
      <b style={{ textAlign: 'center' }}>{name}</b>
      <span className="tiny muted">
        Niveau {Math.round(teamLevel(c, id))}
        {r ? ` · ${r.w}V-${r.l}D · forme ${r.last5 || '—'}` : ''}
      </span>
    </div>
  );
}

function Lineup({ c, id, f, watch }: { c: Career; id: string; f: Fixture; watch?: boolean }) {
  const t = teamInput(c, id, f);
  const cl = c.world.clubs[id];
  const starters = t.players.slice(0, 5);
  const bench = t.players.slice(5);
  const star = [...t.players].sort((a, b) => (perGame(c.seasonStats[b.id]).ppg || playerOvr(b) / 10) - (perGame(c.seasonStats[a.id]).ppg || playerOvr(a) / 10))[0];
  return (
    <div className="card">
      <div className="card-title">
        <h3>{t.short} — cinq majeur</h3>
        {watch && star && <span className="pill gold">À surveiller : {star.lastName}</span>}
      </div>
      {starters.map((p) => (
        <div key={p.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
          <Portrait a={p.appearance} colors={cl.colors} number={p.number} size={34} />
          <span style={{ flex: 1, fontWeight: p.isUser ? 800 : 500, color: p.isUser ? 'var(--orange-2)' : undefined }}>
            {p.pos} · {fullName(p)}
          </span>
          <b className="num">{playerOvr(p)}</b>
        </div>
      ))}
      <div className="small muted" style={{ marginTop: 8 }}>
        Banc : {bench.map((p) => `${p.isUser ? '★ ' : ''}${p.lastName} (${playerOvr(p)})`).join(', ')}
      </div>
    </div>
  );
}
