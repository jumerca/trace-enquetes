import { useState, type ComponentType } from 'react';
import { ACTIVITIES, BUILDINGS, GOATS_PER_PEN, LOT_SIZE, ORCHARD_CAP, PATH_COST, PEN_MILK_CAP, RESOURCES, RES_IDS, ROLES, WHEAT_YIELD, type Activity, type Res, type Role } from '../data/content';
import { canBuyLot, buyLot, createOrder, setPrice, wholesalePrice } from '../sim/actions';
import { defOf } from '../sim/geom';
import { round2, type Sim } from '../sim/sim';
import type { Building } from '../sim/state';
import type { Game } from '../game';
import { Icon } from './icons';
import { eur, type Tool } from './GameScreen';

export type PanelId = 'gestion' | 'construire' | 'production' | 'personnel' | 'commerce' | 'territoire';
interface PanelProps {
  sim: Sim;
  game: Game;
  onTool: (t: Tool) => void;
  onSelect: (id: number) => void;
}

const qty = (r: Res, q: number) => `${round2(q).toLocaleString('fr-FR')} ${RESOURCES[r].unite}${q >= 2 && RESOURCES[r].unite.length > 2 ? 's' : ''}`;

function Gestion({ sim }: PanelProps) {
  const s = sim.s;
  const days = s.ledger.slice(-8);
  const cur = days[days.length - 1];
  const prev = days.length > 1 ? days[days.length - 2] : null;
  const sum = (o: Partial<Record<Activity, number>>) => Object.values(o).reduce((a, b) => a + (b ?? 0), 0);
  const week = (Object.keys(ACTIVITIES) as Activity[]).map((a) => {
    const rev = days.slice(0, -1).reduce((t, d) => t + (d.rev[a] ?? 0), 0);
    const cost = days.slice(0, -1).reduce((t, d) => t + (d.cost[a] ?? 0), 0);
    return { a, rev, cost, net: rev - cost };
  });
  const [detail, setDetail] = useState(false);
  return (
    <div>
      <div className="kpis">
        <div>
          <small>Trésorerie</small>
          <b className={s.money < 0 ? 'neg' : ''}>{eur(s.money)}</b>
        </div>
        <div>
          <small>Réputation</small>
          <b>{Math.round(s.reputation)}/100</b>
        </div>
        <div>
          <small>Satisfaction</small>
          <b>{s.satisfaction}/100</b>
        </div>
        <div>
          <small>Visiteurs (total)</small>
          <b>{s.stats.visitors}</b>
        </div>
      </div>
      <h3>Rentabilité par activité <small className="muted">({days.length - 1} dernier(s) jour(s) complet(s))</small></h3>
      {days.length < 2 && <p className="muted">Le premier bilan apparaîtra à minuit (salaires et entretien sont imputés en fin de journée).</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Activité</th>
            <th>Recettes</th>
            <th>Charges</th>
            <th>Marge</th>
          </tr>
        </thead>
        <tbody>
          {week.map((r) => (
            <tr key={r.a}>
              <td>{ACTIVITIES[r.a]}</td>
              <td>{eur(r.rev)}</td>
              <td>{eur(r.cost)}</td>
              <td className={r.net < 0 ? 'neg' : 'pos'}>{eur(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Les salaires sont ventilés au prorata du temps passé par chaque employé sur chaque activité. Les investissements (constructions, terrains, chemins) sont suivis à part.</p>
      <div className="row">
        <span>Aujourd'hui (en cours)</span>
        <b>
          {eur(cur ? sum(cur.rev) : 0)} − {eur(cur ? sum(cur.cost) : 0)}
        </b>
      </div>
      {prev && (
        <>
          <div className="row">
            <span>Hier : résultat d'exploitation</span>
            <b className={sum(prev.rev) - sum(prev.cost) < 0 ? 'neg' : 'pos'}>{eur(sum(prev.rev) - sum(prev.cost))}</b>
          </div>
          <div className="row">
            <span>Hier : investissements</span>
            <b>{eur(prev.invest)}</b>
          </div>
          <button className="btn small" onClick={() => setDetail(!detail)}>
            {detail ? 'Masquer' : 'Voir'} le détail d'hier
          </button>
          {detail && (
            <ul className="lines">
              {[...prev.lines].sort((a, b) => a.amount - b.amount).map((l, i) => (
                <li key={i}>
                  <span>{l.label}</span>
                  <b className={l.amount < 0 ? 'neg' : 'pos'}>{eur(l.amount, 2)}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <h3>Journal</h3>
      <ul className="events">
        {[...s.events].reverse().slice(0, 12).map((e, i) => (
          <li key={i} className={e.kind}>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Construire({ sim, onTool }: PanelProps) {
  const list = Object.values(BUILDINGS).filter((b) => b.constructible);
  return (
    <div>
      <div className="tool-row">
        <button className="btn" onClick={() => onTool({ kind: 'chemin' })} data-testid="outil-chemin">
          <Icon name="path" size={18} /> Chemin ({eur(PATH_COST)}/case)
        </button>
        <button className="btn" onClick={() => onTool({ kind: 'demolir' })}>
          <Icon name="trash" size={18} /> Démolir
        </button>
      </div>
      <p className="muted">Chaque bâtiment doit avoir sa porte (ou sa barrière, pour une parcelle) sur un chemin, une route ou la cour. Les arbres sur l'emprise sont défrichés (35 € l'arbre).</p>
      <ul className="cards">
        {list.map((b) => {
          const r = b.recette;
          const afford = sim.s.money >= b.cout;
          return (
            <li key={b.id}>
              <button className="card-btn" disabled={!afford} onClick={() => onTool({ kind: 'build', type: b.id, rot: 0, x: -99, y: -99, placed: false })} data-testid={'construire-' + b.id}>
                <div className="card-top">
                  <b>{b.nom}</b>
                  <span className="price">{eur(b.cout)}</span>
                </div>
                <small>{b.desc}</small>
                <small className="muted">
                  {b.size}×{b.size} cases · entretien {eur(b.entretien)}/jour
                  {r ? ` · ${r.inQty} ${RESOURCES[r.input].unite} ${RESOURCES[r.input].nom.toLowerCase()} → ${r.outQty} ${RESOURCES[r.output].nom.toLowerCase()} en ${r.minutes} min` : ''}
                  {b.capacite ? ` · capacité ${b.capacite}` : ''}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Production({ sim, onSelect }: PanelProps) {
  const B = sim.s.buildings;
  const storages = sim.storages();
  return (
    <div>
      <h3>Stocks</h3>
      {storages.map((g) => (
        <div key={g.id} className="stock">
          <div className="row">
            <span>
              {defOf(g).nom} n°{g.id}
            </span>
            <b>
              {Math.round(sim.used(g))}/{defOf(g).capacite}
            </b>
          </div>
          <div className="bar">
            <i style={{ width: `${(100 * sim.used(g)) / defOf(g).capacite!}%` }} />
          </div>
          <div className="chips">
            {RES_IDS.filter((r) => (g.inv[r] ?? 0) > 0).map((r) => (
              <span key={r} className="chip">
                {RESOURCES[r].nom} : {qty(r, g.inv[r]!)}
              </span>
            ))}
            {!RES_IDS.some((r) => (g.inv[r] ?? 0) > 0) && <span className="muted">Vide</span>}
          </div>
        </div>
      ))}
      <h3>Exploitation</h3>
      <ul className="prod">
        {B.filter((b) => defOf(b).kind !== 'maison' && defOf(b).kind !== 'stock').map((b) => (
          <li key={b.id}>
            <button className="linkish" onClick={() => onSelect(b.id)}>
              <b>{defOf(b).nom}</b>
              <small>{statusLine(sim, b)}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function statusLine(sim: Sim, b: Building): string {
  const d = defOf(b);
  const busy = b.busyBy != null ? sim.s.workers.find((w) => w.id === b.busyBy) : null;
  switch (d.kind) {
    case 'verger':
      return `${Math.floor(b.ready)} kg de pommes mûres sur ${ORCHARD_CAP}${b.priority ? ' · prioritaire' : ''}`;
    case 'enclos':
      return `${sim.s.animals.filter((a) => a.pen === b.id).length} chèvres · ${b.ready.toFixed(1)} L à traire (max ${PEN_MILK_CAP})${b.priority ? ' · prioritaire' : ''}`;
    case 'champ':
      return b.ready > 0 ? `Blé mûr : ${Math.round(b.ready)} kg à moissonner` : `Croissance ${Math.round(b.growth * 100)} % (récolte ≈ ${WHEAT_YIELD} kg)`;
    case 'atelier': {
      const r = d.recette!;
      return `${busy ? `${busy.nom} : ${busy.label.toLowerCase()}` : 'Libre'} · ${b.batches} lot(s) produits · intrant en stock : ${qty(r.input, sim.stockOf(r.input))}`;
    }
    case 'boutique':
      return `${busy ? `Tenue par ${busy.nom}` : 'Caisse inoccupée'} · rayons ${Math.round(sim.used(b))}/${d.capacite}`;
    case 'hangar': {
      const t = sim.s.vehicles.find((v) => v.home === b.id);
      return t ? (t.driver != null ? 'Tracteur en service' : 'Tracteur au hangar') : 'Sans tracteur';
    }
    case 'accueil':
      return `Visite de la ferme : ${eur(sim.s.visitFee)} par visiteur`;
    default:
      return d.desc;
  }
}

function Personnel({ sim, game }: PanelProps) {
  const W = sim.s.workers;
  const payroll = W.reduce((a, w) => a + ROLES[w.role].salaire, 0);
  return (
    <div>
      <div className="row">
        <span>Masse salariale</span>
        <b>{eur(payroll)}/jour</b>
      </div>
      <ul className="staff">
        {W.map((w) => (
          <li key={w.id}>
            <div>
              <b>{w.nom}</b> <span className="muted">— {ROLES[w.role].nom}, {eur(ROLES[w.role].salaire)}/j</span>
              <small>
                {w.label || '—'}
                {w.carry ? ` · porte ${qty(w.carry.res, w.carry.qty)} de ${RESOURCES[w.carry.res].nom.toLowerCase()}` : ''}
              </small>
            </div>
            <button
              className="btn small"
              onClick={() => {
                if (confirm(`Licencier ${w.nom} ? Le salaire du jour est dû au prorata.`)) {
                  sim.fire(w.id);
                  game.notify();
                }
              }}
            >
              Licencier
            </button>
          </li>
        ))}
      </ul>
      <h3>Recruter</h3>
      <ul className="cards">
        {(Object.keys(ROLES) as Role[]).map((r) => (
          <li key={r}>
            <button
              className="card-btn"
              onClick={() => {
                sim.hire(r);
                game.notify();
              }}
              data-testid={'embaucher-' + r}
            >
              <div className="card-top">
                <b>{ROLES[r].nom}</b>
                <span className="price">{eur(ROLES[r].salaire)}/jour</span>
              </div>
              <small>{ROLES[r].desc}</small>
            </button>
          </li>
        ))}
      </ul>
      <p className="muted">Horaires : 7 h – 19 h. Le personnel rentre se reposer à la maison du domaine en dehors de ces heures.</p>
    </div>
  );
}

function Commerce({ sim, game }: PanelProps) {
  const s = sim.s;
  const shop = s.buildings.find((b) => defOf(b).kind === 'boutique');
  const [res, setRes] = useState<Res>('jus');
  const [n, setN] = useState(10);
  const stock = sim.stockOf(res);
  return (
    <div>
      <h3>Prix en boutique</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Prix</th>
            <th>Rayon</th>
            <th>Vendus</th>
          </tr>
        </thead>
        <tbody>
          {RES_IDS.filter((r) => RESOURCES[r].boutique).map((r) => (
            <tr key={r}>
              <td>
                {RESOURCES[r].nom}
                <small className="muted"> /{RESOURCES[r].unite}</small>
              </td>
              <td className="price-cell">
                <button className="mini" aria-label="Baisser" onClick={() => (setPrice(sim, r, s.prices[r] - 0.1), game.notify())}>
                  −
                </button>
                <span className={s.prices[r] > RESOURCES[r].prix * 1.15 ? 'neg' : s.prices[r] < RESOURCES[r].prix * 0.9 ? 'pos' : ''}>{eur(s.prices[r], 2)}</span>
                <button className="mini" aria-label="Augmenter" onClick={() => (setPrice(sim, r, s.prices[r] + 0.1), game.notify())}>
                  +
                </button>
              </td>
              <td>{Math.floor(shop?.inv[r] ?? 0)}</td>
              <td>{Math.floor(s.stats.sold[r] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Prix conseillés : jus {eur(RESOURCES.jus.prix, 2)}, tomme {eur(RESOURCES.fromage.prix, 2)}, pain {eur(RESOURCES.pain.prix, 2)}… Chaque visiteur a un prix maximum : trop cher, il n'achète pas.</p>
      {s.buildings.some((b) => defOf(b).kind === 'accueil') && (
        <div className="row">
          <span>Tarif de la visite</span>
          <span className="price-cell">
            <button className="mini" onClick={() => ((s.visitFee = Math.max(0, round2(s.visitFee - 0.5))), game.notify())}>
              −
            </button>
            {eur(s.visitFee, 2)}
            <button className="mini" onClick={() => ((s.visitFee = Math.min(15, round2(s.visitFee + 0.5))), game.notify())}>
              +
            </button>
          </span>
        </div>
      )}
      <h3>Négociant (vente en gros)</h3>
      <div className="wholesale">
        <select value={res} onChange={(e) => setRes(e.target.value as Res)} aria-label="Produit">
          {RES_IDS.map((r) => (
            <option key={r} value={r}>
              {RESOURCES[r].nom} — {eur(wholesalePrice(r), 2)}/{RESOURCES[r].unite}
            </option>
          ))}
        </select>
        <input type="number" min={1} max={Math.max(1, Math.floor(stock))} value={n} onChange={(e) => setN(Math.max(1, Math.floor(+e.target.value || 1)))} aria-label="Quantité" />
        <button
          className="btn small primary"
          disabled={stock < n}
          onClick={() => {
            if (createOrder(sim, res, n)) game.notify();
          }}
          data-testid="commander-negociant"
        >
          Vendre {eur(n * wholesalePrice(res))}
        </button>
      </div>
      <small className="muted">
        En stock : {qty(res, stock)}. La marchandise est réservée immédiatement ; la camionnette vient l'enlever à la grange et paie à l'enlèvement.
      </small>
      {s.orders.length > 0 && (
        <ul className="lines">
          {[...s.orders].reverse().map((o) => (
            <li key={o.id}>
              <span>
                {qty(o.res, o.qty)} de {RESOURCES[o.res].nom.toLowerCase()}
              </span>
              <b>{o.status}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Territoire({ sim, game }: PanelProps) {
  const W = sim.s.world;
  const per = Math.ceil(W.w / LOT_SIZE);
  const [msg, setMsg] = useState('');
  return (
    <div>
      <p>Le domaine compte {W.owned.filter(Boolean).length} lots de {LOT_SIZE}×{LOT_SIZE} cases. Achetez des lots contigus pour vous agrandir.</p>
      <div className="lots" style={{ gridTemplateColumns: `repeat(${per}, 1fr)` }}>
        {W.owned.map((o, i) => {
          const c = canBuyLot(sim, i);
          return (
            <button
              key={i}
              className={'lot' + (o ? ' owned' : c.ok ? ' buyable' : '')}
              disabled={o}
              title={o ? 'Acquis' : `${c.reason} — ${eur(c.cost)}`}
              onClick={() => {
                if (buyLot(sim, i)) {
                  setMsg('Lot acquis.');
                  game.notify();
                } else setMsg(c.reason);
              }}
            >
              {o ? '✓' : eur(c.cost)}
            </button>
          );
        })}
      </div>
      <p className="muted">La grille est vue de dessus (nord en haut à gauche de la carte isométrique). Les limites des lots s'affichent sur la carte tant que ce panneau est ouvert.</p>
      {msg && <p>{msg}</p>}
    </div>
  );
}

export const PANELS: Record<PanelId, { nom: string; icon: string; Body: ComponentType<PanelProps> }> = {
  gestion: { nom: 'Gestion', icon: 'chart', Body: Gestion },
  construire: { nom: 'Construire', icon: 'hammer', Body: Construire },
  production: { nom: 'Production', icon: 'wheat', Body: Production },
  personnel: { nom: 'Personnel', icon: 'people', Body: Personnel },
  commerce: { nom: 'Commerce', icon: 'cart', Body: Commerce },
  territoire: { nom: 'Territoire', icon: 'map', Body: Territoire },
};

export function BuildingCard({ b, sim, onClose, onPriority, onDemolish, demolishMode }: { b: Building; sim: Sim; onClose: () => void; onPriority: () => void; onDemolish: () => void; demolishMode: boolean }) {
  const d = defOf(b);
  const [confirmDel, setConfirmDel] = useState(demolishMode);
  const r = d.recette;
  const canPriority = ['verger', 'enclos', 'champ', 'atelier'].includes(d.kind);
  return (
    <aside className="bcard" data-testid="fiche-batiment">
      <header>
        <b>{d.nom}</b>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer la fiche">
          <Icon name="close" size={18} />
        </button>
      </header>
      <p className="status">{statusLine(sim, b)}</p>
      {r && (
        <p className="muted">
          Recette : {r.inQty} {RESOURCES[r.input].unite} de {RESOURCES[r.input].nom.toLowerCase()} → {r.outQty} {RESOURCES[r.output].nom.toLowerCase()} en {r.minutes} min · {eur(r.consommables, 2)} de {r.consoLabel} par lot.
        </p>
      )}
      {d.kind === 'enclos' && <p className="muted">{GOATS_PER_PEN} chèvres ; il faut un éleveur pour la traite et une fromagerie pour transformer le lait.</p>}
      {(d.kind === 'stock' || d.kind === 'boutique') && (
        <div className="chips">
          {RES_IDS.filter((x) => (b.inv[x] ?? 0) > 0).map((x) => (
            <span key={x} className="chip">
              {RESOURCES[x].nom} : {qty(x, b.inv[x]!)}
            </span>
          ))}
        </div>
      )}
      <p className="muted small">Entretien {eur(d.entretien)}/jour · imputé à « {ACTIVITIES[d.activite]} »</p>
      <div className="tool-row">
        {canPriority && (
          <button className={'btn small' + (b.priority ? ' primary' : '')} onClick={onPriority} data-testid="priorite">
            Priorité {b.priority ? 'activée' : ''}
          </button>
        )}
        {d.kind !== 'maison' &&
          (confirmDel ? (
            <button className="btn small danger" onClick={onDemolish}>
              Confirmer la démolition (+{eur(Math.round(d.cout * 0.3))})
            </button>
          ) : (
            <button className="btn small" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={16} /> Démolir
            </button>
          ))}
      </div>
    </aside>
  );
}
