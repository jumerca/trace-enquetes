// Carte isométrique vivante de la ville : quartiers, bâtiments, lieux avec horaires,
// circulation, piétons, véhicules de police en mission et marqueurs d'affaires.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { hash2 } from '../core/rng';
import { calendar, daylight } from '../sim/calendar';
import { districtActivity, placeOpen, roadPath, T } from '../sim/city';
import type { DistrictId, GameState, Place } from '../sim/types';
import type { CharSpec } from './art';
import type { View } from './engine';
import { box, charTexture, iso, mix, poly, shadeN, TH, TW, vehTexture } from './iso';

export interface CityCallbacks { onCase(id: string): void; onPlace(id: string): void }

interface Mover { s: Sprite; path: number[]; i: number; t: number; speed: number; kind: 'car' | 'ped' | 'police'; caseId?: string; spec?: CharSpec; body?: string; vk?: string; done?: boolean; parked?: boolean }

const ROOF = { tuile: 0xb0583a, ardoise: 0x5a6470, zinc: 0x8a9298, plat: 0x7a7a76, bac: 0x9aa0a4 };

export class CityView implements View {
  root = new Container();
  lights = new Container();
  private ground = new Graphics();
  private objects = new Container();
  private markers = new Container();
  private labels = new Container();
  private movers: Mover[] = [];
  private sig = '';
  private roadSet = new Set<number>();
  private placeAt = new Map<number, Place>();
  private lastSpawn = 0;
  speed = 1;

  constructor(private get: () => GameState, private cb: CityCallbacks) {
    this.objects.sortableChildren = true;
    this.root.addChild(this.ground, this.objects, this.markers, this.labels);
  }

  bounds() {
    const st = this.get();
    const [l] = iso(0, st.city.h), [r] = iso(st.city.w, 0);
    const [, b] = iso(st.city.w, st.city.h);
    return { x: l, y: -80, w: r - l, h: b + 80 };
  }
  night() { const st = this.get(); return (1 - daylight(st.startYear, st.minute)) * 0.78; }
  outdoor() { return 1; }

  private rebuild(st: GameState) {
    const city = st.city;
    const cal = calendar(st.startYear, st.minute);
    const season = cal.season;
    this.roadSet = new Set(city.roads);
    this.placeAt = new Map(city.places.map((p) => [p.y * city.w + p.x, p]));
    this.objects.removeChildren().forEach((c) => c.destroy());
    this.lights.removeChildren().forEach((c) => c.destroy());
    this.labels.removeChildren().forEach((c) => c.destroy());
    const g = this.ground;
    g.clear();
    const snow = st.weather.kind === 'neige' || (season === 'hiver' && st.weather.temp < 1);
    const grass = snow ? 0xe8ecef : season === 'hiver' ? 0x8f9a7a : season === 'automne' ? 0x9a9a58 : season === 'ete' ? 0x8aa250 : 0x7aa456;
    const field = season === 'ete' ? 0xd8c070 : season === 'automne' ? 0x9a7a4a : season === 'hiver' ? (snow ? 0xe4e6e2 : 0x8a7a5a) : 0x9ab858;
    for (let y = 0; y < city.h; y++)
      for (let x = 0; x < city.w; x++) {
        const t = city.tiles[y * city.w + x];
        const n = hash2(x, y, 7);
        let col = grass;
        if (t === T.route) col = 0x55585d;
        else if (t === T.trottoir) col = snow ? 0xd8dcde : 0xb7b0a0;
        else if (t === T.place) col = 0xc9bc9a;
        else if (t === T.pave) col = 0xa89a80;
        else if (t === T.eau) col = mix(0x3f6f8f, 0x5a8aaa, n);
        else if (t === T.foret) col = snow ? 0xdfe4e2 : shadeN(0x5a7a40, 0.92 + n * 0.1);
        else if (t === T.champ) col = shadeN(field, 0.94 + n * 0.1);
        else if (t === T.rail) col = 0x7a6a5a;
        else col = shadeN(grass, 0.95 + n * 0.08);
        poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], col, 1, false);
        if (t === T.rail) { const [a, b] = iso(x, y + 0.35), [c, d] = iso(x + 1, y + 0.35); g.moveTo(a, b).lineTo(c, d).stroke({ width: 1.2, color: 0x3a3a3a }); const [e, f] = iso(x, y + 0.65), [h, i] = iso(x + 1, y + 0.65); g.moveTo(e, f).lineTo(h, i).stroke({ width: 1.2, color: 0x3a3a3a }); }
        if (t === T.route) {
          const horiz = this.roadSet.has(y * city.w + x - 1) || this.roadSet.has(y * city.w + x + 1);
          const vert = this.roadSet.has((y - 1) * city.w + x) || this.roadSet.has((y + 1) * city.w + x);
          if (horiz && !vert && x % 2 === 0) { const [a, b] = iso(x + 0.2, y + 0.5), [c, d] = iso(x + 0.7, y + 0.5); g.moveTo(a, b).lineTo(c, d).stroke({ width: 1.5, color: 0xe8e2c8, alpha: 0.7 }); }
          if (vert && !horiz && y % 2 === 0) { const [a, b] = iso(x + 0.5, y + 0.2), [c, d] = iso(x + 0.5, y + 0.7); g.moveTo(a, b).lineTo(c, d).stroke({ width: 1.5, color: 0xe8e2c8, alpha: 0.7 }); }
          if (city.tiles[y * city.w + x - 1] === T.eau || city.tiles[y * city.w + x + 1] === T.eau) box(g, x, y, 1, 1, 3, 0x8a8478);
        }
      }
    // bâtiments : lieux nommés + bâti diffus selon le quartier
    const year = cal.year;
    for (const p of city.places) this.building(p.x, p.y, p.kind, p.floors, p.district, year, season, snow, p);
    for (const d of city.districts) {
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++) {
          if (x < 0 || y < 0 || x >= city.w || y >= city.h) continue;
          const i = y * city.w + x;
          const t = city.tiles[i];
          if (this.placeAt.has(i)) continue;
          const n = hash2(x, y, 31);
          if (t === T.foret) { if (n < 0.75) this.tree(x + 0.3 + n * 0.4, y + 0.3 + hash2(x, y, 5) * 0.4, season, snow, true); continue; }
          if (t !== T.herbe && t !== T.trottoir) continue;
          const dens = { centre: 0.85, vieille: 0.9, commercial: 0.6, residentiel: 0.7, pavillons: 0.55, gare: 0.6, industrie: 0.55, campus: 0.45, hopital: 0.4, tourisme: 0.2, rural: 0.06, foret: 0, villages: 0.12, axes: 0.05 }[d.id];
          if (n < dens && t === T.herbe) this.building(x, y, null, 0, d.id, year, season, snow);
          else if (n > 0.85 && t === T.herbe) this.tree(x + 0.5, y + 0.5, season, snow, false);
        }
    }
    // réverbères le long des avenues
    for (const r of city.roads) {
      const x = r % city.w, y = Math.floor(r / city.w);
      if ((x + y) % 5 !== 0 || x < 8 || x > 41 || y < 12 || y > 38) continue;
      const [a, b] = iso(x + 0.5, y + 0.5);
      const l = new Graphics();
      l.ellipse(a, b, 34, 16).fill({ color: 0x8a7038, alpha: 0.6 });
      this.lights.addChild(l);
    }
    // noms des quartiers
    for (const d of city.districts) {
      if (d.id === 'axes') continue;
      const [cx, cy] = iso(d.x + d.w / 2, d.y + d.h / 2);
      const t = new Text({ text: d.name, style: { fontSize: 18, fill: 0xfaf4e6, fontWeight: '700', stroke: { color: 0x1d1a17, width: 4 }, fontFamily: 'Georgia, serif' } });
      t.anchor.set(0.5);
      t.position.set(cx, cy - 40);
      t.alpha = 0.8;
      this.labels.addChild(t);
    }
  }

  private building(x: number, y: number, kind: Place['kind'] | null, floors: number, d: DistrictId, _year: number, season: string, snow: boolean, place?: Place) {
    const g = new Graphics();
    const n = hash2(x, y, 11);
    let h = 30, roof: number = ROOF.tuile, wall = 0xd8c8a8, w = 0.86, dd = 0.86, gable = true;
    switch (d) {
      case 'vieille': h = 34 + Math.floor(n * 3) * 12; roof = ROOF.ardoise; wall = mix(0xd9c9a3, 0xc0a880, n); w = dd = 0.92; break;
      case 'centre': h = 42 + Math.floor(n * 3) * 14; roof = n > 0.5 ? ROOF.zinc : ROOF.ardoise; wall = mix(0xe6dcc6, 0xcdbf9f, n); w = dd = 0.92; break;
      case 'residentiel': h = 50 + Math.floor(n * 4) * 16; roof = ROOF.plat; wall = mix(0xe2ddd2, 0xc9c2b2, n); gable = false; break;
      case 'commercial': h = 22; roof = ROOF.bac; wall = [0xd84a3a, 0x3a7ab8, 0xe0b040, 0x8a9aa8][Math.floor(n * 4)]; gable = false; break;
      case 'industrie': h = 26; roof = ROOF.bac; wall = mix(0x9aa0a4, 0x7a8288, n); gable = n > 0.5; break;
      case 'campus': h = 36 + Math.floor(n * 2) * 12; roof = ROOF.ardoise; wall = mix(0xb86a4a, 0xa85a3a, n); break;
      case 'hopital': h = 50; roof = ROOF.plat; wall = 0xeef0ee; gable = false; break;
      case 'gare': h = 30; roof = ROOF.zinc; wall = 0xd8cbb0; break;
      default: h = 20 + Math.floor(n * 2) * 8; roof = n > 0.6 ? ROOF.ardoise : ROOF.tuile; wall = mix(0xeee2c8, 0xd8c8a0, n); w = dd = 0.7;
    }
    if (kind) {
      h = Math.max(h, 18 + floors * 14);
      if (kind === 'commissariat') { wall = 0xe0d6c0; roof = ROOF.ardoise; h = 48; }
      if (kind === 'mairie' || kind === 'tribunal') { wall = 0xeae0c8; roof = ROOF.ardoise; h = 56; }
      if (kind === 'eglise') { wall = 0xc8b898; roof = ROOF.ardoise; h = 60; }
      if (kind === 'hopital') { wall = 0xf2f4f2; h = 70; gable = false; roof = ROOF.plat; }
      if (kind === 'usine' || kind === 'entrepot') { wall = 0x9aa4ac; roof = ROOF.bac; h = 30; }
      if (kind === 'ferme') { wall = 0xd8c8a0; roof = ROOF.tuile; h = 22; }
      if (kind === 'parc') { this.tree(x + 0.5, y + 0.5, season, snow, false); this.tree(x + 0.2, y + 0.8, season, snow, true); return; }
      if (kind === 'camping') { g.poly([...iso(x + 0.2, y + 0.6), ...iso(x + 0.5, y + 0.3, 14), ...iso(x + 0.8, y + 0.6)]).fill(0xd88a3a).stroke({ width: 1, color: 0x1d1a17 }); g.zIndex = (x + y + 1) * 10; this.objects.addChild(g); return; }
      w = dd = 0.94;
    }
    const x0 = x + (1 - w) / 2, y0 = y + (1 - dd) / 2;
    box(g, x0, y0, w, dd, h, wall, 0, { top: shadeN(roof, 1.05) });
    // fenêtres
    const lvl = Math.max(1, Math.floor(h / 14));
    const lit: [number, number, boolean][] = [];
    for (let k = 0; k < lvl; k++) for (let j = 0; j < 2; j++) {
      const z = 8 + k * 14;
      if (z + 8 > h) continue;
      const u = x0 + 0.2 + j * 0.4 * w;
      poly(g, [iso(u, y0 + dd, z), iso(u + 0.18, y0 + dd, z), iso(u + 0.18, y0 + dd, z + 7), iso(u, y0 + dd, z + 7)], 0x3a4a5a, 1, false);
      const v = y0 + 0.2 + j * 0.4 * dd;
      poly(g, [iso(x0 + w, v, z), iso(x0 + w, v + 0.18, z), iso(x0 + w, v + 0.18, z + 7), iso(x0 + w, v, z + 7)], 0x34424f, 1, false);
      lit.push([u + 0.09, z + 3.5, hash2(x * 3 + k, y * 5 + j, 3) < (kind === 'hopital' ? 0.8 : 0.45)]);
    }
    if (gable) {
      // toit à deux pans
      const top = h + 12 + (d === 'vieille' ? 6 : 0);
      poly(g, [iso(x0, y0 + dd, h), iso(x0 + w, y0 + dd, h), iso(x0 + w, y0 + dd / 2, top), iso(x0, y0 + dd / 2, top)], snow ? 0xf0f2f2 : roof);
      poly(g, [iso(x0 + w, y0, h), iso(x0 + w, y0 + dd, h), iso(x0 + w, y0 + dd / 2, top)], shadeN(wall, 0.75));
    }
    if (kind === 'eglise') { box(g, x0 + w * 0.3, y0 + dd * 0.3, w * 0.4, dd * 0.4, 40, wall, h); const [a, b] = iso(x0 + w / 2, y0 + dd / 2, h + 40); g.poly([a - 8, b, a + 8, b, a, b - 22]).fill(ROOF.ardoise).stroke({ width: 1, color: 0x1d1a17 }); }
    if (kind === 'commissariat') {
      const [a, b] = iso(x0 + w / 2, y0 + dd, h - 8);
      g.rect(a - 18, b - 6, 36, 9).fill(0x1f3a6e).stroke({ width: 1, color: 0x1d1a17 });
      const t = new Text({ text: 'POLICE', style: { fontSize: 7, fill: 0xffffff, fontWeight: 'bold' } });
      t.anchor.set(0.5); t.position.set(a, b - 1.5); t.zIndex = (x + y + 1) * 10 + 1; this.objects.addChild(t);
    }
    if (place && kind !== 'maison' && kind !== 'immeuble') {
      // enseigne
      const [a, b] = iso(x0 + w * 0.5, y0 + dd, 14);
      g.rect(a - 12, b - 4, 24, 6).fill(kind === 'commissariat' ? 0x1f3a6e : 0xf2e6c8).stroke({ width: 0.6, color: 0x1d1a17 });
    }
    g.zIndex = (x + y + 1) * 10;
    if (place) { g.eventMode = 'none'; (g as Graphics & { placeId?: string }).placeId = place.id; }
    this.objects.addChild(g);
    // lumières nocturnes
    for (const [u, z, on] of lit) {
      if (!on) continue;
      const [lx, ly] = iso(u, y0 + dd, z);
      const l = new Graphics();
      l.rect(lx - 3, ly - 4, 6, 7).fill({ color: 0xd8a848, alpha: 1 });
      this.lights.addChild(l);
    }
  }

  private tree(x: number, y: number, season: string, snow: boolean, small: boolean) {
    const t = new Graphics();
    const [a, b] = iso(x, y);
    const r = small ? 9 : 12;
    t.ellipse(a, b, r, r * 0.4).fill({ color: 0, alpha: 0.18 });
    t.rect(a - 1.5, b - 14, 3, 14).fill(0x5a4030);
    const conifer = small && hash2(Math.floor(x * 10), Math.floor(y * 10), 2) > 0.5;
    if (conifer) {
      t.poly([a - r, b - 10, a + r, b - 10, a, b - 10 - r * 2.6]).fill(snow ? 0xdfe8e4 : 0x2f5a3a).stroke({ width: 0.8, color: 0x1d1a17, alpha: 0.6 });
    } else if (season === 'hiver') {
      for (let i = -1; i <= 1; i++) t.moveTo(a, b - 12).lineTo(a + i * 8, b - 26).stroke({ width: 1.4, color: 0x5a4030 });
      if (snow) t.circle(a, b - 24, 5).fill({ color: 0xffffff, alpha: 0.7 });
    } else {
      const c = season === 'automne' ? [0xc87a2a, 0xd8a03a] : season === 'printemps' ? [0x7aaa4a, 0xe8c0d0] : [0x4a7a3a, 0x5a8a42];
      t.circle(a, b - 20, r).fill(c[0]).stroke({ width: 0.8, color: 0x1d1a17, alpha: 0.5 });
      t.circle(a + 4, b - 25, r * 0.6).fill(c[1]);
    }
    t.zIndex = (x + y + 0.5) * 10;
    this.objects.addChild(t);
  }

  // ————— circulation et marqueurs —————
  private randomRoad(): number {
    const st = this.get();
    return st.city.roads[Math.floor(Math.random() * st.city.roads.length)];
  }

  private spawnMovers(st: GameState) {
    const cal = calendar(st.startYear, st.minute);
    const act = st.city.districts.reduce((s, d) => s + districtActivity(d, cal.weekday, cal.hour, cal.season), 0) / st.city.districts.length;
    const night = cal.hour < 6 || cal.hour >= 22;
    const wantCars = Math.round((night ? 4 : 10 + act * 18) * Math.min(1.6, Math.sqrt(st.city.population / 80000)));
    const wantPeds = Math.round(night ? 3 : 14 + act * 26);
    const cars = this.movers.filter((m) => m.kind === 'car').length;
    const peds = this.movers.filter((m) => m.kind === 'ped').length;
    if (cars < wantCars) {
      const a = this.randomRoad(), b = this.randomRoad();
      const path = roadPath(st.city, a, b);
      if (path.length > 3) {
        const big = Math.random();
        const body = ['#7a2e2e', '#2f5d50', '#d9c27a', '#e8e4da', '#3d4a5c', '#8a8a8a', '#355070', '#b56576'][Math.floor(Math.random() * 8)];
        const vk = big < 0.06 ? 'bus' : big < 0.14 ? 'camion' : 'civil';
        const s = new Sprite(vehTexture({ body, kind: vk as 'civil', police: false, era: cal.year }, true));
        s.anchor.set(0.5, 0.75); s.scale.set(0.5);
        this.objects.addChild(s);
        this.movers.push({ s, path, i: 0, t: 0, speed: 2.4 + Math.random(), kind: 'car', body, vk });
      }
    }
    if (peds < wantPeds) {
      const side = st.city.tiles.map((t, i) => (t === T.trottoir || t === T.place || t === T.pave ? i : -1)).filter((i) => i >= 0);
      const a = side[Math.floor(Math.random() * side.length)];
      const path = [a];
      let cur = a;
      for (let k = 0; k < 14; k++) {
        const w = st.city.w;
        const nb = [cur - 1, cur + 1, cur - w, cur + w].filter((j) => [T.trottoir, T.place, T.pave].includes(st.city.tiles[j] as 2 | 3 | 9));
        if (!nb.length) break;
        cur = nb[Math.floor(Math.random() * nb.length)];
        path.push(cur);
      }
      const sexe = Math.random() < 0.5 ? 'F' : 'M';
      const spec: CharSpec = { a: { skin: Math.floor(Math.random() * 6), hair: Math.floor(Math.random() * 7), hairStyle: sexe === 'F' ? 3 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3), outfit: Math.floor(Math.random() * 10), build: 1, glasses: false, beard: false }, sexe, look: 'civil' };
      const s = new Sprite(charTexture(spec, 'walk', 0, false));
      s.anchor.set(0.5, 66 / 72); s.scale.set(0.42);
      this.objects.addChild(s);
      this.movers.push({ s, path, i: 0, t: 0, speed: 0.7 + Math.random() * 0.3, kind: 'ped', spec });
    }
    // véhicules de police en mission : du commissariat vers le lieu de l'affaire
    const hq = st.city.places.find((p) => p.kind === 'commissariat');
    for (const v of st.vehicles) {
      if (!v.caseId || v.busyUntil <= st.minute || !hq) continue;
      if (this.movers.some((m) => m.kind === 'police' && m.caseId === `${v.id}|${v.caseId}`)) continue;
      const c = st.cases.find((x) => x.id === v.caseId);
      const pl = c && st.city.places.find((p) => p.id === c.placeId);
      if (!pl) continue;
      const path = roadPath(st.city, hq.y * st.city.w + hq.x, pl.y * st.city.w + pl.x);
      if (path.length < 2) continue;
      const body = '#' + v.color.toString(16).padStart(6, '0');
      const s = new Sprite(vehTexture({ body, kind: v.kind === 'fourgon' ? 'fourgon' : 'banalisee', police: true, era: cal.year, lights: true }, true));
      s.anchor.set(0.5, 0.75); s.scale.set(0.55);
      this.objects.addChild(s);
      this.movers.push({ s, path, i: 0, t: 0, speed: 3.2, kind: 'police', caseId: `${v.id}|${v.caseId}`, body, vk: v.kind === 'fourgon' ? 'fourgon' : 'banalisee' });
    }
    for (const m of this.movers) if (m.kind === 'police') {
      const [vid] = m.caseId!.split('|');
      const v = st.vehicles.find((x) => x.id === vid);
      if (!v || v.busyUntil <= st.minute) m.done = true;
    }
  }

  private drawMarkers(st: GameState, time: number) {
    this.markers.removeChildren().forEach((c) => c.destroy());
    const byPlace = new Map<string, { n: number; prio: number; id: string }>();
    for (const c of st.cases) {
      if (c.status !== 'ouverte') continue;
      const e = byPlace.get(c.placeId);
      if (!e) byPlace.set(c.placeId, { n: 1, prio: c.priority, id: c.id });
      else { e.n++; if (c.priority < e.prio) { e.prio = c.priority; e.id = c.id; } }
    }
    for (const [pid, e] of byPlace) {
      const p = st.city.places.find((x) => x.id === pid);
      if (!p) continue;
      const [a, b] = iso(p.x + 0.5, p.y + 0.5, 70);
      const g = new Container();
      const gg = new Graphics();
      g.addChild(gg);
      const col = e.prio === 1 ? 0xd83a2a : e.prio === 2 ? 0xe0a030 : 0x3a8ad8;
      const pulse = (Math.sin(time / 300) + 1) / 2;
      const [ga, gb] = iso(p.x + 0.5, p.y + 0.5);
      gg.ellipse(ga, gb, 20 + pulse * 8, 10 + pulse * 4).stroke({ width: 2, color: col, alpha: 0.8 - pulse * 0.5 });
      gg.moveTo(a, b + 14).lineTo(ga, gb).stroke({ width: 1.5, color: 0x1d1a17, alpha: 0.5 });
      gg.poly([a - 11, b - 12, a + 11, b - 12, a + 11, b + 6, a + 3, b + 6, a, b + 14, a - 3, b + 6, a - 11, b + 6]).fill(col).stroke({ width: 1.5, color: 0x1d1a17 });
      const t = new Text({ text: e.n > 1 ? String(e.n) : '!', style: { fontSize: 12, fill: 0xffffff, fontWeight: 'bold' } });
      t.anchor.set(0.5); t.position.set(a, b - 3);
      g.addChild(t);
      this.markers.addChild(g);
    }
  }

  update(dtMs: number, time: number) {
    const st = this.get();
    const cal = calendar(st.startYear, st.minute);
    const sig = `${cal.season}|${st.weather.kind === 'neige'}|${st.city.places.length}`;
    if (sig !== this.sig) {
      this.sig = sig;
      for (const m of this.movers) m.s.destroy();
      this.movers = [];
      this.rebuild(st);
    }
    if (time - this.lastSpawn > 300) { this.lastSpawn = time; this.spawnMovers(st); this.drawMarkers(st, time); }
    const dt = dtMs / 1000;
    const k = Math.min(4, Math.max(1, Math.sqrt(this.speed || 1)));
    const w = st.city.w;
    const lightsOn = daylight(st.startYear, st.minute) < 0.4;
    for (const m of this.movers) {
      if (m.parked) {
        if (m.done) { m.s.alpha -= dt; if (m.s.alpha <= 0) m.path = []; }
        else if (m.kind === 'police') m.s.texture = vehTexture({ body: m.body!, kind: m.vk as 'banalisee', police: true, era: cal.year, lights: Math.floor(time / 300) % 2 === 0 }, true);
        continue;
      }
      m.t += dt * m.speed * k;
      while (m.t >= 1 && m.i < m.path.length - 1) { m.t -= 1; m.i++; }
      if (m.i >= m.path.length - 1) {
        if (m.kind === 'police' && !m.done) { m.parked = true; continue; }
        m.path = [];
        continue;
      }
      const a = m.path[m.i], b = m.path[m.i + 1];
      const ax = a % w + 0.5, ay = Math.floor(a / w) + 0.5, bx = b % w + 0.5, by = Math.floor(b / w) + 0.5;
      const dxv = bx - ax, dyv = by - ay;
      // les voitures roulent à droite de la chaussée
      const off = m.kind === 'ped' ? 0 : 0.18;
      const x = ax + dxv * m.t + (dyv !== 0 ? -Math.sign(dyv) * off : 0), y = ay + dyv * m.t + (dxv !== 0 ? Math.sign(dxv) * off : 0);
      const [sx, sy] = iso(x, y);
      m.s.position.set(sx, sy);
      m.s.zIndex = (x + y) * 10 + 0.5;
      if (m.kind === 'ped') {
        const frame = Math.floor(time / 140) % 4;
        m.s.texture = charTexture(m.spec!, 'walk', frame, dxv < 0 || dyv < 0);
      } else {
        const alongX = dxv !== 0;
        m.s.texture = vehTexture({ body: m.body!, kind: (m.vk ?? 'civil') as 'civil', police: m.kind === 'police', era: cal.year, lights: m.kind === 'police' ? Math.floor(time / 250) % 2 === 0 : lightsOn }, alongX);
        m.s.scale.x = (alongX ? dxv < 0 : dyv < 0) ? -Math.abs(m.s.scale.y) : Math.abs(m.s.scale.y);
      }
    }
    const dead = this.movers.filter((m) => !m.path.length);
    for (const m of dead) { this.objects.removeChild(m.s); m.s.destroy(); }
    this.movers = this.movers.filter((m) => m.path.length);
  }

  tap(wx: number, wy: number) {
    const st = this.get();
    // marqueurs d'affaires
    for (const c of st.cases) {
      if (c.status !== 'ouverte') continue;
      const p = st.city.places.find((x) => x.id === c.placeId);
      if (!p) continue;
      const [a, b] = iso(p.x + 0.5, p.y + 0.5, 70);
      if (Math.hypot(a - wx, b - wy) < 18) {
        const best = st.cases.filter((x) => x.status === 'ouverte' && x.placeId === p.id).sort((u, v) => u.priority - v.priority)[0];
        this.cb.onCase(best.id);
        return;
      }
    }
    const ax = wx / (TW / 2), by = wy / (TH / 2);
    for (const dz of [0, 1, 2]) {
      const tx = Math.floor((ax + by) / 2) + dz, ty = Math.floor((by - ax) / 2) + dz;
      const p = this.placeAt.get(ty * st.city.w + tx);
      if (p) { this.cb.onPlace(p.id); return; }
    }
  }

  placeScreen(placeId: string): { x: number; y: number } | null {
    const p = this.get().city.places.find((x) => x.id === placeId);
    if (!p) return null;
    const [x, y] = iso(p.x + 0.5, p.y + 0.5);
    return { x, y };
  }

  destroy() {
    this.root.destroy({ children: true });
    this.lights.destroy({ children: true });
  }
}

export function placeStatus(st: GameState, p: Place): string {
  const c = calendar(st.startYear, st.minute);
  if (p.open === p.close) return 'Accès permanent';
  return `${placeOpen(p, c.weekday, c.hour) ? 'Ouvert' : 'Fermé'} — ${p.open} h à ${p.close} h${p.closedDays.length ? ` (fermé ${p.closedDays.map((d) => ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d]).join(', ')})` : ''}`;
}
