// Tutoriel de prise en main (pas à pas, avec repérage visuel) et guide consultable à tout moment.
import { useEffect, useState } from 'react';
import type { Game } from '../game';
import type { GameState } from '../sim/types';
import { sfx } from '../audio/audio';
import { PanelShell, useGame } from './common';

interface Step {
  title: string;
  text: string;
  target?: string; // sélecteur CSS de l'élément à mettre en évidence
  nav?: string; // rubrique du menu à mettre en évidence
  check?: (g: Game, st: GameState) => boolean; // étape validée automatiquement
  hint?: string;
}

const openCase = (g: Game, st: GameState) => (g.panel?.id === 'case' ? st.cases.find((c) => c.id === g.panel!.arg) : undefined);

export const STEPS: Step[] = [
  { title: 'Bienvenue, commandant', text: 'Vous dirigez une brigade de police judiciaire. Votre rôle : répartir les affaires, guider les enquêtes, gérer l\'équipe, le budget et les relations avec la justice, la presse et les partenaires. Ce guide vous accompagne pendant les premières minutes.' },
  { title: 'Le temps', text: 'Le jeu avance par pas de 10 minutes. Mettez en pause (❚❚ ou barre d\'espace) pour réfléchir, puis accélérez (×1 à ×10). Les boutons +1h, ⏭ et ☀ font avancer jusqu\'à un moment précis.', target: '[data-tuto="speeds"]', hint: 'Choisissez une vitesse pour continuer.', check: (g) => g.speed > 0 },
  { title: 'Votre commissariat', text: 'La vue isométrique montre chaque personne au travail. Faites glisser pour vous déplacer, pincez ou utilisez la molette pour zoomer, touchez un personnage pour ouvrir sa fiche ou une pièce pour voir son rôle.' },
  { title: 'Les affaires', text: 'Ouvrez la liste des affaires. Les dossiers urgents et non attribués sont signalés dans la barre du haut.', nav: 'cases', check: (g) => g.panel?.id === 'cases' || g.panel?.id === 'case' },
  { title: 'Ouvrir un dossier', text: 'Touchez une affaire pour ouvrir son dossier : signalement, étapes de l\'enquête, personnes, pièces et journal.', target: '.panel .t tbody tr', check: (g) => g.panel?.id === 'case' },
  { title: 'Attribuer le dossier', text: 'Dans « Synthèse », choisissez un responsable et son équipe (la suggestion de l\'adjoint est un bon départ : « Reprendre »), puis « Valider l\'attribution ». Tenez compte de la charge et des compétences de chacun.', target: '.panel .btn.primary', check: (g, st) => !!openCase(g, st)?.lead },
  { title: 'Diriger l\'enquête', text: 'Onglet « Investigations » : approuvez les pistes proposées par vos enquêteurs, ou confiez vous-même une action (constatations, enquête de voisinage, recherches, réquisitions, laboratoire…). Certaines exigent l\'autorisation d\'un magistrat.', check: (_g, st) => st.cases.some((c) => c.status === 'ouverte' && c.actions.some((a) => a.approved)) },
  { title: 'Le tableau d\'enquête', text: 'L\'onglet « Tableau d\'enquête » relie personnes, pièces et informations. Les contradictions apparaissent en rouge. Ajoutez vos notes et hypothèses ; zoomez et déplacez-vous au doigt.', check: () => !!document.querySelector('.board-wrap, .board') },
  { title: 'Entretiens et auditions', text: 'Dans « Personnes », vous pouvez mener vous-même un entretien : choisissez l\'approche (écoute, questions ouvertes, chronologie, confrontation…). La nervosité n\'est pas un aveu : comparez les déclarations aux faits.' },
  { title: 'Laboratoire et justice', text: 'Les pièces saisies partent au laboratoire (délais selon l\'époque et la file d\'attente). Quand les preuves concordent, transmettez au parquet. Désigner un innocent ou bâcler la procédure coûte cher au procès.' },
  { title: 'Votre équipe', text: 'Fatigue, moral, compétences et relations comptent. Ouvrez la liste des enquêteurs pour voir qui est surchargé. Le planning gère les équipes de jour et de nuit, les congés et les astreintes.', nav: 'staffList', check: (g) => g.panel?.id === 'staffList' || g.panel?.id === 'staff' },
  { title: 'Le budget', text: 'Chaque poste (véhicules, laboratoires, formation…) a son enveloppe annuelle. Les dépassements pèsent sur votre évaluation. Vous pouvez demander des moyens supplémentaires, en les justifiant.', nav: 'budget', check: (g) => g.panel?.id === 'budget' },
  { title: 'Les partenaires', text: 'Le médecin légiste, la gendarmerie, le maire, l\'hôpital, les services sociaux et les banques sont des interlocuteurs réels : ils vous sollicitent, et vous pouvez leur demander un appui sur une affaire. Rendre service améliore la relation… mais mobilise vos agents.', nav: 'partners', check: (g) => g.panel?.id === 'partners' },
  { title: 'Construire et aménager', text: 'Le menu Construction permet d\'ajouter des pièces (en L si besoin), de les déplacer, de tourner et d\'ajouter des meubles. Une démolition rembourse 60 % du prix. Agrandissez le terrain quand la place manque.', nav: 'build', check: (g) => g.panel?.id === 'build' },
  { title: 'La ville', text: 'La carte montre la ville en temps réel : circulation, feux, passants, et les personnes liées à vos affaires (repérées par une étiquette). Les marqueurs 📍 ouvrent les dossiers.', nav: 'city', check: (g) => g.screen === 'city' },
  { title: 'À vous de jouer', text: 'Le menu « Guide » (❓) résume tout cela et permet de relancer ce tutoriel. Le niveau d\'assistance se change dans Options. Au fil des années, véhicules, techniques, tenues et musiques évoluent ; votre carrière peut vous mener jusqu\'au pilotage national. Bonne enquête !' },
];

export function Tutorial() {
  const [g, st] = useGame();
  const t = st.tutorial;
  const step = t?.on ? STEPS[t.step] : undefined;
  const [collapsed, setCollapsed] = useState(false);
  const [top, setTop] = useState(false);
  // mise en évidence de l'élément visé
  useEffect(() => {
    if (!step) return;
    const sels = [step.target, step.nav ? `[data-nav="${step.nav}"]` : '', step.nav && !['station', 'city', 'cases', 'staffList'].includes(step.nav) ? '.menu-btn' : ''].filter(Boolean).join(',');
    const mark = () => {
      if (sels) document.querySelectorAll(sels).forEach((el, i) => { if (i < 3 || !step.target) el.classList.add('tuto-hl'); });
      // la fiche du tutoriel se place à l'opposé de l'élément à toucher, pour ne jamais le masquer
      const el = document.querySelector('.tuto-hl');
      if (document.querySelector('.build-bar')) setTop(true);
      else if (el) { const r = el.getBoundingClientRect(); setTop(r.top + r.height / 2 > window.innerHeight * 0.5); }
      else setTop(false);
    };
    mark();
    const id = window.setInterval(mark, 600);
    return () => { clearInterval(id); document.querySelectorAll('.tuto-hl').forEach((el) => el.classList.remove('tuto-hl')); };
  });
  // validation automatique de l'étape
  useEffect(() => {
    if (!step?.check || !t) return;
    if (step.check(g, st)) {
      const id = window.setTimeout(() => { g.mutate((s) => { if (s.tutorial && s.tutorial.step === t.step) s.tutorial.step++; }); sfx('success'); }, 700);
      return () => clearTimeout(id);
    }
  });
  if (!step || !t) return null;
  const last = t.step === STEPS.length - 1;
  const next = () => g.mutate((s) => { if (!s.tutorial) return; if (last) s.tutorial.on = false; else s.tutorial.step++; });
  if (collapsed) return <button className={`tuto-pill ${top ? 'top' : ''}`} onClick={() => setCollapsed(false)}>❓ Tutoriel {t.step + 1}/{STEPS.length}</button>;
  return (
    <div className={`tuto ${top ? 'top' : ''}`} role="dialog" aria-label="Tutoriel">
      <div className="row between"><span className="muted">Prise en main · {t.step + 1}/{STEPS.length}</span><button className="back" onClick={() => setCollapsed(true)} title="Réduire">▾</button></div>
      <div className="tuto-bar"><i style={{ width: `${((t.step + 1) / STEPS.length) * 100}%` }} /></div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      {step.check && step.hint && <p className="muted">{step.hint}</p>}
      {step.check && !step.hint && <p className="muted">👉 Faites l'action indiquée : l'étape se valide d'elle-même.</p>}
      <div className="row between">
        <button className="btn small" onClick={() => g.mutate((s) => { if (s.tutorial) s.tutorial.on = false; })}>Passer le tutoriel</button>
        <div className="row">
          {t.step > 0 && <button className="btn small" onClick={() => g.mutate((s) => { if (s.tutorial) s.tutorial.step--; })}>←</button>}
          <button className="btn small primary" onClick={next}>{last ? 'Terminer' : step.check ? 'Passer cette étape' : 'Suivant'}</button>
        </div>
      </div>
    </div>
  );
}

const GUIDE: [string, string[]][] = [
  ['Objectif', ['Diriger la brigade sur la durée : élucider les affaires sans désigner d\'innocent, respecter la procédure, garder une équipe motivée, tenir le budget et la confiance du public.', 'Chaque 1er janvier, la hiérarchie vous évalue ; de bonnes évaluations ouvrent l\'avancement (six échelons, jusqu\'au pilotage national).']],
  ['Cycle d\'une enquête', ['Signalement → attribution → constatations → recherches → entretiens → examens → hypothèses → identification → transmission au parquet → jugement.', 'La vérité est fixée dès l\'apparition de l\'affaire : vos enquêteurs ne peuvent que la découvrir. Certaines affaires n\'en sont pas (accident, départ volontaire, fausse déclaration).', 'Le déroulement varie : témoin qui ment pour couvrir quelqu\'un, piste montée de toutes pièces, auteur en fuite, série d\'affaires liées, preuve qui se dégrade, aveux rétractés…']],
  ['Preuves et procédure', ['Un faisceau solide combine éléments matériels (analyses, documents) et déclarations recoupées. Les contradictions sont des pistes, pas des preuves.', 'Les perquisitions, réquisitions et gardes à vue exigent l\'accord d\'un magistrat. Un scellé non conforme ou une irrégularité peut faire tomber un dossier.']],
  ['Équipe', ['Chaque personne a 18 compétences, une personnalité, de la fatigue et du moral. La surcharge ralentit tout et use les équipes.', 'Formations, avancement, recrutement : les décisions humaines comptent autant que les enquêtes.']],
  ['Partenaires', ['Légiste, gendarmerie, mairie, hôpital, services sociaux, banques et opérateurs : solliciter un appui accélère une enquête, mais coûte de la relation ; répondre à leurs demandes la reconstruit.', 'Une demande sans réponse a des conséquences.']],
  ['Commissariat', ['Les pièces ont des effets concrets (cellules : auditions plus rapides ; cantine : récupération ; armurerie : moins d\'irrégularités…).', 'Construction : pièces rectangulaires ou en L, déplacement d\'une pièce avec ses meubles, rotation des meubles, remboursement de 60 % à la démolition, achat de terrain.']],
  ['Époques', ['De 1975 à 2025, véhicules, techniques de laboratoire, informatique, tenues, coiffures et musique évoluent. Les nouvelles technologies s\'achètent dans Équipements.']],
  ['Commandes', ['Espace : pause · 1 à 4 : vitesses · Échap : retour · glisser : déplacer la vue · molette ou pincement : zoom.']],
];

export function Guide() {
  const [g] = useGame();
  return (
    <PanelShell title="Guide du commandant" wide>
      <div className="card row between">
        <span>Revoir la prise en main pas à pas.</span>
        <button className="btn primary small" onClick={() => { g.mutate((s) => { s.tutorial = { on: true, step: 0 }; }); g.close(); }}>Relancer le tutoriel</button>
      </div>
      {GUIDE.map(([h, ps]) => (
        <div className="card" key={h}><h3>{h}</h3>{ps.map((p, i) => <p key={i} style={{ margin: '4px 0' }}>{p}</p>)}</div>
      ))}
    </PanelShell>
  );
}
