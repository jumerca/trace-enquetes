import { useState } from 'react';
import { perGame, roleLabel, user, userClub, userRole, type Career } from '../../career/career';
import { extra } from '../../career/life';
import { attrDelta, badges, leagueRadar, marketValue, potentialStars, radar, RADAR_AXES, scoutingReport } from '../../career/scouting';
import { fixtureName } from '../../career/competitions';
import { ARCHETYPES, ATTR_LABELS, ATTRIBUTE_GROUPS, POSITION_LABELS, type AttrGroup, type AttrKey } from '../../data/attributes';
import { age, playerOvr } from '../../data/generate';
import { fullName } from '../../data/model';
import { NATIONS } from '../../data/names';
import { PlayerPortrait } from '../components/PlayerPortrait';
import { valClass } from './Hub';

const eur = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M€` : `${Math.round(n / 1000)} k€`);

/** Fiche joueur complète (inspirée des écrans de profil des jeux de gestion sportive). */
export function PlayerTab({ c }: { c: Career }) {
  const u = user(c);
  const club = userClub(c);
  const x = extra(c);
  const ovr = playerOvr(u);
  const role = userRole(c);
  const pg = perGame(c.seasonStats[u.id]);
  const delta = attrDelta(c, u, x.attrSnap);
  const bd = badges(u);
  const won = bd.filter((b) => b.tier > 0).sort((a, b) => b.tier - a.tier);
  const tierName = ['—', 'Bronze', 'Argent', 'Or'];
  const tierColor = ['var(--muted-2)', '#c98a55', '#c9d1dc', 'var(--gold)'];
  const repTier = u.reputation >= 85 ? 'Star internationale' : u.reputation >= 65 ? 'Star nationale' : u.reputation >= 45 ? 'Joueur reconnu' : u.reputation >= 25 ? 'Espoir suivi' : 'Inconnu du grand public';
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="profile-hero card">
        <div className="profile-portrait">
          <PlayerPortrait a={u.appearance} colors={club.colors} number={u.number} size={210} seedKey={`${u.firstName}${u.lastName}`} weightKg={u.weightKg} heightCm={u.heightCm} />
        </div>
        <div className="profile-main">
          <div className="tiny muted" style={{ letterSpacing: '0.14em', fontWeight: 700 }}>
            {NATIONS[u.nationality]?.flag} {NATIONS[u.nationality]?.label.toUpperCase()} · #{u.number} · {club.name.toUpperCase()}
          </div>
          <h2 style={{ fontSize: '2.2rem', marginTop: 4 }}>
            {u.firstName} <span style={{ color: 'var(--orange)' }}>{u.lastName}</span>
          </h2>
          <div className="row wrap" style={{ gap: 6, margin: '8px 0 12px' }}>
            <span className="pill orange">
              {u.pos} · {POSITION_LABELS[u.pos]}
            </span>
            <span className="pill">{u.pos2} en second</span>
            <span className="pill blue">{ARCHETYPES[u.archetype].label}</span>
            <span className="pill">{role.label}</span>
          </div>
          <div className="profile-ratings">
            <div>
              <div className="ovr-ring" style={{ ['--p' as string]: `${ovr}` }}>
                <b>{ovr}</b>
              </div>
              <div className="tiny muted" style={{ textAlign: 'center', marginTop: 4 }}>
                NOTE
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', color: 'var(--gold)', letterSpacing: 2 }} aria-label={`Potentiel ${potentialStars(u)} étoiles sur 5`}>
                {'★'.repeat(potentialStars(u))}
                <span style={{ color: 'var(--muted-2)' }}>{'★'.repeat(5 - potentialStars(u))}</span>
              </div>
              <div className="tiny muted">POTENTIEL ESTIMÉ PAR LE STAFF</div>
            </div>
          </div>
          <div className="info-grid">
            {(
              [
                ['Âge', `${age(u, c.world.season)} ans`],
                ['Né le', `${new Date(u.birthDate).toLocaleDateString('fr-FR')} à ${u.birthCity}`],
                ['Taille / poids', `${u.heightCm} cm · ${u.weightKg} kg`],
                ['Main forte', u.hand === 'L' ? 'Gauche' : 'Droite'],
                ['Contrat', `${u.contract?.salary ? `${Math.round(u.contract.salary / 1000)} k€/an` : 'Bourse / espoir'} jusqu'en ${(u.contract?.until ?? c.world.season) + 1} (${roleLabel(u.contract?.role ?? 'rotation')})`],
                ['Valeur marchande', eur(marketValue(c, u))],
                ['Réputation', `${Math.round(u.reputation)}/100 · ${repTier}`],
                ['Abonnés', x.followers.toLocaleString('fr-FR')],
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

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h3>Profil de jeu</h3>
            <span className="muted small">Vous (orange) · moyenne des {u.pos} de la ligue (bleu)</span>
          </div>
          <Radar values={radar(u)} avg={leagueRadar(c, club.leagueId, u.pos)} labels={RADAR_AXES.map((a) => a.label)} />
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Rapport du recruteur</h3>
          </div>
          {scoutingReport(c, u).map((l, i) => (
            <p key={i} className="small" style={{ margin: '0 0 8px' }}>
              {l}
            </p>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Badges de style</h3>
          <span className="muted small">{won.length} obtenu(s) sur {bd.length} · paliers bronze, argent, or</span>
        </div>
        <div className="badge-grid">
          {bd
            .sort((a, b) => b.tier - a.tier)
            .map((b) => (
              <div key={b.id} className={`badge ${b.tier ? '' : 'off'}`} title={b.desc}>
                <div className="badge-ico" style={{ borderColor: tierColor[b.tier], color: tierColor[b.tier] }}>
                  {b.name[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <b>{b.name}</b>
                  <div className="tiny muted">
                    {tierName[b.tier]}
                    {b.tier < 3 ? ` · encore ${b.next} pts d'attributs` : ''}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <AttributesFM c={c} delta={delta} />

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">
            <h3>Carte des tirs</h3>
            <span className="muted small">Saison en cours · matchs joués par le moteur</span>
          </div>
          <ShotChart shots={(x.shots ?? []).filter((s) => s.season === c.world.season)} />
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Condition et moral</h3>
          </div>
          <WellnessChart data={x.wellness ?? []} />
          <h3 style={{ margin: '12px 0 6px' }}>Historique médical</h3>
          {(x.injuries ?? []).length === 0 ? (
            <p className="small muted">Aucune blessure enregistrée.</p>
          ) : (
            (x.injuries ?? []).slice(-6).reverse().map((inj, i) => (
              <div key={i} className="row spread small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{inj.cause}</span>
                <span className="muted">
                  {inj.season} S{inj.week} · {Math.ceil(inj.days / 7)} sem.
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Journal des matchs</h3>
          <span className="muted small">
            Moyennes : {pg.ppg.toFixed(1)} pts · {pg.rpg.toFixed(1)} rbd · {pg.apg.toFixed(1)} pd · {pg.mpg.toFixed(1)} min
          </span>
        </div>
        <GameLog c={c} />
      </div>
    </div>
  );
}

function AttributesFM({ c, delta }: { c: Career; delta: Partial<Record<AttrKey, number>> }) {
  const u = user(c);
  const [focus, setFocus] = useState<AttrGroup | 'all'>('all');
  const groups = (Object.keys(ATTRIBUTE_GROUPS) as AttrGroup[]).filter((g) => focus === 'all' || g === focus);
  return (
    <div className="card">
      <div className="card-title">
        <h3>Attributs détaillés (sur 20)</h3>
        <div className="seg">
          <button aria-pressed={focus === 'all'} onClick={() => setFocus('all')}>
            Tous
          </button>
          {(Object.keys(ATTRIBUTE_GROUPS) as AttrGroup[]).map((g) => (
            <button key={g} aria-pressed={focus === g} onClick={() => setFocus(g)}>
              {ATTRIBUTE_GROUPS[g].label}
            </button>
          ))}
        </div>
      </div>
      <div className="attr-columns">
        {groups.map((g) => {
          const keys = ATTRIBUTE_GROUPS[g].keys as readonly AttrKey[];
          const avg = keys.reduce((s, k) => s + u.attrs[k], 0) / keys.length;
          return (
            <div key={g}>
              <div className="row spread" style={{ marginBottom: 4 }}>
                <b className="small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {ATTRIBUTE_GROUPS[g].label}
                </b>
                <span className="tiny muted">moy. {avg.toFixed(1)}</span>
              </div>
              {keys.map((k) => (
                <div key={k} className="attr-row">
                  <span>
                    {ATTR_LABELS[k]}
                    {delta[k] ? (
                      <span className="delta" style={{ color: delta[k]! > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {delta[k]! > 0 ? '▲' : '▼'}
                        {Math.abs(delta[k]!)}
                      </span>
                    ) : null}
                  </span>
                  <span className={`attr-val ${valClass(u.attrs[k])}`}>{u.attrs[k]}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        ▲▼ : évolution depuis le début de la saison.
      </p>
    </div>
  );
}

export function Radar({ values, avg, labels }: { values: number[]; avg?: number[]; labels: string[] }) {
  const n = values.length;
  const R = 92;
  const cx = 130;
  const cy = 120;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = (v / 20) * R;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  return (
    <svg viewBox="-30 0 320 245" width="100%" style={{ maxWidth: 380, display: 'block', margin: '0 auto' }} role="img" aria-label="Profil radar">
      {[5, 10, 15, 20].map((r) => (
        <polygon key={r} points={poly(values.map(() => r))} fill="none" stroke="var(--line-2)" strokeWidth="1" />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 20);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" />;
      })}
      {avg && <polygon points={poly(avg)} fill="rgba(57,136,245,0.18)" stroke="#3988F5" strokeWidth="1.6" />}
      <polygon points={poly(values)} fill="rgba(243,107,50,0.28)" stroke="#F36B32" strokeWidth="2.2" />
      {values.map((v, i) => {
        const [x, y] = pt(i, v);
        return <circle key={i} cx={x} cy={y} r="3" fill="#F36B32" />;
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 24);
        return (
          <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--muted)">
            {l} {values[i].toFixed(0)}
          </text>
        );
      })}
    </svg>
  );
}

function ShotChart({ shots }: { shots: { u: number; v: number; made: boolean; type: string }[] }) {
  // Demi-terrain vu de dessus : panier en haut. u = profondeur (m), v = latéral (m)
  const W = 300;
  const H = 260;
  const sc = 19;
  const X = (v: number) => W / 2 + v * sc;
  const Y = (u: number) => 26 + u * sc;
  const made = shots.filter((s) => s.made).length;
  const threes = shots.filter((s) => s.type === 'three');
  const zone = (f: (s: (typeof shots)[number]) => boolean) => {
    const z = shots.filter(f);
    return z.length ? `${z.filter((s) => s.made).length}/${z.length} (${Math.round((z.filter((s) => s.made).length / z.length) * 100)} %)` : '—';
  };
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420, display: 'block', margin: '0 auto' }} role="img" aria-label={`Carte des tirs : ${made} réussis sur ${shots.length}`}>
        <rect x="0" y="0" width={W} height={H} rx="10" fill="#c98d55" opacity="0.9" />
        <rect x={X(-2.45)} y={Y(-1.575)} width={4.9 * sc} height={5.8 * sc} fill="#1d3d6e" opacity="0.85" />
        <g fill="none" stroke="#F6F4EF" strokeWidth="1.6">
          <line x1="0" y1={Y(-1.575)} x2={W} y2={Y(-1.575)} />
          <path d={`M ${X(-6.6)} ${Y(-1.575)} L ${X(-6.6)} ${Y(1.3)} A ${6.75 * sc} ${6.75 * sc} 0 0 0 ${X(6.6)} ${Y(1.3)} L ${X(6.6)} ${Y(-1.575)}`} />
          <circle cx={X(0)} cy={Y(0)} r={0.23 * sc} stroke="#F36B32" strokeWidth="2.5" />
          <line x1={X(-0.9)} y1={Y(-0.375)} x2={X(0.9)} y2={Y(-0.375)} strokeWidth="3" />
        </g>
        {shots.map((s, i) => (s.made ? <circle key={i} cx={X(s.v)} cy={Y(Math.max(-1.2, s.u))} r="4" fill="#28B78B" stroke="#0b111d" strokeWidth="0.8" /> : <path key={i} d={`M ${X(s.v) - 3.5} ${Y(s.u) - 3.5} l 7 7 m 0 -7 l -7 7`} stroke="#e5484d" strokeWidth="2" />))}
      </svg>
      <div className="row wrap small" style={{ justifyContent: 'center', gap: 14, marginTop: 8 }}>
        <span>Total {zone(() => true)}</span>
        <span>Près du cercle {zone((s) => Math.hypot(s.u, s.v) < 2.6)}</span>
        <span>Mi-distance {zone((s) => Math.hypot(s.u, s.v) >= 2.6 && s.type !== 'three')}</span>
        <span>3 pts {threes.length ? zone((s) => s.type === 'three') : '—'}</span>
      </div>
      {shots.length === 0 && <p className="small muted" style={{ textAlign: 'center' }}>Jouez ou simulez des matchs pour remplir la carte.</p>}
    </div>
  );
}

function WellnessChart({ data }: { data: { fatigue: number; morale: number; confidence: number }[] }) {
  if (data.length < 2) return <p className="small muted">Les courbes apparaissent après quelques semaines.</p>;
  const d = data.slice(-30);
  const W = 420;
  const H = 130;
  const line = (k: 'fatigue' | 'morale' | 'confidence') => d.map((p, i) => `${i ? 'L' : 'M'}${((i / (d.length - 1)) * (W - 20) + 10).toFixed(1)} ${(H - 12 - (p[k] / 100) * (H - 24)).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Évolution de la fatigue, du moral et de la confiance">
        {[25, 50, 75].map((v) => (
          <line key={v} x1="10" x2={W - 10} y1={H - 12 - (v / 100) * (H - 24)} y2={H - 12 - (v / 100) * (H - 24)} stroke="var(--line)" />
        ))}
        <path d={line('fatigue')} fill="none" stroke="#e5484d" strokeWidth="2" />
        <path d={line('morale')} fill="none" stroke="#28B78B" strokeWidth="2" />
        <path d={line('confidence')} fill="none" stroke="#DDB65A" strokeWidth="2" />
      </svg>
      <div className="row small" style={{ gap: 14 }}>
        <span style={{ color: '#ff8d90' }}>■ Fatigue</span>
        <span style={{ color: '#5fe0b5' }}>■ Moral</span>
        <span style={{ color: 'var(--gold)' }}>■ Confiance</span>
      </div>
    </div>
  );
}

function GameLog({ c }: { c: Career }) {
  const u = user(c);
  const teams = new Set([u.clubId]);
  const rows = c.world.fixtures.filter((f) => f.userLine).sort((a, b) => b.week - a.week);
  if (!rows.length) return <p className="small muted">Aucun match disputé cette saison.</p>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>Sem.</th>
            <th>Compétition</th>
            <th>Adversaire</th>
            <th className="r">Score</th>
            <th className="r">Min</th>
            <th className="r">Pts</th>
            <th className="r">Rbd</th>
            <th className="r">Pd</th>
            <th className="r">Tirs</th>
            <th className="r">3 pts</th>
            <th className="r">+/-</th>
            <th className="r">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const l = f.userLine!;
            const home = teams.has(f.home) || c.world.clubs[f.home]?.roster.includes(u.id);
            const opp = c.world.clubs[home ? f.away : f.home];
            const us = home ? f.hs : f.as;
            const them = home ? f.as : f.hs;
            return (
              <tr key={f.id}>
                <td>{f.week}</td>
                <td>{fixtureName(c, f)}</td>
                <td>
                  {home ? 'vs' : '@'} {opp?.name ?? '—'}
                </td>
                <td className="r" style={{ color: us > them ? 'var(--green)' : '#ff8d90' }}>
                  {us > them ? 'V' : 'D'} {us}-{them}
                </td>
                <td className="r">{l.min || 'NJ'}</td>
                <td className="r">
                  <b>{l.pts}</b>
                </td>
                <td className="r">{l.reb}</td>
                <td className="r">{l.ast}</td>
                <td className="r">
                  {l.fgm}/{l.fga}
                </td>
                <td className="r">
                  {l.tpm}/{l.tpa}
                </td>
                <td className="r">{l.pm > 0 ? `+${l.pm}` : l.pm}</td>
                <td className="r">{l.min ? l.rating.toFixed(1) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { fullName };
