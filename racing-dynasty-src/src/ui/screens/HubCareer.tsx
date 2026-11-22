// Carrière longue : installations, presse et rivalités, carrière du directeur.
import type { GameApi } from '../App';
import { driverById, playerTeam, teamById } from '../../game/career';
import {
  declineOffers, director, facilities, facilityCost, facilityDuration, facilityUpkeep, FACILITY_INFO, mainRival, MAX_FACILITY,
  maxProjects, startFacilityUpgrade, switchTeam, answerConference, signRenewal, type Article, type FacilityKind,
} from '../../game/management';
import { carRating } from '../../game/data';
import type { Career } from '../../game/career';
import { DriverPortrait } from '../Visuals';
import { EmblemIcon, money } from '../common';

const FAC_ICON: Record<FacilityKind, string> = { soufflerie: '🌀', simulateur: '🎮', usine: '🏭' };

export function FacilitiesPanel({ api }: { api: GameApi }) {
  const c = api.career;
  const f = facilities(c);
  return (
    <section className="panel facilities">
      <h2>Installations</h2>
      <p className="muted">Entretien : {money(facilityUpkeep(c))} par Grand Prix · {maxProjects(c)} projet(s) de R&D en parallèle.</p>
      {f.building && (
        <p className="building">🚧 Chantier en cours : {FACILITY_INFO[f.building.kind].title} niveau {f[f.building.kind] + 1} — encore {f.building.left} GP</p>
      )}
      {(Object.keys(FACILITY_INFO) as FacilityKind[]).map((k) => {
        const lvl = f[k];
        const max = lvl >= MAX_FACILITY;
        return (
          <div key={k} className="facility">
            <span className="fac-ico">{FAC_ICON[k]}</span>
            <div className="fac-body">
              <b>{FACILITY_INFO[k].title}</b>
              <span className="fac-lvl" aria-label={`niveau ${lvl}`}>{Array.from({ length: MAX_FACILITY }, (_, i) => <i key={i} className={i < lvl ? 'on' : ''} />)}</span>
              <small className="muted">{FACILITY_INFO[k].effect}</small>
            </div>
            <button className="btn small" disabled={max || !!f.building || !!c.weekend}
              onClick={() => {
                if (confirm(`Agrandir ${FACILITY_INFO[k].title.toLowerCase()} au niveau ${lvl + 1} pour ${money(facilityCost(lvl))} (${facilityDuration(lvl)} GP de travaux) ?`)) api.act((cc) => startFacilityUpgrade(cc, k));
              }}>
              {max ? 'Max' : `Niv. ${lvl + 1} · ${money(facilityCost(lvl))} · ${facilityDuration(lvl)} GP`}
            </button>
          </div>
        );
      })}
    </section>
  );
}

export function ArticleCard({ c, a, compact }: { c: Career; a: Article; compact?: boolean }) {
  const team = playerTeam(c);
  return (
    <article className={'gazette' + (compact ? ' compact' : '')}>
      <header><span>LA GAZETTE DES PADDOCKS</span><small>Saison {a.season} · GP {a.round}</small></header>
      <h3>{a.title}</h3>
      <p>{a.body}</p>
      {a.quote && (() => {
        const d = driverById(c, a.quote.driverId);
        return (
          <div className="quote">
            <DriverPortrait id={d.id} color={team.color} color2={team.color2} size={44} />
            <blockquote>« {a.quote.text} »<cite>— {d.first} {d.last}</cite></blockquote>
          </div>
        );
      })()}
      {a.director && (
        <div className="quote">
          <div className="dir-badge">DIR.</div>
          <blockquote>« {a.director} »<cite>— le directeur de {team.name}</cite></blockquote>
        </div>
      )}
      {a.rivalQuote && (() => {
        const d = driverById(c, a.rivalQuote.driverId);
        const t = d.teamId ? teamById(c, d.teamId) : null;
        return (
          <div className="quote rival">
            <DriverPortrait id={d.id} color={t?.color ?? '#888'} color2={t?.color2 ?? '#fff'} size={44} />
            <blockquote>« {a.rivalQuote.text} »<cite>— {d.first} {d.last}, la réplique</cite></blockquote>
          </div>
        );
      })()}
    </article>
  );
}

export function PressTab({ api }: { api: GameApi }) {
  const c = api.career;
  const press = c.press ?? [];
  const mine = c.drivers.filter((d) => d.teamId === c.playerTeamId && (d.role ?? 'titulaire') === 'titulaire');
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Rivalités</h2>
        <p className="muted">Les duels en piste (dépassements, contacts, pénalités) créent des rivalités. Battre son rival remonte le moral, être battu l’entame.</p>
        {mine.map((d) => {
          const r = mainRival(c, d.id);
          const rd = r ? driverById(c, r.id) : null;
          return (
            <div key={d.id} className="rivalry">
              <b>{d.first} {d.last}</b>
              {rd ? <span>⚔ {rd.first} {rd.last} <small>({rd.teamId ? teamById(c, rd.teamId).short : 'libre'})</small><span className="heat"><i style={{ width: r!.level + '%' }} /></span><small>{r!.level >= 60 ? 'brûlante' : r!.level >= 40 ? 'tendue' : 'naissante'}</small></span>
                : <span className="muted">aucune rivalité</span>}
            </div>
          );
        })}
      </section>
      <section className="panel">
        <h2>Revue de presse</h2>
        {press.length === 0 && <p className="muted">Les journalistes attendent le premier Grand Prix.</p>}
        <div className="gazettes">{press.slice(0, 8).map((a, i) => <ArticleCard key={i} c={c} a={a} />)}</div>
      </section>
    </div>
  );
}

export function DirectorPanel({ api }: { api: GameApi }) {
  const c = api.career;
  const dir = director(c);
  const cls = dir.confidence >= 60 ? 'ok' : dir.confidence >= 30 ? 'mid' : 'ko';
  return (
    <section className="panel director">
      <h3>Votre poste de directeur</h3>
      <div className="confidence">
        <span>Confiance des actionnaires</span>
        <span className={'conf-bar ' + cls}><i style={{ width: dir.confidence + '%' }} /></span>
        <b>{dir.confidence}/100</b>
      </div>
      <p className="muted">Contrat : {dir.contractYears} saison(s) restante(s) · salaire {money(dir.salary ?? 0)}/saison + prime {money(dir.bonus ?? 0)} si l’objectif est atteint · gains de carrière {money(dir.earnings ?? 0)}. {dir.confidence < 30 ? '⚠ Votre poste est menacé : des résultats, vite !' : dir.confidence >= 70 ? 'Les grandes écuries vous observent…' : ''}</p>
      {!dir.fired && dir.renewal && (
        <div className="renewal">
          <b>Prolongation proposée par les actionnaires</b>
          {dir.renewal.map((o, i) => (
            <div key={i} className="renew-opt">
              <span>{o.label}<small>{o.years} saison(s) · {money(o.salary)}/saison · prime {money(o.bonus)}</small></span>
              <button className="btn small primary" onClick={() => api.act((cc) => signRenewal(cc, i))}>Signer</button>
              <button className="btn small" title="Tenter d’obtenir davantage (refus possible)" onClick={() => api.act((cc) => signRenewal(cc, i, true))}>Exiger plus</button>
            </div>
          ))}
        </div>
      )}
      {!dir.fired && dir.offers.length > 0 && !c.weekend && (
        <div className="offers">
          {dir.offers.map((o) => <OfferCard key={o.teamId} api={api} teamId={o.teamId} reason={o.reason} />)}
          <button className="btn" onClick={() => api.act((cc) => declineOffers(cc))}>Rester fidèle à {playerTeam(c).name}</button>
        </div>
      )}
      {dir.teams.length > 0 && (
        <p className="muted small">Parcours : {dir.teams.map((t) => `S${t.season} ${t.teamName} (${t.pos}ᵉ)`).join(' · ')}</p>
      )}
    </section>
  );
}

function OfferCard({ api, teamId, reason }: { api: GameApi; teamId: string; reason: string }) {
  const c = api.career;
  const t = teamById(c, teamId);
  return (
    <div className="offer" style={{ borderColor: t.color }}>
      <EmblemIcon emblem={t.emblem} color={t.color} color2={t.color2} size={34} />
      <div>
        <b>{t.name}</b>
        <small>{reason}</small>
        <small>Voiture : note {carRating(t.car).toFixed(1)}/20 · réputation {t.reputation}</small>
      </div>
      <button className="btn primary small" onClick={() => {
        if (confirm(`Prendre la direction de ${t.name} ? Vos sponsors, votre personnel et vos projets restent dans votre ancienne écurie.`)) {
          const e = api.act((cc) => switchTeam(cc, teamId));
          if (!e) api.toast(`Bienvenue chez ${t.name} !`);
        }
      }}>Accepter</button>
    </div>
  );
}

/** Écran de limogeage : la carrière continue ailleurs. */
export function FiredOverlay({ api }: { api: GameApi }) {
  const c = api.career;
  const dir = director(c);
  if (!dir.fired) return null;
  return (
    <div className="fired-overlay">
      <div className="fired panel">
        <div className="stamp">LIMOGÉ !</div>
        <h2>Les actionnaires de {playerTeam(c).name} vous remercient</h2>
        <p>{c.news.find((n) => n.text.startsWith('LIMOGEAGE'))?.text ?? ''}</p>
        <p>Votre carrière n’est pas finie : des écuries modestes vous proposent un nouveau défi.</p>
        <div className="offers">
          {dir.offers.map((o) => <OfferCard key={o.teamId} api={api} teamId={o.teamId} reason={o.reason} />)}
        </div>
        <button className="btn" onClick={() => api.go('home')}>Retour à l’accueil</button>
      </div>
    </div>
  );
}

/** Conférence de presse d'après-course : une question, trois réponses aux effets différents. */
export function ConferenceCard({ api }: { api: GameApi }) {
  const c = api.career;
  const pc = c.conference;
  if (!pc) return null;
  const fx = (n: number, label: string) => (n ? `${label} ${n > 0 ? '+' : ''}${n}` : '');
  return (
    <section className="panel conference">
      <h2>🎤 Conférence de presse</h2>
      <p className="question">« {pc.question} »</p>
      <div className="answers">
        {pc.answers.map((a, i) => (
          <button key={i} className={'btn' + (pc.answered === i ? ' primary' : '')} disabled={pc.answered !== undefined}
            onClick={() => api.act((cc) => answerConference(cc, i))}>
            {a.text}
            {pc.answered !== undefined && <small>{[fx(a.morale, 'moral'), fx(a.confidence, 'confiance'), fx(a.reputation, 'réputation'), a.rivalry ? (a.rivalry > 0 ? 'rivalité attisée' : 'rivalité apaisée') : ''].filter(Boolean).join(' · ') || 'sans effet'}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
