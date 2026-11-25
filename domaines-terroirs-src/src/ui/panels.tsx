import { useState, type ComponentType } from 'react';
import { ACTIVITIES, BUILDINGS, CATEGORIES, CROPS, LIVESTOCK, LOT_SIZE, ORCHARDS, RESOURCES, RES_IDS, ROLES, type Activity, type BuildCategory, type Res, type Role } from '../data/content';
import { aptitude, regionBuildings } from '../data/regions';
import { lotsPerRow } from '../world/terrain';
import { VOIES, canBuyLot, buyLot, createOrder, setPrice, type Voie } from '../sim/actions';
import { ASSURANCES, premium, type Assurance } from '../sim/hazards';
import { CAMPAIGNS, LABELS, LOANS, borrow, buyLabel, labelActive, launchCampaign, marketOf, priceBonus, recipeCost, visitorMult, wholesaleOf } from '../sim/economy';
import { defOf } from '../sim/geom';
import { productOf, round2, type Sim } from '../sim/sim';
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

function Bilan({ sim }: PanelProps) {
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
  const allowed = regionBuildings(sim.region);
  const [cat, setCat] = useState<BuildCategory>('cultures');
  const list = Object.values(BUILDINGS).filter((b) => b.constructible && allowed.has(b.id) && b.categorie === cat);
  return (
    <div>
      <div className="tool-row">
        {(Object.keys(VOIES) as Voie[]).map((v) => (
          <button key={v} className="btn small" onClick={() => onTool({ kind: 'chemin', voie: v })} data-testid={'outil-' + v} title={VOIES[v].desc}>
            <Icon name="path" size={18} /> {VOIES[v].nom} ({eur(VOIES[v].cout)})
          </button>
        ))}
        <button className="btn small" onClick={() => onTool({ kind: 'demolir' })}>
          <Icon name="trash" size={18} /> Démolir
        </button>
      </div>
      <div className="tabs" role="tablist">
        {(Object.keys(CATEGORIES) as BuildCategory[]).map((c) => (
          <button key={c} role="tab" className={c === cat ? 'on' : ''} aria-selected={c === cat} onClick={() => setCat(c)} data-testid={'categorie-' + c}>
            {CATEGORIES[c]}
          </button>
        ))}
      </div>
      <ul className="cards">
        {list.map((b) => {
          const afford = sim.s.money >= b.cout;
          const key = b.crop ?? b.orchard ?? b.livestock;
          const apt = key ? aptitude(sim.region, key) : 1;
          return (
            <li key={b.id}>
              <button className="card-btn" disabled={!afford} onClick={() => onTool({ kind: 'build', type: b.id, rot: 0, x: -99, y: -99, placed: false })} data-testid={'construire-' + b.id}>
                <div className="card-top">
                  <b>{b.nom}</b>
                  <span className="price">{eur(b.cout)}</span>
                </div>
                <small>{b.desc}</small>
                {b.recettes && (
                  <small className="muted">
                    {b.recettes.map((r) => `${r.inQty} ${RESOURCES[r.input].unite} ${RESOURCES[r.input].nom.toLowerCase()} → ${r.outQty} ${RESOURCES[r.output].nom.toLowerCase()}`).join(' · ')}
                  </small>
                )}
                <small className="muted">
                  {b.size}×{b.size} cases · entretien {eur(b.entretien)}/jour{b.capacite ? ` · capacité ${b.capacite}` : ''}
                  {apt !== 1 ? ` · aptitude régionale ${apt > 1 ? '+' : ''}${Math.round((apt - 1) * 100)} %` : ''}
                </small>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="muted">Rien dans cette catégorie pour cette région.</li>}
      </ul>
      <p className="muted">Porte (ou barrière de parcelle) sur un chemin, une route ou la cour. Défrichage 35 €/arbre ; les terrains en pente sont terrassés (coût affiché au placement).</p>
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
  const prod = productOf(b);
  switch (d.kind) {
    case 'verger': {
      const o = ORCHARDS[d.orchard!];
      return `${Math.floor(b.ready)} ${RESOURCES[o.produit].unite} de ${RESOURCES[o.produit].nom.toLowerCase()} prêts (max ${o.cap})${b.priority ? ' · prioritaire' : ''}`;
    }
    case 'enclos': {
      const l = LIVESTOCK[d.livestock!];
      const n = sim.s.animals.filter((a) => a.pen === b.id).length;
      if (!l.produit) return `${n} animaux · ${l.visite ? `${l.visite.nom} : ${l.visite.prix} € par visiteur` : 'agrément du domaine'}`;
      const head = l.abri === 'etang' ? 'Étang empoissonné' : `${n} ${l.animal === 'ruche' ? 'ruches' : 'animaux'}`;
      return `${head} · ${b.ready.toFixed(1)} ${RESOURCES[l.produit].unite} de ${RESOURCES[l.produit].nom.toLowerCase()} à collecter${l.visite ? ` · ${l.visite.nom} ${l.visite.prix} €` : ''}${b.priority ? ' · prioritaire' : ''}`;
    }
    case 'champ': {
      const c = CROPS[d.crop!];
      const left = 16 - b.done.length;
      if (b.phase === 'mur') return `Récolte : ${Math.round(b.ready)} ${RESOURCES[c.produit].unite} (${left} cases restantes)`;
      if (b.phase === 'labour') return `À labourer (${left} cases)`;
      if (b.phase === 'epandage') return `Épandage du fumier (${left} cases, +15 % de récolte)`;
      if (b.phase === 'semis') return `À semer (${left} cases)`;
      return `Pousse : ${Math.round(b.growth * 100)} % (récolte ≈ ${Math.round(c.rendement * aptitude(sim.region, c.id) * (1 + (b.bonus ?? 0)))} ${RESOURCES[prod!].unite})${b.bonus ? ` · bonus +${Math.round(b.bonus * 100)} %` : ''}${b.treated ? ' · traitée' : ''}`;
    }
    case 'atelier':
      return `${busy ? `${busy.nom} : ${busy.label.toLowerCase()}` : 'Libre'} · ${b.batches} lot(s) · ` + d.recettes!.map((r) => `${RESOURCES[r.input].nom.toLowerCase()} en stock : ${Math.floor(sim.stockOf(r.input))}`).join(', ');
    case 'boutique':
      return `${busy ? `Tenue par ${busy.nom}` : 'Caisse inoccupée'} · rayons ${Math.round(sim.used(b))}/${d.capacite}`;
    case 'hangar':
    case 'remise': {
      const t = sim.s.vehicles.find((v) => v.home === b.id);
      return t ? (t.driver != null ? `${t.label} en service` : `${t.label} au garage`) : 'Sans engin';
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

function Ventes({ sim, game }: PanelProps) {
  const s = sim.s;
  const shop = s.buildings.find((b) => defOf(b).kind === 'boutique');
  const [res, setRes] = useState<Res>(() => RES_IDS.find((r) => sim.stockOf(r) > 0) ?? 'jus');
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
          {RES_IDS.filter((r) => RESOURCES[r].boutique && (sim.stockOf(r) > 0 || (shop?.inv[r] ?? 0) > 0 || (s.stats.sold[r] ?? 0) > 0 || (s.stats.produced[r] ?? 0) > 0 || (s.stats.harvested[r] ?? 0) > 0)).map((r) => (
            <tr key={r}>
              <td>
                {RESOURCES[r].nom}
                <small className="muted"> /{RESOURCES[r].unite}</small>
              </td>
              <td className="price-cell">
                <button className="mini" aria-label="Baisser" onClick={() => (setPrice(sim, r, s.prices[r] - 0.1), game.notify())}>
                  −
                </button>
                {/* prix libre : saisie directe */}
                <input
                  className={'price-input ' + (s.prices[r] > RESOURCES[r].prix * 1.15 * priceBonus(s) ? 'neg' : s.prices[r] < RESOURCES[r].prix * 0.9 ? 'pos' : '')}
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={s.prices[r]}
                  onChange={(e) => (setPrice(sim, r, +e.target.value || s.prices[r]), game.notify())}
                  aria-label={'Prix ' + RESOURCES[r].nom}
                />
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
      <p className="muted">Prix libres (de 20 % à 5 fois le prix de référence). Chaque visiteur a un prix maximum, plus élevé avec un label : trop cher, il n'achète pas. En rouge : au-dessus de ce que la plupart accepteront.</p>
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
      <h3>Contrats négociant (surplus vendus chaque matin)</h3>
      <label className="row">
        <span>Attendre un cours ≥ 100 % avant de vendre (sauf stocks débordants)</span>
        <input type="checkbox" checked={s.waitMarket} onChange={(e) => ((s.waitMarket = e.target.checked), game.notify())} />
      </label>
      <table className="table">
        <tbody>
          {RES_IDS.filter((r) => sim.stockOf(r) > 0 || (s.stats.harvested[r] ?? 0) > 0 || (s.stats.produced[r] ?? 0) > 0).map((r) => (
            <tr key={r}>
              <td>{RESOURCES[r].nom}</td>
              <td className="price-cell">
                <button className="mini" aria-label="Seuil plus bas" onClick={() => ((s.autoSell[r] = s.autoSell[r] === -2 ? Math.max(0, sim.sellThreshold(r) - 50) : s.autoSell[r] === -1 ? -2 : Math.max(0, s.autoSell[r] - 50)), game.notify())}>
                  −
                </button>
                <span>{s.autoSell[r] === -1 ? 'désactivé' : s.autoSell[r] === -2 ? `auto (au-delà de ${sim.sellThreshold(r)})` : `au-delà de ${s.autoSell[r]}`}</span>
                <button className="mini" aria-label="Seuil plus haut" onClick={() => ((s.autoSell[r] = s.autoSell[r] === -2 ? sim.sellThreshold(r) + 50 : s.autoSell[r] === -1 ? -2 : s.autoSell[r] >= 950 ? -1 : s.autoSell[r] + 50), game.notify())}>
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Négociant (vente en gros ponctuelle)</h3>
      <div className="wholesale">
        <select value={res} onChange={(e) => setRes(e.target.value as Res)} aria-label="Produit">
          {RES_IDS.filter((r) => sim.stockOf(r) > 0 || r === res).map((r) => (
            <option key={r} value={r}>
              {RESOURCES[r].nom} — {eur(wholesaleOf(s, r), 2)}/{RESOURCES[r].unite}
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
          Vendre {eur(n * wholesaleOf(s, res))}
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
  const per = lotsPerRow(W);
  const [msg, setMsg] = useState('');
  // fenêtre de 9×9 lots centrée sur le domaine
  const ownedIdx = W.owned.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
  const cx = Math.round(ownedIdx.reduce((a, i) => a + (i % per), 0) / ownedIdx.length), cy = Math.round(ownedIdx.reduce((a, i) => a + Math.floor(i / per), 0) / ownedIdx.length);
  const x0 = Math.max(0, Math.min(per - 9, cx - 4)), y0 = Math.max(0, Math.min(per - 9, cy - 4));
  const shown: number[] = [];
  for (let y = y0; y < y0 + 9; y++) for (let x = x0; x < x0 + 9; x++) shown.push(y * per + x);
  return (
    <div>
      <p>Le domaine compte {W.owned.filter(Boolean).length} lots de {LOT_SIZE}×{LOT_SIZE} cases. Achetez des lots contigus pour vous agrandir.</p>
      <div className="lots" style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}>
        {shown.map((i) => {
          const o = W.owned[i];
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
      <p className="muted">Grille vue de dessus autour du domaine (la carte compte {per}×{per} lots). Les limites s'affichent sur la carte tant que ce panneau est ouvert.</p>
      {msg && <p>{msg}</p>}
    </div>
  );
}

function Tabs<T extends string>({ tabs, cur, set }: { tabs: [T, string][]; cur: T; set: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, nom]) => (
        <button key={id} className={cur === id ? 'on' : ''} onClick={() => set(id)} data-testid={'sous-onglet-' + id}>
          {nom}
        </button>
      ))}
    </div>
  );
}

function Gestion(p: PanelProps) {
  const [t, setT] = useState<'bilan' | 'calculs' | 'finances'>('bilan');
  return (
    <div>
      <Tabs tabs={[['bilan', 'Bilan'], ['calculs', 'Calculs de rentabilité'], ['finances', 'Banque & assurances']]} cur={t} set={setT} />
      {t === 'bilan' ? <Bilan {...p} /> : t === 'calculs' ? <Calculs {...p} /> : <Finances {...p} />}
    </div>
  );
}

function Commerce(p: PanelProps) {
  const [t, setT] = useState<'ventes' | 'marche' | 'com'>('ventes');
  return (
    <div>
      <Tabs tabs={[['ventes', 'Prix & ventes'], ['marche', 'Cours du marché'], ['com', 'Communication & labels']]} cur={t} set={setT} />
      {t === 'ventes' ? <Ventes {...p} /> : t === 'marche' ? <Marche {...p} /> : <Communication {...p} />}
    </div>
  );
}

/** Coût de revient et marge de chaque recette d'atelier, et calculatrice de vente. */
function Calculs({ sim }: PanelProps) {
  const s = sim.s;
  const ateliers = Object.values(BUILDINGS).filter((b) => b.recettes && regionBuildings(sim.region).has(b.id));
  const [res, setRes] = useState<Res>(() => RES_IDS.find((r) => RESOURCES[r].boutique) ?? 'jus');
  const [q, setQ] = useState(100);
  const [prix, setPrix] = useState(() => s.prices[res]);
  return (
    <div>
      <h3>Marges des ateliers (par unité produite)</h3>
      <p className="muted">Coût de revient = matière première au prix du négociant + consommables, sans la main-d'œuvre.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Revient</th>
            <th>Boutique</th>
            <th>Marge</th>
          </tr>
        </thead>
        <tbody>
          {ateliers.flatMap((b) =>
            b.recettes!.map((r, i) => {
              const cost = recipeCost(s, r.input, r.inQty, r.outQty, r.consommables);
              const sale = s.prices[r.output];
              const m = sale - cost;
              return (
                <tr key={b.id + i}>
                  <td>
                    {RESOURCES[r.output].nom}
                    <small className="muted"> ({b.nom.toLowerCase()}, {r.inQty} {RESOURCES[r.input].nom.toLowerCase()})</small>
                  </td>
                  <td>{eur(cost, 2)}</td>
                  <td>{eur(sale, 2)}</td>
                  <td className={m < 0 ? 'neg' : 'pos'}>{Math.round((m / Math.max(0.01, sale)) * 100)} %</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
      <h3>Calculatrice de vente</h3>
      <div className="wholesale">
        <select value={res} onChange={(e) => (setRes(e.target.value as Res), setPrix(s.prices[e.target.value as Res]))} aria-label="Produit à calculer">
          {RES_IDS.map((r) => (
            <option key={r} value={r}>
              {RESOURCES[r].nom}
            </option>
          ))}
        </select>
        <input type="number" min={1} value={q} onChange={(e) => setQ(Math.max(1, +e.target.value || 1))} aria-label="Quantité" />
        <input type="number" step="0.1" min={0} value={prix} onChange={(e) => setPrix(+e.target.value || 0)} aria-label="Prix unitaire" />
      </div>
      <ul className="lines">
        <li>
          <span>Vente au prix choisi</span>
          <b>{eur(q * prix)}</b>
        </li>
        <li>
          <span>Même quantité au négociant (cours du jour)</span>
          <b>{eur(q * wholesaleOf(s, res))}</b>
        </li>
        <li>
          <span>Stock actuel</span>
          <b>{qty(res, sim.stockOf(res))}</b>
        </li>
      </ul>
    </div>
  );
}

function Finances({ sim, game }: PanelProps) {
  const s = sim.s;
  const [msg, setMsg] = useState('');
  const lots = s.world.owned.filter(Boolean).length;
  const elevages = s.buildings.filter((b) => defOf(b).livestock).length;
  return (
    <div>
      <h3>Emprunts bancaires</h3>
      <ul className="cards">
        {LOANS.map((o, i) => (
          <li key={i} className="row">
            <span>
              <b>{eur(o.montant)}</b> remboursés en {o.jours} jours <small className="muted">(coût total {Math.round(o.taux * 100)} %, {eur((o.montant * (1 + o.taux)) / o.jours, 2)}/jour)</small>
            </span>
            <button className="btn small" onClick={() => (setMsg(borrow(sim, i) ?? 'Prêt accordé.'), game.notify())} data-testid={'emprunt-' + i}>
              Emprunter
            </button>
          </li>
        ))}
      </ul>
      {msg && <p className="muted">{msg}</p>}
      {s.loans.length > 0 && (
        <ul className="lines">
          {s.loans.map((l) => (
            <li key={l.id}>
              <span>{l.nom}</span>
              <b>
                {eur(l.daily, 2)}/jour · {l.left} j
              </b>
            </li>
          ))}
        </ul>
      )}
      <h3>Assurances</h3>
      <p className="muted">Grêle, gel, sécheresse, maladies, pannes et tempêtes arrivent sans prévenir. Une assurance rembourse 80 % des pertes contre une prime quotidienne.</p>
      <ul className="cards">
        {(Object.keys(ASSURANCES) as Assurance[]).map((a) => (
          <li key={a} className="row">
            <span>
              <b>{ASSURANCES[a].nom}</b> — {eur(premium(s, a), 2)}/jour
              <br />
              <small className="muted">{ASSURANCES[a].desc}</small>
            </span>
            <input type="checkbox" checked={!!s.insurance[a]} onChange={(e) => ((s.insurance[a] = e.target.checked), game.notify())} aria-label={ASSURANCES[a].nom} data-testid={'assurance-' + a} />
          </li>
        ))}
      </ul>
      <h3>Aides de la PAC</h3>
      <p>
        Versées au début de chaque saison : {eur(140)} par lot de terrain ({lots}), {eur(35)} par élevage ({elevages}){labelActive(s, 'bio') ? ', + 400 € (bio)' : ''}. Prochain versement estimé :{' '}
        <b>{eur(140 * lots + 35 * elevages + (labelActive(s, 'bio') ? 400 : 0))}</b>.
      </p>
    </div>
  );
}

function Marche({ sim }: PanelProps) {
  const s = sim.s;
  const list = RES_IDS.filter((r) => sim.stockOf(r) > 0 || (s.stats.harvested[r] ?? 0) + (s.stats.produced[r] ?? 0) > 0);
  return (
    <div>
      <p className="muted">Les cours varient chaque jour (saisons, abondance, crises). Vendez au négociant quand le cours est haut ; l'option « attendre un cours ≥ 100 % » des contrats le fait pour vous.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Cours</th>
            <th>Négociant</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {(list.length ? list : RES_IDS.slice(0, 12)).map((r) => {
            const m = marketOf(s, r);
            return (
              <tr key={r}>
                <td>{RESOURCES[r].nom}</td>
                <td className={m >= 1.05 ? 'pos' : m <= 0.95 ? 'neg' : ''}>
                  {m >= 1.05 ? '▲' : m <= 0.95 ? '▼' : '='} {Math.round(m * 100)} %
                </td>
                <td>
                  {eur(wholesaleOf(s, r), 2)}
                  <small className="muted">/{RESOURCES[r].unite}</small>
                </td>
                <td>{Math.floor(sim.stockOf(r))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Communication({ sim, game }: PanelProps) {
  const s = sim.s;
  const [msg, setMsg] = useState('');
  const active = s.campaigns.filter((c) => s.minute < c.until);
  return (
    <div>
      <div className="kpis">
        <div>
          <small>Réputation</small>
          <b>{Math.round(s.reputation)}/100</b>
        </div>
        <div>
          <small>Fréquentation</small>
          <b>×{visitorMult(sim).toFixed(2)}</b>
        </div>
        <div>
          <small>Prix acceptés</small>
          <b>×{priceBonus(s).toFixed(2)}</b>
        </div>
      </div>
      <h3>Campagnes de communication</h3>
      <ul className="cards">
        {Object.entries(CAMPAIGNS).map(([id, c]) => {
          const on = active.find((x) => x.id === id);
          return (
            <li key={id} className="row">
              <span>
                <b>{c.nom}</b> — {eur(c.cout)}
                <br />
                <small className="muted">
                  {c.desc} {c.jours > 0 ? `Fréquentation ×${c.visiteurs} pendant ${c.jours} j.` : ''} {c.reputation ? `Réputation +${c.reputation}.` : ''} {c.minRep ? `(réputation ${c.minRep} requise)` : ''}
                </small>
              </span>
              <button className="btn small" disabled={!!on} onClick={() => (setMsg(launchCampaign(sim, id) ?? ''), game.notify())} data-testid={'campagne-' + id}>
                {on ? `en cours (${Math.ceil((on.until - s.minute) / 1440)} j)` : 'Lancer'}
              </button>
            </li>
          );
        })}
      </ul>
      {msg && <p className="neg">{msg}</p>}
      <h3>Labels et réseaux</h3>
      <ul className="cards">
        {Object.entries(LABELS).map(([id, l]) => {
          const since = s.labels[id];
          return (
            <li key={id} className="row">
              <span>
                <b>{l.nom}</b> — {eur(l.cout)} puis {eur(l.quotidien)}/jour
                <br />
                <small className="muted">{l.desc}</small>
              </span>
              <button className="btn small" disabled={since != null} onClick={() => (setMsg(buyLabel(sim, id) ?? ''), game.notify())} data-testid={'label-' + id}>
                {since == null ? 'S\'engager' : s.minute >= since ? 'obtenu' : `dans ${Math.ceil((since - s.minute) / 1440)} j`}
              </button>
            </li>
          );
        })}
      </ul>
      <h3>Revue de presse</h3>
      {s.press.length === 0 && <p className="muted">Aucun article pour l'instant : la réputation et les campagnes attirent les journalistes.</p>}
      <ul className="events">
        {[...s.press].reverse().map((a, i) => (
          <li key={i} className={a.bon ? 'succes' : 'alerte'}>
            <b>{a.journal}</b> : « {a.titre} »
          </li>
        ))}
      </ul>
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
  const rs = d.recettes ?? [];
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
      {rs.map((r, i) => (
        <p className="muted" key={i}>
          {r.inQty} {RESOURCES[r.input].unite} de {RESOURCES[r.input].nom.toLowerCase()} → {r.outQty} {RESOURCES[r.output].nom.toLowerCase()} en {r.minutes} min · {eur(r.consommables, 2)} de {r.consoLabel}.
        </p>
      ))}
      {d.kind === 'enclos' && <p className="muted">Soins et collecte par un éleveur ; entretien (nourriture, soins) inclus.</p>}
      {d.kind === 'champ' && <p className="muted">Labour et semis au tracteur s'il y a un hangar ; {CROPS[d.crop!].recolte === 'moissonneuse' ? 'moisson à la moissonneuse-batteuse (remise)' : CROPS[d.crop!].recolte === 'tracteur' ? 'arrachage au tracteur' : 'récolte à la main'}, sinon à la main.</p>}
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
