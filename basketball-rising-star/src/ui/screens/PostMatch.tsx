import { useState } from 'react';
import { useApp } from '../App';
import { advanceWeek, gameRating, user, userFixture } from '../../career/career';
import type { MatchEngine } from '../../sim/engine';
import type { MPlayer } from '../../sim/types';
import { fullName } from '../../data/model';
import { ATTR_LABELS } from '../../data/attributes';

export function PostMatch() {
  const app = useApp();
  const lm = app.lastMatch;
  const [busy, setBusy] = useState(false);
  if (!lm) {
    return (
      <div className="screen-pad">
        <p>Aucun match récent.</p>
        <button className="btn" onClick={() => app.go({ name: 'home' })}>
          Accueil
        </button>
      </div>
    );
  }
  const e = lm.engine;
  const scale = (e.rules.id === 'NBA' ? 12 : 10) / e.rules.quarterMin;
  const rated = e.players.filter((p) => p.box.sec > 0).map((p) => ({ p, r: rate(p, scale) }));
  const mvp = rated.sort((a, b) => b.r - a.r)[0];
  const c = app.career;
  const u = c ? user(c) : null;
  const winner = e.teams[0].score > e.teams[1].score ? 0 : 1;
  const myIdx = e.userIdx;
  const myTeam = myIdx >= 0 ? e.players[myIdx].team : 0;
  const won = winner === myTeam;
  const line = lm.line;
  const coachComment = !line
    ? ''
    : line.min === 0
      ? '« Reste prêt. Ton tour viendra si tu continues à travailler. »'
      : line.rating >= 7.5
        ? '« Énorme match. C’est exactement ce que j’attends de toi. »'
        : line.rating >= 6.2
          ? '« Bon match, sérieux. Continue comme ça. »'
          : line.rating >= 5
            ? '« Correct, mais je veux plus d’impact, surtout en défense. »'
            : '« Pas ton jour. On en reparle à la vidéo. »';

  const proceed = async () => {
    if (lm.quick || !c) {
      app.setLastMatch(null);
      app.go({ name: 'home' });
      return;
    }
    setBusy(true);
    try {
      if (userFixture(c)) {
        // Un autre match (coupe, Espoirs…) attend encore cette semaine
        await app.persist(c);
        app.setLastMatch(null);
        app.go({ name: 'hub', tab: 'home' });
        app.toast('Un autre match vous attend cette semaine.');
        return;
      }
      const r = advanceWeek(c);
      await app.persist(c);
      app.setLastMatch(null);
      app.go({ name: 'hub', tab: 'home' });
      if (r.training.changed.length) app.toast(`Progrès à l'entraînement : ${r.training.changed.map((k) => ATTR_LABELS[k]).join(', ')}`);
      else if (r.injuries.length) app.toast(r.injuries[0]);
    } catch (err) {
      app.toast((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="screen-pad fade-in">
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="muted tiny" style={{ letterSpacing: '0.14em', fontWeight: 700 }}>
          FEUILLE DE MATCH {e.quarter > 4 ? `· ${e.quarter - 4} PROLONGATION(S)` : ''}
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 22, margin: '10px 0' }}>
          <b style={{ fontSize: '1.1rem' }}>{e.teams[0].name}</b>
          <span style={{ fontFamily: 'var(--display)', fontSize: '2.6rem', fontWeight: 800 }}>
            {e.teams[0].score} - {e.teams[1].score}
          </span>
          <b style={{ fontSize: '1.1rem' }}>{e.teams[1].name}</b>
        </div>
        <div className="small muted">
          Par quart-temps : {e.teams[0].scoreByQ.map((s, i) => `${s}-${e.teams[1].scoreByQ[i] ?? 0}`).join(' · ')}
        </div>
        <div className="row wrap" style={{ justifyContent: 'center', marginTop: 10 }}>
          <span className={`pill ${won ? 'green' : 'red'}`}>{won ? 'Victoire' : 'Défaite'}</span>
          {mvp && <span className="pill gold">Homme du match : {fullName(mvp.p.data)}</span>}
        </div>
      </div>
      {line && u && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">
            <h3>Votre match — {fullName(u)}</h3>
            <span className="pill orange">Note {line.rating.toFixed(1)}</span>
          </div>
          <div className="kpis">
            {(
              [
                ['Min', line.min],
                ['Pts', line.pts],
                ['Rbd', line.reb],
                ['Pd', line.ast],
                ['Int', line.stl],
                ['Ctr', line.blk],
                ['Tirs', `${line.fgm}/${line.fga}`],
                ['3 pts', `${line.tpm}/${line.tpa}`],
                ['LF', `${line.ftm}/${line.fta}`],
                ['+/-', line.pm > 0 ? `+${line.pm}` : line.pm],
              ] as [string, string | number][]
            ).map(([k, v]) => (
              <div className="kpi" key={k}>
                <span>{k}</span>
                <b className="stat-big" style={{ fontSize: '1.4rem' }}>
                  {v}
                </b>
              </div>
            ))}
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            <b>Le coach :</b> {coachComment} <span className="muted">· Réputation {Math.round(lm.reputationBefore)} → {Math.round(u.reputation)}</span>
          </p>
          {e.rules.quarterMin < (e.rules.id === 'NBA' ? 12 : 10) && <p className="tiny muted">Quarts-temps raccourcis (option arcade) : les minutes sont ramenées à l'échelle d'un match officiel dans les statistiques de saison.</p>}
        </div>
      )}
      {[0, 1].map((t) => (
        <BoxScore key={t} e={e} team={t as 0 | 1} />
      ))}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn primary" disabled={busy} onClick={proceed}>
          {lm.quick ? 'Retour à l\u2019accueil' : c && userFixture(c) ? 'Continuer (autre match cette semaine) →' : 'Continuer (semaine suivante) →'}
        </button>
      </div>
    </div>
  );
}

function rate(p: MPlayer, scale: number): number {
  const b = p.box;
  return gameRating({ pts: b.pts, reb: b.orb + b.drb, ast: b.ast, stl: b.stl, blk: b.blk, tov: b.tov, fgm: b.fgm, fga: b.fga, ftm: b.ftm, fta: b.fta, pf: b.pf, min: (b.sec / 60) * scale, pm: b.pm });
}

function BoxScore({ e, team }: { e: MatchEngine; team: 0 | 1 }) {
  const t = e.teams[team];
  const scale = (e.rules.id === 'NBA' ? 12 : 10) / e.rules.quarterMin;
  const ps = t.players.map((i) => e.players[i]);
  const tot = ps.reduce(
    (a, p) => {
      for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] += (p.box as unknown as Record<string, number>)[k] ?? 0;
      return a;
    },
    { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
  );
  return (
    <div className="card box-team" style={{ marginTop: 14 }}>
      <div className="card-title">
        <h3>{t.name}</h3>
        <span className="muted small">
          {tot.fga ? Math.round((tot.fgm / tot.fga) * 100) : 0}% tirs · {tot.tpa ? Math.round((tot.tpm / tot.tpa) * 100) : 0}% à 3 pts · {tot.orb + tot.drb} rbd · {tot.tov} pertes
        </span>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Joueur</th>
              <th className="r">Min</th>
              <th className="r">Pts</th>
              <th className="r">Tirs</th>
              <th className="r">3 pts</th>
              <th className="r">LF</th>
              <th className="r">RO</th>
              <th className="r">RD</th>
              <th className="r">Pd</th>
              <th className="r">Int</th>
              <th className="r">Ctr</th>
              <th className="r">BP</th>
              <th className="r">F</th>
              <th className="r">+/-</th>
              <th className="r">Éval</th>
            </tr>
          </thead>
          <tbody>
            {ps.map((p) => {
              const b = p.box;
              const evalScore = b.pts + b.orb + b.drb + b.ast + b.stl + b.blk - (b.fga - b.fgm) - (b.fta - b.ftm) - b.tov;
              return (
                <tr key={p.idx} className={p.isUser ? 'me' : ''}>
                  <td>
                    {p.data.number} {fullName(p.data)} <span className="muted tiny">{p.data.pos}</span>
                  </td>
                  <td className="r">{b.sec > 0 ? Math.round((b.sec / 60) * scale) : 'NJ'}</td>
                  <td className="r">
                    <b>{b.pts}</b>
                  </td>
                  <td className="r">
                    {b.fgm}/{b.fga}
                  </td>
                  <td className="r">
                    {b.tpm}/{b.tpa}
                  </td>
                  <td className="r">
                    {b.ftm}/{b.fta}
                  </td>
                  <td className="r">{b.orb}</td>
                  <td className="r">{b.drb}</td>
                  <td className="r">{b.ast}</td>
                  <td className="r">{b.stl}</td>
                  <td className="r">{b.blk}</td>
                  <td className="r">{b.tov}</td>
                  <td className="r">{b.pf}</td>
                  <td className="r">{b.pm > 0 ? `+${b.pm}` : b.pm}</td>
                  <td className="r">{evalScore}</td>
                </tr>
              );
            })}
            <tr>
              <td>
                <b>Total</b>
              </td>
              <td />
              <td className="r">
                <b>{tot.pts}</b>
              </td>
              <td className="r">
                {tot.fgm}/{tot.fga}
              </td>
              <td className="r">
                {tot.tpm}/{tot.tpa}
              </td>
              <td className="r">
                {tot.ftm}/{tot.fta}
              </td>
              <td className="r">{tot.orb}</td>
              <td className="r">{tot.drb}</td>
              <td className="r">{tot.ast}</td>
              <td className="r">{tot.stl}</td>
              <td className="r">{tot.blk}</td>
              <td className="r">{tot.tov}</td>
              <td className="r">{tot.pf}</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
