// UIManager : panneaux illustrés en DOM par-dessus le jeu (dialogues, atlas, inventaire, journal, menus, accueil).
import { S, flag, has, PHASE_LABEL, Phase, Settings, ZoneId } from '../core/state';
import { SPEAKER_NAME, Line } from '../data/dialogues';
import { CAST, ELOI } from '../data/cast';
import { portrait, CharSpec } from '../art/characters';
import { ITEMS, itemIcon } from '../data/items';
import { MAIN, SIDE, CLUES, NOTES, CLUE_TIPS, hintText, currentMainStep, SECRETS_TOTAL, SECRET_LABEL } from '../data/story';
import { ROUTINES, MAIN_NPCS, NpcId } from '../data/npcs';
import { DIALOGS } from '../data/dialogues';
import { renderMap } from '../systems/Atlas';
import { ZONE_LABEL, ZONES } from '../world/zones';
const __zoneSize = (z: ZoneId): [number, number] => [ZONES[z].w, ZONES[z].h];
import { listSlots, writeSlot, deleteSlot, saveSettings, loadSettings } from '../systems/SaveManager';
import { audio } from '../systems/Audio';
import { ICONS } from './icons';
import type { GameScene } from '../scenes/GameScene';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const h = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface HomeHandlers { onNew: (slot: number) => void; onLoad: (slot: number) => void; onContinue: () => void; canContinue: () => boolean }

type PanelName = 'atlas' | 'inventaire' | 'journal' | 'menu';

class UIManager {
  root!: HTMLElement;
  game: GameScene | null = null;
  settings: Settings = loadSettings();
  private modal = 0;
  private dlgResolve: (() => void) | null = null;
  private typing: { full: string; el: HTMLElement; i: number; timer: number } | null = null;
  private portraits = new Map<string, string>();
  private panel: PanelName | null = null;
  private atlasZone: ZoneId = 'clairval';
  private atlasTab = 'carte';
  private journalTab = 'quete';
  private invSel: string | null = null;
  private combineFrom: string | null = null;
  private hintTimer = 0;
  private danger = false;
  private toastQ: HTMLElement[] = [];
  home: HomeHandlers | null = null;
  installEvt: any = null;
  swReg: ServiceWorkerRegistration | null = null;
  onSettings: ((s: Settings) => void) | null = null;
  onQuitToHome: (() => void) | null = null;

  init() {
    this.root = $('#ui');
    this.root.innerHTML = `
      <div id="hud" class="hidden">
        <div class="hud-left"><div id="hearts" class="hearts hidden"></div><div id="zone-name" class="zone-name"></div></div>
        <div class="hud-right">
          <div id="clock" class="clock" title="Moment de la journée"></div>
          <button class="ib" data-p="atlas" aria-label="Atlas (M)">${ICONS.atlas}<i class="badge"></i></button>
          <button class="ib" data-p="inventaire" aria-label="Inventaire (I)">${ICONS.bag}<i class="badge"></i></button>
          <button class="ib" data-p="journal" aria-label="Journal (J)">${ICONS.journal}<i class="badge"></i></button>
          <button class="ib" data-p="menu" aria-label="Menu (Échap)">${ICONS.menu}</button>
        </div>
        <div id="compass" class="compass hidden"><div class="needle"></div></div>
        <div id="itemsel" class="itemsel hidden"></div>
        <div id="hint" class="hint"></div>
        <div id="saved" class="saved">Sauvegardé</div>
        <div id="bossbar" class="bossbar hidden"><b></b><div class="bb"><i></i></div></div>
        <button id="dodge" class="dodge hidden" aria-label="Esquive (Espace)">Esquive</button>
        <div class="camctl"><button class="cb recenter hidden" data-c="c" aria-label="Recentrer sur Éloi (C)">${ICONS.target}<span>Éloi</span></button><button class="cb" data-c="+" aria-label="Zoomer (+)">＋</button><button class="cb" data-c="-" aria-label="Dézoomer (−)">−</button></div>
      </div>
      <div id="toasts"></div>
      <div id="dialog" class="dialog hidden"><div class="pf"><img alt=""></div><div class="db"><div class="dn"></div><div class="dt"></div><div class="dc"></div><div class="dmore">▼</div></div></div>
      <div id="panel" class="panel hidden"></div>
      <div id="home" class="home hidden"></div>
      <div id="portrait-warn" class="portrait-warn"><div class="pw-box"><div class="pw-phone"></div><h2>Tournez votre téléphone</h2><p>L'aventure se joue à l'horizontale, pour mieux voir le monde.</p><div class="pw-btns"></div></div></div>
      <div id="fade" class="fade hidden"></div>`;
    this.root.querySelectorAll<HTMLButtonElement>('.ib').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); this.openPanel(b.dataset.p as PanelName); }));
    this.root.querySelectorAll<HTMLButtonElement>('.camctl .cb').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); audio.unlock(); audio.sfx('tap');
      const c = b.dataset.c;
      if (c === '+') this.game?.zoomStep(1);
      if (c === '-') this.game?.zoomStep(-1);
      if (c === 'c') this.game?.recenter();
    }));
    $('#dodge').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.game?.dodge(); });
    const dlg = $('#dialog');
    dlg.addEventListener('pointerdown', (e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('.dc button')) return; this.advance(); });
    $('#itemsel').addEventListener('click', () => this.selectItem(null));
    this.applyQuality();
    this.renderPortraitWarn();
  }

  attachGame(g: GameScene | null) { this.game = g; $('#hud').classList.toggle('hidden', !g); if (g) { this.hearts(); this.refresh(); } }
  /** Mode souvenir : boîte de dialogue et portraits teintés sépia. */
  setMemory(on: boolean) { document.body.classList.toggle('memory', on); }
  isModal() { return this.modal > 0 || !!this.panel; }

  // ------------------------------------------------------------ dialogues
  private portraitOf(s: string, m: Line['m']): string {
    const k = s + (m ?? 'neutre');
    if (!this.portraits.has(k)) { const spec: CharSpec | undefined = s === 'eloi' ? ELOI : CAST[s]; this.portraits.set(k, spec ? portrait(spec, m ?? 'neutre', 180) : ''); }
    return this.portraits.get(k)!;
  }

  async dialogue(lines: Line[], onSpeaker?: (s: string | null) => void) {
    this.modal++;
    const dlg = $('#dialog');
    dlg.classList.remove('hidden');
    try {
      for (const l of lines) {
        onSpeaker?.(l.s);
        this.showLine(l);
        await new Promise<void>((r) => (this.dlgResolve = r));
      }
    } finally {
      onSpeaker?.(null);
      this.modal--;
      if (!this.modal) dlg.classList.add('hidden');
    }
  }

  private showLine(l: Line, choices = false) {
    const dlg = $('#dialog');
    const img = $<HTMLImageElement>('.pf img', dlg);
    const narr = l.s === 'narr';
    dlg.classList.toggle('narr', narr);
    dlg.classList.toggle('eloi', l.s === 'eloi');
    if (!narr) img.src = this.portraitOf(l.s, l.m);
    $('.dn', dlg).textContent = SPEAKER_NAME[l.s] ?? '';
    const dt = $('.dt', dlg);
    $('.dc', dlg).innerHTML = '';
    $('.dmore', dlg).style.visibility = choices ? 'hidden' : 'visible';
    if (this.typing) clearInterval(this.typing.timer);
    const speed = { lente: 38, normale: 22, rapide: 10, instantanee: 0 }[this.settings.textSpeed];
    if (!speed) { dt.textContent = l.t; this.typing = null; return; }
    dt.textContent = '';
    const t = { full: l.t, el: dt, i: 0, timer: 0 };
    t.timer = window.setInterval(() => {
      t.i += 1;
      dt.textContent = t.full.slice(0, t.i);
      if (t.i % 3 === 0 && l.s !== 'narr') audio.talk(l.s);
      if (t.i >= t.full.length) { clearInterval(t.timer); this.typing = null; }
    }, speed);
    this.typing = t;
  }

  private advance() {
    if (this.typing) { clearInterval(this.typing.timer); this.typing.el.textContent = this.typing.full; this.typing = null; return; }
    const r = this.dlgResolve; this.dlgResolve = null; r?.();
  }

  choose(prompt: Line | null, options: string[]): Promise<number> {
    this.modal++;
    const dlg = $('#dialog');
    dlg.classList.remove('hidden');
    if (prompt) this.showLine(prompt, true);
    else { $('.dt', dlg).textContent = ''; $('.dc', dlg).innerHTML = ''; $('.dmore', dlg).style.visibility = 'hidden'; dlg.classList.add('narr'); $('.dn', dlg).textContent = ''; }
    if (this.typing && prompt) { clearInterval(this.typing.timer); this.typing.el.textContent = this.typing.full; this.typing = null; }
    const dc = $('.dc', dlg);
    return new Promise<number>((resolve) => {
      options.forEach((o, i) => {
        const b = h(`<button class="choice ${o.startsWith('· ') ? 'seen' : ''}">${esc(o.replace(/^· /, ''))}</button>`);
        // « clic fantôme » au toucher : le doigt qui vient de faire avancer le texte ne doit pas choisir à sa place
        let armed = false;
        b.addEventListener('pointerdown', () => { armed = true; });
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') armed = true; });
        b.addEventListener('click', (e) => { e.stopPropagation(); if (!armed && e.detail !== 0) return; audio.sfx('tap'); this.modal--; if (!this.modal) dlg.classList.add('hidden'); dc.innerHTML = ''; resolve(i); });
        dc.appendChild(b);
      });
    });
  }

  // ------------------------------------------------------------ HUD
  toast(msg: string, kind: string = 'info') {
    const el = h(`<div class="toast t-${kind}"><span class="ti">${kind === 'objet' ? ICONS.bag : kind === 'quete' ? ICONS.journal : kind === 'secret' ? ICONS.star : ICONS.atlas}</span><span>${esc(msg)}</span></div>`);
    $('#toasts').appendChild(el);
    this.toastQ.push(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => { el.remove(); this.toastQ = this.toastQ.filter((x) => x !== el); }, 4100);
    while (this.toastQ.length > 3) this.toastQ.shift()!.remove();
  }
  hint(msg: string) { const e = $('#hint'); e.textContent = msg; e.classList.add('on'); clearTimeout(this.hintTimer); this.hintTimer = window.setTimeout(() => e.classList.remove('on'), 1800); }
  zoneName(n: string) { const e = $('#zone-name'); e.textContent = n; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  saved() { const e = $('#saved'); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  setDanger(a: boolean) { this.danger = a; this.hearts(); }
  hearts() {
    const e = $('#hearts');
    e.innerHTML = Array.from({ length: S.maxHp }, (_, i) => `<span class="heart ${i < S.hp ? '' : 'empty'}">${ICONS.heart}</span>`).join('');
    e.classList.toggle('hidden', !(this.danger || S.hp < S.maxHp));
  }
  setPhase(p: Phase) { const e = $('#clock'); const k = p + Math.floor(S.clock / 1440); if (e.dataset.k !== k) { e.dataset.k = k; e.innerHTML = `${p === 'nuit' || p === 'soir' ? ICONS.moon : ICONS.sun}<span>${PHASE_LABEL[p]} · jour ${Math.floor(S.clock / 1440) + 1}</span>`; } }
  tick(_dt: number, compass: number | null) {
    const c = $('#compass');
    c.classList.toggle('hidden', compass === null);
    if (compass !== null) $('.needle', c).style.transform = `rotate(${compass + Math.PI / 2}rad)`;
  }
  setDodge(on: boolean) { $('#dodge').classList.toggle('hidden', !on); }
  bossBar(name: string | null, pct = 1) {
    const b = $('#bossbar');
    if (!name) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    $('b', b).textContent = name;
    $<HTMLElement>('.bb i', b).style.width = Math.round(pct * 100) + '%';
  }
  setFreeCam(on: boolean) { this.root.querySelector('.camctl .recenter')?.classList.toggle('hidden', !on); }
  setZoomLevel(_z: number) { /* réservé : indicateur de zoom */ }
  badge(p: PanelName) { const b = this.root.querySelector(`.ib[data-p="${p}"] .badge`); b?.classList.add('on'); }
  refresh() { if (this.panel) this.renderPanel(); }
  selectItem(id: string | null) {
    const e = $('#itemsel');
    if (this.game) this.game.selectedItem = id;
    if (!id) { e.classList.add('hidden'); return; }
    e.innerHTML = `<img src="${itemIcon(id, 48)}" alt=""><span>Utiliser : <b>${esc(ITEMS[id].name)}</b> — touchez une personne ou un objet</span><b class="x">✕</b>`;
    e.classList.remove('hidden');
  }

  tutorial() {
    const touch = matchMedia('(pointer: coarse)').matches;
    this.toast(touch ? 'Touchez le sol pour marcher, une personne pour lui parler, un objet pour l\'examiner.' : 'Cliquez sur le sol pour marcher, sur une personne pour lui parler, sur un objet pour l\'examiner.', 'info');
    setTimeout(() => this.toast(touch ? 'Glissez le doigt pour parcourir la carte, pincez pour zoomer : Éloi ne bouge pas.' : 'Glissez avec la souris pour parcourir la carte, molette pour zoomer : Éloi ne bouge pas.', 'info'), 4200);
    setTimeout(() => this.toast(touch ? 'Pour marcher en continu : restez appuyé un instant, puis glissez.' : 'Pour marcher en continu : maintenez le clic un instant, puis déplacez la souris.', 'info'), 8400);
  }
  combatTutorial() {
    this.toast('Danger ! Touchez une créature pour la frapper avec votre bâton.', 'info');
    setTimeout(() => this.toast('Une zone rouge annonce une attaque : touchez un endroit sûr pour vous écarter.', 'info'), 4000);
  }

  // ------------------------------------------------------------ panneaux
  openPanel(p: PanelName) {
    if (this.modal) return;
    audio.sfx('open');
    this.panel = p;
    this.root.querySelector(`.ib[data-p="${p}"] .badge`)?.classList.remove('on');
    if (p === 'atlas') this.atlasZone = (['clairval', 'bois', 'moulin'] as ZoneId[]).includes(S.zone) ? S.zone : S.zone === 'moulin_int' ? 'moulin' : 'clairval';
    this.invSel = null; this.combineFrom = null;
    this.renderPanel();
    $('#panel').classList.remove('hidden');
  }
  closePanel() { if (!this.panel) return; audio.sfx('close'); this.panel = null; $('#panel').classList.add('hidden'); $('#panel').innerHTML = ''; }
  escape() { if (this.panel) this.closePanel(); else if (!this.modal && this.game) this.openPanel('menu'); }

  private frame(title: string, tabs: [string, string][], active: string, body: string, onTab: (t: string) => void) {
    const P = $('#panel');
    P.innerHTML = `<div class="sheet"><header><h2>${title}</h2><nav>${tabs.map(([k, l]) => `<button class="tab ${k === active ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</nav><button class="close" aria-label="Fermer">✕</button></header><div class="sbody">${body}</div></div>`;
    $('.close', P).addEventListener('click', () => this.closePanel());
    P.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.addEventListener('click', () => { audio.sfx('page'); onTab(b.dataset.t!); }));
    P.onpointerdown = (e) => { if (e.target === P) this.closePanel(); };
  }

  private renderPanel() {
    if (this.panel === 'atlas') this.renderAtlas();
    else if (this.panel === 'inventaire') this.renderInventory();
    else if (this.panel === 'journal') this.renderJournal();
    else if (this.panel === 'menu') this.renderMenu();
  }

  private renderAtlas() {
    const zones: ZoneId[] = (['clairval', 'bois', 'moulin'] as ZoneId[]).filter((z) => z === 'clairval' || S.discovered[z]);
    let body = '';
    if (this.atlasTab === 'carte') {
      body = `<div class="atlas-zones">${zones.map((z) => `<button class="chip ${z === this.atlasZone ? 'on' : ''}" data-z="${z}">${ZONE_LABEL[z]}</button>`).join('')}</div><div class="mapwrap"></div><div class="atlas-actions"><button class="btn primary" id="consult">${ICONS.atlas} Consulter l'atlas ici</button><span class="small">L'atlas révèle parfois ce que les yeux ne voient pas.</span></div>`;
    } else if (this.atlasTab === 'indices') {
      body = S.clues.length ? `<p class="small">Touchez un indice pour lire ce qu'Éloi en conclut.</p><ul class="cards clues">${S.clues.map((c) => { const tp = CLUE_TIPS[c]; const ok = !!(tp?.done && flag(tp.done)); return `<li class="${ok ? 'done' : ''}" data-clue="${c}"><b>${esc(CLUES[c]?.title ?? c)}${ok ? ' ✓' : ''}</b><p>${esc(CLUES[c]?.text ?? '')}</p>${tp ? `<div class="tip hidden"><span>Éloi :</span> ${esc(ok && tp.solved ? tp.solved : tp.tip)}</div>` : ''}</li>`; }).join('')}</ul>` : `<p class="empty">Aucun indice pour l'instant. Parlez aux habitants, examinez ce qui vous entoure.</p>`;
    } else {
      body = `<ul class="cards notes">${S.notes.map((n) => `<li><b>${esc(NOTES[n]?.title ?? n)}</b><p>${esc(NOTES[n]?.text ?? '')}</p></li>`).join('')}</ul><p class="small">Secrets découverts : ${S.secrets.length} / ${SECRETS_TOTAL}${S.secrets.length ? ' — ' + S.secrets.map((s) => SECRET_LABEL[s]).join(', ') : ''}</p>`;
    }
    this.frame("L'Atlas de Maëlys", [['carte', 'Carte'], ['indices', `Indices (${S.clues.length})`], ['notes', 'Annotations']], this.atlasTab, body, (t) => { this.atlasTab = t; this.renderAtlas(); });
    const P = $('#panel');
    P.querySelectorAll<HTMLElement>('.clues li').forEach((li) => li.addEventListener('click', () => { const t = li.querySelector('.tip'); if (!t) return; t.classList.toggle('hidden'); li.classList.toggle('open'); audio.sfx('page'); }));
    if (this.atlasTab === 'carte') {
      const wrap = $('.mapwrap', P);
      const here = S.zone === this.atlasZone;
      const cv = renderMap(this.atlasZone, 1600, { hero: here ? [S.x, S.y] : undefined });
      cv.className = 'map';
      wrap.appendChild(cv);
      wrap.insertAdjacentHTML('beforeend', '<div class="mapctl"><button class="cb" data-mz="+">＋</button><button class="cb" data-mz="-">−</button><button class="cb" data-mz="0" aria-label="Vue d\'ensemble">⤢</button></div>');
      requestAnimationFrame(() => this.mapPanZoom(wrap, cv));
      P.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => b.addEventListener('click', () => { this.atlasZone = b.dataset.z as ZoneId; this.renderAtlas(); }));
      $('#consult', P).addEventListener('click', () => { this.closePanel(); void this.game?.consultAtlas(); });
      if (!this.game) $('#consult', P).remove();
    }
  }

  /** Carte de l'atlas : glisser pour la parcourir, pincer / molette / boutons pour zoomer. */
  private mapPanZoom(wrap: HTMLElement, cv: HTMLCanvasElement) {
    const W = () => wrap.clientWidth, H = () => wrap.clientHeight;
    const fit = () => Math.min(W() / cv.width, H() / cv.height);
    let k = fit(), x = 0, y = 0;
    const clamp = () => {
      const cw = cv.width * k, ch = cv.height * k;
      x = cw <= W() ? (W() - cw) / 2 : Math.min(0, Math.max(W() - cw, x));
      y = ch <= H() ? (H() - ch) / 2 : Math.min(0, Math.max(H() - ch, y));
      cv.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    };
    const zoomAt = (f: number, cx: number, cy: number) => {
      const nk = Math.max(fit(), Math.min(fit() * 5, k * f));
      x = cx - (cx - x) * (nk / k); y = cy - (cy - y) * (nk / k); k = nk; clamp();
    };
    // centrer sur le héros s'il est dans cette zone
    const heroMark = S.zone === this.atlasZone;
    if (heroMark) { const z = __zoneSize(this.atlasZone); k = fit() * 2.2; x = W() / 2 - (S.x / z[0]) * cv.width * k; y = H() / 2 - (S.y / z[1]) * cv.height * k; }
    clamp();
    const pts = new Map<number, { x: number; y: number }>();
    let pinch0 = 0, k0 = 1;
    wrap.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('.mapctl')) return; wrap.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); k0 = k; } });
    wrap.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const r = wrap.getBoundingClientRect();
      if (pts.size === 2) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((k0 * d / pinch0) / k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); return; }
      x += e.clientX - p.x; y += e.clientY - p.y; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); clamp();
    });
    const end = (e: PointerEvent) => pts.delete(e.pointerId);
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('wheel', (e) => { e.preventDefault(); const r = wrap.getBoundingClientRect(); zoomAt(e.deltaY > 0 ? 0.85 : 1.18, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    wrap.querySelectorAll<HTMLButtonElement>('[data-mz]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.mz; if (v === '0') { k = fit(); clamp(); } else zoomAt(v === '+' ? 1.4 : 1 / 1.4, W() / 2, H() / 2); }));
  }

  private renderInventory() {
    const items = S.inventory;
    const sel = this.invSel && items.includes(this.invSel) ? this.invSel : null;
    const tiles = items.map((id) => `<button class="tile ${id === sel ? 'on' : ''} ${this.combineFrom === id ? 'comb' : ''}" data-i="${id}"><img src="${itemIcon(id, 64)}" alt=""><span>${esc(ITEMS[id]?.name ?? id)}${id === 'baume' ? ` ×${S.counters.baume ?? 0}` : ''}</span></button>`).join('');
    const d = sel ? ITEMS[sel] : null;
    const detail = d ? `<div class="detail"><img src="${itemIcon(sel!, 96)}" alt=""><div><h3>${esc(d.name)}</h3><p>${esc(d.desc)}</p><div class="row">${sel === 'atlas' ? `<button class="btn" data-a="atlas">Ouvrir</button>` : `<button class="btn primary" data-a="use">Utiliser</button>`}<button class="btn" data-a="comb">Combiner avec…</button></div>${this.combineFrom ? '<p class="small">Choisissez l\'objet à combiner.</p>' : ''}</div></div>` : `<div class="detail empty">Touchez un objet pour l'examiner.</div>`;
    this.frame('Sacoche', [['inv', `Objets (${items.length})`]], 'inv', `<div class="inv">${detail}<div class="tiles">${tiles}</div></div>`, () => {});
    const P = $('#panel');
    P.querySelectorAll<HTMLButtonElement>('.tile').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.i!;
      if (this.combineFrom && this.combineFrom !== id) {
        const ok = this.game?.combine(this.combineFrom, id);
        if (!ok) this.hint('Ces deux objets ne vont pas ensemble.');
        this.combineFrom = null; this.invSel = ok ? 'page_maelys' : id; this.renderInventory(); return;
      }
      audio.sfx('tap'); this.invSel = id; this.renderInventory();
    }));
    P.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a; const id = this.invSel!;
      if (a === 'use') { this.closePanel(); void this.game?.useItem(id); }
      if (a === 'atlas') { this.openPanel('atlas'); }
      if (a === 'comb') { this.combineFrom = id; this.renderInventory(); }
    }));
  }

  private renderJournal() {
    let body = '';
    const step = currentMainStep();
    if (this.journalTab === 'quete') {
      const done = MAIN.filter((m) => m.done());
      body = `<div class="quest-now">${step ? `<h3>${esc(step.title)}</h3><p>${esc(step.text())}</p>` : '<h3>Prologue terminé</h3><p>La route effacée est revenue. Les trois lieux restent à explorer : secrets, missions, habitants…</p>'}${step ? `<button class="btn" id="hintbtn">${ICONS.star} Un indice ?</button><div id="hintbox" class="hintbox"></div>` : ''}</div>
      <h4>Le Prologue — La Route effacée</h4><ol class="steps">${MAIN.map((m) => `<li class="${m.done() ? 'done' : m === step ? 'now' : 'todo'}">${m.done() || m === step ? esc(m.title) : '…'}</li>`).join('')}</ol>`;
      void done;
    } else if (this.journalTab === 'missions') {
      const qs = SIDE.filter((q) => q.started());
      body = qs.length ? `<ul class="cards">${qs.map((q) => `<li class="${q.done() ? 'done' : ''}"><b>${esc(q.title)}${q.done() ? ' ✓' : ''}</b><p>${esc(q.text())}</p>${!q.done() && q.tip ? `<div class="tip"><span>Conseil :</span> ${esc(q.tip())}</div>` : ''}</li>`).join('')}</ul>` : '<p class="empty">Aucune mission pour l\'instant. Certains habitants auraient bien besoin d\'aide…</p>';
    } else if (this.journalTab === 'habitants') {
      const known = MAIN_NPCS.filter((id) => flag('met_' + id) || flag('t_' + id));
      body = `<p class="small">Où trouver les habitants, à cette heure-ci (${PHASE_LABEL[phaseNow()]}) :</p><ul class="people">${MAIN_NPCS.map((id) => {
        const p = ROUTINES[id as NpcId]();
        const met = known.includes(id);
        const where = p ? `${ZONE_LABEL[p.zone]} — ${p.where}` : 'introuvable pour l\'instant';
        return `<li class="${met ? '' : 'unk'}"><img src="${this.portraitOf(id, 'neutre')}" alt=""><div><b>${met ? DIALOGS[id].name : '???'}</b><span>${met ? DIALOGS[id].role : 'Pas encore rencontré'}</span><em>${met || id === 'agathe' || (id !== 'anton') ? esc(where) : 'Disparu'}</em></div></li>`;
      }).join('')}</ul>`;
    } else {
      body = S.log.length ? `<ul class="log">${[...S.log].reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="empty">La chronique de votre voyage s\'écrira ici.</p>';
    }
    this.frame('Journal de route', [['quete', 'Quête'], ['missions', 'Missions'], ['habitants', 'Habitants'], ['chronique', 'Chronique']], this.journalTab, body, (t) => { this.journalTab = t; this.renderJournal(); });
    const hb = document.getElementById('hintbtn');
    hb?.addEventListener('click', () => {
      if (!step) return;
      const n = Math.min(step.hints.length, (S.hints[step.id] ?? 0) + 1);
      S.hints[step.id] = n;
      $('#hintbox').innerHTML = step.hints.slice(0, n).map((t, i) => `<p><b>Indice ${i + 1}.</b> ${esc(hintText(t))}</p>`).join('') + (n >= step.hints.length ? '' : '<p class="small">Touchez encore pour un indice plus précis.</p>');
      audio.sfx('page');
    });
    if (step && S.hints[step.id] && hb) { const n = S.hints[step.id]; $('#hintbox').innerHTML = step.hints.slice(0, n).map((t, i) => `<p><b>Indice ${i + 1}.</b> ${esc(hintText(t))}</p>`).join(''); }
  }

  private renderMenu(sub: 'main' | 'save' | 'load' | 'options' = 'main') {
    let body = '';
    if (sub === 'main') {
      const fight = this.game?.isEngaged();
      body = `<div class="menu-list">
        <button class="btn big" data-m="resume">Reprendre</button>
        <button class="btn big" data-m="save" ${fight ? 'disabled' : ''}>Sauvegarder${fight ? ' (impossible en combat)' : ''}</button>
        <button class="btn big" data-m="load">Charger une partie</button>
        <button class="btn big" data-m="options">Options</button>
        <button class="btn big" data-m="fs">Plein écran</button>
        <button class="btn big" data-m="home">Retour à l'accueil</button></div>`;
    } else if (sub === 'save' || sub === 'load') body = this.slotsHtml(sub);
    else body = this.optionsHtml();
    this.frame('Menu', [['main', 'Pause'], ['save', 'Sauvegarder'], ['load', 'Charger'], ['options', 'Options']], sub, body, (t) => this.renderMenu(t as any));
    const P = $('#panel');
    P.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'resume') this.closePanel();
      if (m === 'save') this.renderMenu('save');
      if (m === 'load') this.renderMenu('load');
      if (m === 'options') this.renderMenu('options');
      if (m === 'fs') toggleFullscreen();
      if (m === 'home') { if (this.game) this.game.save('quit'); this.closePanel(); this.onQuitToHome?.(); }
    }));
    if (sub === 'save' || sub === 'load') this.bindSlots(P, sub);
    if (sub === 'options') this.bindOptions(P);
  }

  slotsHtml(mode: 'save' | 'load' | 'new') {
    return `<div class="slots">${listSlots().map((s) => {
      const st = s.state;
      const info = st ? `<b>${esc(ZONE_LABEL[st.zone])}</b><span>${esc(stepTitle(st))}</span><em>${fmtTime(st.playTime)} · ${new Date(st.updated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${s.fromBackup ? ' · copie de secours' : ''}</em>` : `<b>Emplacement libre</b>${s.corrupted ? '<span class="warn">Sauvegarde illisible</span>' : ''}`;
      const actions = mode === 'save' ? `<button class="btn primary" data-s="${s.slot}" data-a="save">${st ? 'Écraser' : 'Sauvegarder ici'}</button>` : mode === 'load' ? (st ? `<button class="btn primary" data-s="${s.slot}" data-a="load">Charger</button><button class="btn ghost" data-s="${s.slot}" data-a="del">Supprimer</button>` : '') : `<button class="btn primary" data-s="${s.slot}" data-a="new">${st ? 'Remplacer' : 'Commencer ici'}</button>`;
      return `<div class="slot ${st ? '' : 'free'}"><div class="sn">${s.slot + 1}</div><div class="si">${info}</div><div class="sa">${actions}</div></div>`;
    }).join('')}</div><p class="small">Les parties sont enregistrées sur cet appareil. Sauvegarde automatique aux étapes importantes et à chaque changement de lieu.</p>`;
  }

  bindSlots(P: HTMLElement, mode: 'save' | 'load' | 'new') {
    P.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      const i = Number(b.dataset.s), a = b.dataset.a;
      if (a === 'save') { if (this.game) { this.game.slot = i; writeSlot(i, S); this.settings.lastSlot = i; saveSettings(this.settings); this.toast(`Partie sauvegardée (emplacement ${i + 1})`, 'info'); this.renderMenu('save'); } }
      if (a === 'load') { this.closePanel(); this.home?.onLoad(i); }
      if (a === 'del') { if (await this.confirm('Supprimer définitivement cette partie ?')) { deleteSlot(i); mode === 'load' && this.panel === 'menu' ? this.renderMenu('load') : this.showSlots('load'); } }
      if (a === 'new') { const st = listSlots()[i].state; if (!st || (await this.confirm('Remplacer cette partie par une nouvelle aventure ?'))) { this.closePanel(); this.hideHome(); this.home?.onNew(i); } }
    }));
  }

  confirm(msg: string): Promise<boolean> {
    return new Promise((res) => {
      const el = h(`<div class="confirm"><div class="cbox"><p>${esc(msg)}</p><div class="row"><button class="btn primary" data-v="1">Oui</button><button class="btn" data-v="0">Non</button></div></div></div>`);
      this.root.appendChild(el);
      el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { el.remove(); res(b.dataset.v === '1'); }));
    });
  }

  optionsHtml() {
    const s = this.settings;
    const sel = (k: keyof Settings, opts: [string, string][]) => `<div class="seg" data-k="${k}">${opts.map(([v, l]) => `<button class="${s[k] === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
    return `<div class="options">
      <label>Qualité graphique</label>${sel('quality', [['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute']])}
      <p class="small">Finesse des dessins et quantité d'animations d'ambiance. La finesse s'applique au prochain démarrage du jeu.</p>
      <label>Musique <output>${Math.round(s.music * 100)} %</output></label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-r="music">
      <label>Sons <output>${Math.round(s.sfx * 100)} %</output></label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-r="sfx">
      <label>Vitesse des dialogues</label>${sel('textSpeed', [['lente', 'Lente'], ['normale', 'Normale'], ['rapide', 'Rapide'], ['instantanee', 'Instantanée']])}
      <label>Difficulté des combats</label>${sel('combat', [['exploration', 'Exploration'], ['facile', 'Facile'], ['normale', 'Normale'], ['difficile', 'Difficile']])}
      <p class="small">« Exploration » : les créatures ne blessent pas. Les énigmes ne changent pas.</p>
      <label>Mises à jour</label><div class="row"><button class="btn" id="upd">Rechercher les mises à jour</button><span id="updmsg" class="small"></span></div>
      <p class="version">Les Chemins Oubliés — version ${__APP_VERSION__} (build ${__APP_BUILD__})</p></div>`;
  }

  bindOptions(P: HTMLElement) {
    P.querySelectorAll<HTMLElement>('.seg').forEach((seg) => seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
      (this.settings as any)[seg.dataset.k!] = b.dataset.v;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      this.commitSettings();
    })));
    P.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((r) => r.addEventListener('input', () => {
      (this.settings as any)[r.dataset.r!] = Number(r.value);
      (r.previousElementSibling!.querySelector('output') as HTMLElement).textContent = Math.round(Number(r.value) * 100) + ' %';
      this.commitSettings();
    }));
    $('#upd', P)?.addEventListener('click', () => void this.checkUpdates($('#updmsg', P)));
  }

  private commitSettings() { saveSettings(this.settings); audio.setVolumes(this.settings.music, this.settings.sfx); this.applyQuality(); this.game?.settingsChanged(this.settings); this.onSettings?.(this.settings); }
  private applyQuality() { document.body.dataset.q = this.settings.quality; }

  async checkUpdates(msg: HTMLElement) {
    msg.textContent = 'Recherche…';
    try {
      const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
      const v = await r.json();
      if (this.swReg) await this.swReg.update().catch(() => {});
      const waiting = this.swReg?.waiting;
      if (v.build && v.build !== __APP_BUILD__) {
        msg.innerHTML = `Nouvelle version disponible (${esc(v.version)}, build ${esc(String(v.build))}). `;
        const b = h(`<button class="btn primary">Activer et redémarrer</button>`);
        b.addEventListener('click', () => this.activateUpdate());
        msg.appendChild(b);
        if (!waiting) msg.appendChild(h('<span> (téléchargement en cours…)</span>'));
      } else msg.textContent = `Vous avez la dernière version (${__APP_VERSION__}).`;
    } catch { msg.textContent = 'Impossible de vérifier (hors ligne ?). Le jeu reste jouable.'; }
  }

  activateUpdate() {
    if (this.game) this.game.save('update');
    const w = this.swReg?.waiting;
    if (w) { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); w.postMessage('skipWaiting'); setTimeout(() => location.reload(), 4000); }
    else location.reload();
  }

  // ------------------------------------------------------------ accueil
  showHome(h0: HomeHandlers) {
    this.home = h0;
    const H = $('#home');
    const canInstall = !!this.installEvt || isIos();
    H.innerHTML = `<div class="title-wrap"><img class="logo" src="./icons/icon-192.png" alt=""><h1><span class="t1">Les</span><span class="t2">Chemins Oubliés</span></h1><div class="subtitle">Prologue — La Route effacée</div></div>
      <div class="home-menu">
        ${h0.canContinue() ? '<button class="btn big primary" data-h="continue">Continuer</button>' : ''}
        <button class="btn big ${h0.canContinue() ? '' : 'primary'}" data-h="new">Nouvelle partie</button>
        <button class="btn big" data-h="load">Charger une partie</button>
        <button class="btn big" data-h="options">Options</button>
        <button class="btn big" data-h="credits">Crédits</button>
        ${canInstall ? '<button class="btn big install" data-h="install">Installer le jeu</button>' : ''}
      </div>
      <div class="home-foot">JLG Creative · version ${__APP_VERSION__} · build ${__APP_BUILD__}</div>`;
    H.classList.remove('hidden');
    $('#hud').classList.add('hidden');
    H.querySelectorAll<HTMLButtonElement>('[data-h]').forEach((b) => b.addEventListener('click', () => {
      audio.unlock(); audio.sfx('tap');
      const a = b.dataset.h;
      if (a === 'continue') { this.hideHome(); h0.onContinue(); }
      if (a === 'new') this.showSlots('new');
      if (a === 'load') this.showSlots('load');
      if (a === 'options') this.showSheet('Options', this.optionsHtml(), (P) => this.bindOptions(P));
      if (a === 'credits') this.showSheet('Crédits', CREDITS, () => {});
      if (a === 'install') void this.install();
    }));
    this.renderPortraitWarn();
  }
  hideHome() { $('#home').classList.add('hidden'); }

  private showSheet(title: string, body: string, bind: (P: HTMLElement) => void) {
    this.panel = 'menu';
    const P = $('#panel');
    P.innerHTML = `<div class="sheet"><header><h2>${title}</h2><nav></nav><button class="close" aria-label="Fermer">✕</button></header><div class="sbody">${body}</div></div>`;
    $('.close', P).addEventListener('click', () => this.closePanel());
    P.classList.remove('hidden');
    bind(P);
  }
  showSlots(mode: 'new' | 'load') {
    this.showSheet(mode === 'new' ? 'Nouvelle partie' : 'Charger une partie', (mode === 'new' ? '<p>Choisissez un emplacement pour votre aventure.</p>' : '') + this.slotsHtml(mode), (P) => this.bindSlots(P, mode));
  }

  async install() {
    if (this.installEvt) { this.installEvt.prompt(); const r = await this.installEvt.userChoice.catch(() => null); if (r?.outcome === 'accepted') this.toast('Installation en cours…', 'info'); this.installEvt = null; return; }
    this.showSheet('Installer le jeu', `<p>Sur iPhone et iPad : touchez le bouton <b>Partager</b> de Safari, puis <b>« Sur l'écran d'accueil »</b>.</p><p>Le jeu s'ouvrira ensuite en plein écran et fonctionnera hors ligne.</p>`, () => {});
  }

  private renderPortraitWarn() {
    const b = $('#portrait-warn .pw-btns');
    if (!b) return;
    b.innerHTML = this.game ? `<button class="btn" data-p="journal">Journal</button><button class="btn" data-p="atlas">Atlas</button><button class="btn" data-p="inventaire">Sacoche</button><button class="btn" data-p="menu">Menu</button><button class="btn primary" data-fs="1">Plein écran</button>` : `<button class="btn primary" data-fs="1">Plein écran (paysage)</button>`;
    b.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((x) => x.addEventListener('click', () => this.openPanel(x.dataset.p as PanelName)));
    b.querySelector<HTMLButtonElement>('[data-fs]')?.addEventListener('click', () => toggleFullscreen(true));
  }
  refreshPortraitWarn() { this.renderPortraitWarn(); }

  chapterEnd(): Promise<void> {
    return new Promise((res) => {
      const done = SIDE.filter((q) => q.done()).length;
      const el = h(`<div class="chapter-end"><div class="ce-box"><div class="ornament"></div><h2>Fin du Prologue</h2><h3>La Route effacée</h3>
        <p>La route du Moulin des Trois-Eaux est revenue sur les cartes… et dans les mémoires. Mais au-delà de la brume, vers les Hautes Terres de Brumecime, Maëlys a laissé une autre piste.</p>
        <p class="next">À suivre : <b>Chapitre II — Les Voix des bois</b> (non disponible dans cette version).</p>
        <ul><li>Temps de jeu : ${fmtTime(S.playTime)}</li><li>Missions accomplies : ${done} / ${SIDE.length}</li><li>Secrets découverts : ${S.secrets.length} / ${SECRETS_TOTAL}</li><li>Indices recueillis : ${S.clues.length}</li></ul>
        <button class="btn big primary">Continuer à explorer</button></div></div>`);
      this.root.appendChild(el);
      this.modal++;
      const btn = el.querySelector('button')!;
      // même protection que pour les choix : le toucher qui termine le dernier dialogue ne doit pas fermer cet écran
      let armed = false;
      btn.addEventListener('pointerdown', () => { armed = true; });
      btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') armed = true; });
      btn.addEventListener('click', (e) => { if (!armed && e.detail !== 0) return; el.remove(); this.modal--; res(); });
    });
  }
}

function phaseNow(): Phase { const x = (S.clock % 1440) / 60; return x >= 6 && x < 12 ? 'matin' : x >= 12 && x < 18 ? 'apresmidi' : x >= 18 && x < 22 ? 'soir' : 'nuit'; }
function fmtTime(s: number) { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; }
function stepTitle(st: any) {
  if (st.chapterDone || st.flags?.chapter_done) return 'Prologue terminé';
  const order: [string, string][] = [['route', 'mill_running'], ['roue', 'brake_released'], ['moulin', 'stones_solved'], ['pierres', 'anton_found'], ['anton', 'theo_ok'], ['bois', 'bornes_solved'], ['bornes', 't_basile'], ['temoins', 'agathe_moulin'], ['agathe', 'borne_vue']];
  for (const [id, f] of order) if (st.flags?.[f]) return MAIN.find((q) => q.id === id)!.title;
  return MAIN[0].title;
}
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone; }
export function toggleFullscreen(lock = false) {
  const d = document as any;
  if (!d.fullscreenElement) { document.documentElement.requestFullscreen?.().then(() => { if (lock) (screen.orientation as any)?.lock?.('landscape').catch(() => {}); }).catch(() => {}); }
  else document.exitFullscreen?.();
}

const CREDITS = `<div class="credits"><h3>Les Chemins Oubliés — Prologue : La Route effacée</h3><p>Une production <b>JLG Creative</b>.</p>
<p>Direction, univers et scénario : JLG Creative.<br>Développement, illustrations procédurales, animations et musique synthétisée : réalisés avec Claude (Anthropic).</p>
<p>Moteur : Phaser 3 · Langage : TypeScript · Construction : Vite · Police : Alegreya (SIL Open Font License).</p>
<p>Tous les personnages, lieux et événements sont fictifs.</p></div>`;

export const ui = new UIManager();
void has;
