import { useEffect, useRef, useState } from 'react';
import { SPEEDS } from '../game';
import { calendar, dateLabel } from '../sim/calendar';
import { remaining, totalEnvelope, totalSpent } from '../sim/finance';
import { isOnDuty } from '../sim/staff';
import { eur, useGame } from './common';
import { Logo } from './Logo';
import { Panels } from './Panels';

const NAV: [string, string, string][] = [
  ['station', '🏢', 'Commissariat'],
  ['city', '🗺️', 'Carte'],
  ['cases', '📁', 'Affaires'],
  ['staffList', '🕵️', 'Enquêteurs'],
  ['units', '👥', 'Unités'],
  ['planning', '📅', 'Planning'],
  ['lab', '🔬', 'Laboratoire'],
  ['board', '📌', 'Tableau'],
  ['justice', '⚖️', 'Justice'],
  ['recruit', '🤝', 'Recrutement'],
  ['training', '🎓', 'Formation'],
  ['equipment', '🚓', 'Équipements'],
  ['build', '🏗️', 'Construction'],
  ['budget', '💶', 'Budget'],
  ['stats', '📊', 'Statistiques'],
  ['archives', '🗄️', 'Archives'],
  ['media', '📰', 'Médias'],
  ['settings', '⚙️', 'Options'],
];

const MAIN = ['station', 'city', 'cases', 'staffList'];
const WEATHER: Record<string, string> = { clair: '☀️', nuageux: '⛅', pluie: '🌧️', orage: '⛈️', neige: '❄️', brouillard: '🌫️' };

export function GameScreen({ onQuit }: { onQuit: () => void }) {
  const [g, st] = useGame();
  const host = useRef<HTMLDivElement>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (host.current) g.mount(host.current);
    return () => g.unmount();
  }, [g]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); g.setSpeed(g.speed ? 0 : 1); }
      if (['1', '2', '3', '4'].includes(e.key)) g.setSpeed(SPEEDS[Number(e.key)]);
      if (e.key === 'Escape') g.back();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [g]);
  const cal = calendar(st.startYear, st.minute);
  const onDuty = st.staff.filter((s) => isOnDuty(s, st)).length;
  const urgent = st.cases.filter((c) => c.status === 'ouverte' && c.priority === 1).length;
  const unassigned = st.cases.filter((c) => c.status === 'ouverte' && !c.lead).length;
  const unread = st.notices.filter((n) => !n.read).length;
  const proposals = st.cases.reduce((s, c) => s + c.actions.filter((a) => !a.approved).length, 0);
  const left = totalEnvelope(st.budget) - totalSpent(st.budget);
  const open = st.cases.filter((c) => c.status === 'ouverte').length;
  const active = st.events.filter((e) => e.start <= st.minute && e.end > st.minute);
  const nav = (id: string) => {
    if (id === 'station' || id === 'city') { g.setScreen(id); g.close(); return; }
    if (id === 'build') { g.open({ id: 'build' }); return; }
    if (g.panel?.id === id) g.close(); else { g.history = []; g.open({ id }); }
  };
  const lowCat = Object.keys(st.budget.envelope).some((k) => remaining(st.budget, k as never) < 0);
  return (
    <div className="game">
      <div id="canvas-host" ref={host} />
      <header className="hud">
        <div className="hud-id">
          <Logo className="brand" compact />
          <div className="date" title={dateLabel(st.startYear, st.minute)}>
            <b>{String(cal.hour).padStart(2, '0')}:{String(cal.min).padStart(2, '0')} · {['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][cal.weekday]} {cal.day}/{String(cal.month + 1).padStart(2, '0')}/{cal.year}</b>
            <span>{WEATHER[st.weather.kind]} {st.weather.temp} °C · {st.city.name}</span>
          </div>
        </div>
        <div className="grp speeds" role="group" aria-label="Vitesse">
          {SPEEDS.map((s) => <button key={s} className={`sp ${g.speed === s ? 'on' : ''}`} onClick={() => g.setSpeed(s)} title={s ? `Vitesse ×${s}` : 'Pause'}>{s ? `×${s}` : '❚❚'}</button>)}
        </div>
        <div className="grp skips">
          <button className="sp" onClick={() => g.advanceHour()} title="Avancer d'une heure">+1h</button>
          <button className="sp" onClick={() => g.advanceNext()} title="Avancer jusqu'au prochain événement">⏭</button>
          <button className="sp" onClick={() => g.advanceDay()} title="Simuler la journée (jusqu'au lendemain 8 h)">☀<span className="lbl"> Jour</span></button>
        </div>
        <div className="kpis">
          <div className={`kpi ${left < 0 || lowCat ? 'bad' : left < totalEnvelope(st.budget) * 0.15 ? 'warn' : ''}`} onClick={() => nav('budget')} title="Crédits de fonctionnement restants"><b>{left >= 100000 ? `${Math.round(left / 1000)} k€` : eur(left)}</b><span>Budget</span></div>
          <div className="kpi opt" onClick={() => nav('planning')} title="Personnels en service / effectif total"><b>{onDuty}/{st.staff.length}</b><span>En service</span></div>
          <div className={`kpi ${urgent ? 'bad' : ''}`} onClick={() => nav('cases')} title="Affaires urgentes"><b>{urgent}</b><span>Urgentes</span></div>
          <div className={`kpi ${unassigned ? 'warn' : ''}`} onClick={() => nav('cases')} title="Affaires ouvertes (non attribuées)"><b>{open}{unassigned ? `·${unassigned}` : ''}</b><span>Dossiers</span></div>
          {proposals > 0 && <div className="kpi warn" onClick={() => nav('cases')} title="Propositions des enquêteurs à valider"><b>{proposals}</b><span>À valider</span></div>}
          <div className="kpi opt" onClick={() => nav('lab')} title="Analyses en attente"><b>{st.lab.queue.length}</b><span>Labo</span></div>
          {active.length > 0 && <div className="kpi warn opt" title={active.map((e) => `${e.title} : ${e.text}`).join('\n')} onClick={() => nav('media')}><b>⚡{active.length}</b><span>Événements</span></div>}
        </div>
        <div className="hud-icons">
          <button className="icon-btn" onClick={() => g.open({ id: 'search' })} title="Recherche globale" aria-label="Recherche globale">🔍</button>
          <button className="icon-btn" onClick={() => { setShowNotes(!showNotes); }} title="Notifications" aria-label="Notifications">🔔{unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}</button>
        </div>
      </header>
      <nav className="nav" aria-label="Menus">
        {NAV.map(([id, ic, l]) => (
          <button key={id} className={`${MAIN.includes(id) ? 'main' : 'more'} ${(g.panel?.id === id || (!g.panel && g.screen === id)) ? 'on' : ''}`} onClick={() => nav(id)}><span className="ic">{ic}</span><span className="tx">{l}</span></button>
        ))}
        <button className={`main menu-btn ${menu ? 'on' : ''}`} onClick={() => setMenu(!menu)}><span className="ic">☰</span><span className="tx">Menu</span></button>
      </nav>
      {menu && (
        <div className="menu-sheet" role="dialog" aria-label="Tous les menus" onClick={() => setMenu(false)}>
          <div className="menu-grid" onClick={(e) => e.stopPropagation()}>
            {NAV.map(([id, ic, l]) => <button key={id} className={(g.panel?.id === id || (!g.panel && g.screen === id)) ? 'on' : ''} onClick={() => { setMenu(false); nav(id); }}><span className="ic">{ic}</span>{l}</button>)}
          </div>
        </div>
      )}
      {g.screen === 'station' && !g.panel && <div className="floors">
        {Array.from({ length: st.station.floors }, (_, f) => <button key={f} className={`btn ${g.station?.floor === f ? 'on' : ''}`} onClick={() => g.setFloor(f)}>{f === 0 ? 'Rez-de-chaussée' : `Étage ${f}`}</button>)}
        <button className="btn" onClick={() => { if (g.station) { g.station.showLabels = !g.station.showLabels; g.bump(true); } }}>{g.station?.showLabels ? 'Masquer les noms' : 'Noms des pièces'}</button>
      </div>}
      {g.screen === 'city' && !g.panel && <div className="floors"><span className="hint">📍 Marqueur = affaire · bâtiment = horaires</span></div>}
      <Panels onQuit={onQuit} />
      {showNotes && <Notices close={() => setShowNotes(false)} />}
      {g.toast && <div className="toast" role="status">{g.toast.text}</div>}
    </div>
  );
}

function Notices({ close }: { close: () => void }) {
  const [g, st] = useGame();
  const list = [...st.notices].reverse().slice(0, 80);
  return (
    <div className="notices" role="dialog" aria-label="Notifications">
      <div className="panel-head"><h2 style={{ fontSize: 16 }}>Notifications</h2>
        <button className="btn small" onClick={() => { g.mutate((s) => s.notices.forEach((n) => (n.read = true))); }}>Tout marquer lu</button>
        <button className="back" onClick={close}>✕</button></div>
      {list.map((n) => (
        <div key={n.id} className={`notice ${n.level}`} style={{ opacity: n.read ? 0.65 : 1 }} onClick={() => {
          n.read = true;
          if (n.caseId) g.open({ id: 'case', arg: n.caseId });
          else if (n.staffId) g.open({ id: 'staff', arg: n.staffId });
          close();
        }}>
          <span>{n.level === 'urgent' ? '🚨' : n.level === 'alerte' ? '⚠️' : n.level === 'succes' ? '✅' : 'ℹ️'}</span>
          <div><div className="muted" style={{ fontSize: 11 }}>{dateLabel(st.startYear, n.minute)}</div>{n.text}</div>
        </div>
      ))}
    </div>
  );
}
