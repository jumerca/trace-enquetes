// Équilibrage : un « joueur automatique » raisonnable joue 3 années (84 jours) dans chaque région.
// Lancement : EQUILIBRE=1 npx vitest run tests/equilibre.test.ts
import { describe, expect, it } from 'vitest';
import { newGame, Sim } from '../src/sim/sim';
import { build, checkBuild } from '../src/sim/actions';
import { BUILDINGS, CROPS, LIVESTOCK, ORCHARDS } from '../src/data/content';
import { REGIONS, regionBuildings } from '../src/data/regions';
import { buyLabel, launchCampaign } from '../src/sim/economy';

function spot(sim: Sim, type: string): [number, number, 0 | 1] | null {
  const [cx, cy] = sim.s.world.farm;
  for (let r = 0; r < 28; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const rot of [0, 1] as const) if (checkBuild(sim, type, cx + dx, cy + dy, rot).ok) return [cx + dx, cy + dy, rot];
      }
  return null;
}

/** Produits issus des bâtiments du domaine. */
function products(sim: Sim) {
  const out = new Set<string>();
  for (const b of sim.s.buildings) {
    const d = BUILDINGS[b.type];
    if (d.crop) out.add(CROPS[d.crop].produit);
    if (d.orchard) out.add(ORCHARDS[d.orchard].produit);
    if (d.livestock && LIVESTOCK[d.livestock].produit) out.add(LIVESTOCK[d.livestock].produit!);
  }
  return out;
}

export function bot(sim: Sim) {
  const s = sim.s;
  const r = sim.region;
  const allowed = regionBuildings(r);
  const plan = [
    r.depart.parcelle, 'accueil', 'champ_' + r.cultures[0], 'verger_' + r.vergers[0], 'elevage_' + r.elevages[0], 'gite', 'stand',
    'champ_' + r.cultures[1], 'auberge', 'cueillette', 'elevage_' + r.elevages[1], 'verger_' + r.vergers[1], 'magasin', 'musee', 'salle_reception', 'champ_' + r.cultures[2],
  ].filter((t) => allowed.has(t));
  s.insurance.recoltes = true;
  return () => {
    // un achat au plus par jour, en gardant une réserve
    const have = (t: string) => s.buildings.filter((b) => b.type === t).length;
    const prod = products(sim);
    const atelier = r.ateliers.find((a) => allowed.has(a) && !have(a) && BUILDINGS[a].recettes!.some((x) => prod.has(x.input)));
    const next = atelier ?? plan.find((t) => have(t) < (t === r.depart.parcelle ? 2 : 1));
    if (next && s.money > BUILDINGS[next].cout + 6000) {
      const p = spot(sim, next);
      if (p) build(sim, next, ...p);
    }
    // personnel selon les besoins
    const count = (role: string) => s.workers.filter((w) => w.role === role).length;
    const kinds = (k: string) => s.buildings.filter((b) => BUILDINGS[b.type].kind === k).length;
    const want: [string, number][] = [
      ['cultivateur', Math.ceil((kinds('champ') + kinds('verger')) / 3)],
      ['eleveur', Math.ceil(kinds('enclos') / 2)],
      ['artisan', kinds('atelier')],
      ['vendeur', kinds('boutique') ? 1 : 0],
      ['guide', kinds('accueil') + kinds('gite') > 1 ? 1 : 0],
    ];
    for (const [role, n] of want) if (count(role) < n && s.money > 4000) sim.hire(role as never);
    if (s.money > 14000 && s.labels.terroir == null) buyLabel(sim, 'terroir');
    if (s.money > 15000 && s.stats.visitors > 30 && !s.campaigns.some((c) => s.minute < c.until)) launchCampaign(sim, 'journal');
  };
}

describe.skipIf(!process.env.EQUILIBRE)('équilibre sur 3 années de jeu', () => {
  it('toutes les régions', () => {
    const rows: string[] = [];
    for (const reg of REGIONS)
      for (const seed of [3, 7]) {
        const sim = new Sim(newGame(seed, reg.id));
        const daily = bot(sim);
        const alea: Record<string, number> = {};
        const ev = sim.event.bind(sim);
        sim.event = (t: string, k?: 'info' | 'alerte' | 'succes') => {
          for (const w of ['grêle', 'Sécheresse', 'Gel', 'Maladie', 'Panne', 'Tempête', 'Palier']) if (t.includes(w)) alea[w] = (alea[w] ?? 0) + 1;
          ev(t, k);
        };
        const pts: number[] = [];
        let rouge = 0;
        for (let day = 0; day < 84; day++) {
          for (let m = 0; m < 1440; m++) {
            sim.tick();
            if (m === 8 * 60) daily();
          }
          if (sim.s.money < 0) rouge++;
          if (day % 14 === 13) pts.push(Math.round(sim.s.money / 1000));
        }
        rows.push(`${reg.id.padEnd(9)} graine ${seed} : trésorerie (k€) ${pts.join(' → ')} | bâtiments ${sim.s.buildings.length}, employés ${sim.s.workers.length}, recettes ${Math.round((sim.s.stats.revenue ?? 0) / 1000)} k€, palier ${sim.s.career.palier}, défis ${sim.s.career.defis.length}, jours dans le rouge ${rouge}, réputation ${Math.round(sim.s.reputation)} | ${JSON.stringify(alea)}`);
      }
    console.log(rows.join('\n'));
    expect(rows.length).toBe(16);
  }, 1_800_000);
});
