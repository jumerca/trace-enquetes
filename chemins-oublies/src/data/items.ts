// Objets de l'inventaire : nom, description, dessin de l'icône.
import { canvas, ink, ellipse, rrect, capsule, INK, line } from '../art/draw';
import { drawSymbol } from '../art/props';

export interface ItemDef { name: string; desc: string; icon: (ctx: CanvasRenderingContext2D) => void; consumable?: boolean }

const TAU = Math.PI * 2;

export const ITEMS: Record<string, ItemDef> = {
  atlas: {
    name: "L'Atlas de Maëlys", desc: "Un épais atlas relié de cuir. Certaines pages restent blanches… jusqu'à ce qu'on comprenne ce qu'elles cachent.",
    icon: (c) => { c.beginPath(); rrect(c, -18, -22, 36, 44, 3); ink(c, '#6b3b2a', 2, { light: () => c.rect(-18, -22, 36, 6) }); c.beginPath(); c.arc(0, 0, 8, 0, TAU); ink(c, '#d9b25b', 1.5); line(c, 0, -6, 0, 6, INK, 1.2); line(c, -6, 0, 6, 0, INK, 1.2); },
  },
  baton: {
    name: 'Bâton de marche', desc: "Le bâton de frêne qu'Éloi emporte partout. Bien pratique pour écarter les ronces… ou les créatures trop curieuses.",
    icon: (c) => { c.save(); c.rotate(-0.7); c.beginPath(); capsule(c, 0, -26, 0, 24, 6, 5); ink(c, '#8a5a35', 1.8); c.beginPath(); c.arc(0, -26, 4.5, 0, TAU); ink(c, '#d9b25b', 1.5); c.restore(); },
  },
  boussole_brisee: {
    name: 'Boussole brisée', desc: "La boussole de Maëlys. Son aiguille tourne sans fin : l'aimant s'est éteint. Une artisane habile pourrait la réparer.",
    icon: (c) => { c.beginPath(); c.arc(0, 0, 18, 0, TAU); ink(c, '#c9a24a', 2); c.beginPath(); c.arc(0, 0, 13, 0, TAU); ink(c, '#f4ecd8', 1.2); line(c, -8, 6, 8, -6, '#9a3a2a', 2.4); line(c, -3, -9, 5, 11, '#6b6a68', 1); },
  },
  boussole: {
    name: 'Boussole de Maëlys', desc: "Réparée par Coline. Son aiguille ne montre pas le nord : elle indique la prochaine trace de chemin oublié.",
    icon: (c) => { c.beginPath(); c.arc(0, 0, 18, 0, TAU); ink(c, '#c9a24a', 2); c.beginPath(); c.arc(0, 0, 13, 0, TAU); ink(c, '#f4ecd8', 1.2); c.beginPath(); c.moveTo(0, -11); c.lineTo(4, 0); c.lineTo(0, 11); c.lineTo(-4, 0); c.closePath(); ink(c, '#c0523a', 1.2); },
  },
  aimant: {
    name: "Pierre d'aimant", desc: "Une petite pierre sombre qui attire les aiguilles. Mara s'en sert pour retrouver ses outils dans l'herbe.",
    icon: (c) => { c.beginPath(); ellipse(c, 0, 2, 17, 13, 0.3); ink(c, '#3a3a44', 2, { light: () => ellipse(c, -6, -4, 6, 3) }); c.fillStyle = '#c0c4cc'; for (const [x, y] of [[8, -8], [12, -2], [-12, 8]]) { c.fillRect(x, y, 5, 1.4); } },
  },
  lettre: {
    name: 'Lettre sans destinataire', desc: "Adressée à « Famille Verdier, 3 chemin des Saules, Clairval ». Aucun chemin des Saules n'existe à Clairval… L'écriture ressemble à celle de Maëlys.",
    icon: (c) => { c.beginPath(); rrect(c, -20, -13, 40, 26, 2); ink(c, '#f4ecd8', 1.8); c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-20, -13); c.lineTo(0, 3); c.lineTo(20, -13); c.stroke(); c.beginPath(); c.arc(0, 3, 4, 0, TAU); ink(c, '#a6463a', 1); },
  },
  cle_moulin: {
    name: 'Clé du moulin', desc: "Une grosse clé de fer, donnée par Anton le meunier. Elle ouvre la porte du Moulin des Trois-Eaux.",
    icon: (c) => { c.beginPath(); c.arc(-10, 0, 8, 0, TAU); ink(c, '#8d96a0', 2); c.beginPath(); c.arc(-10, 0, 3.5, 0, TAU); ink(c, '#f4ecd8', 1); c.beginPath(); rrect(c, -2, -3, 24, 6, 2); ink(c, '#8d96a0', 1.8); c.beginPath(); c.rect(14, 3, 4, 7); c.rect(8, 3, 3, 5); ink(c, '#8d96a0', 1.4); },
  },
  sauge: { name: 'Sauge des brumes', desc: "Une sauge aux feuilles argentées, cueillie au bord du ruisseau. Pour le jardin de Mara.", icon: (c) => { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32; c.beginPath(); ellipse(c, Math.cos(a) * 9, 6 + Math.sin(a) * 12, 3.5, 9, a + Math.PI / 2); ink(c, '#9fb8b0', 1.1); } } },
  pied_de_loup: { name: 'Pied-de-loup', desc: "Une plante rampante aux feuilles en écailles. Pour le jardin de Mara.", icon: (c) => { for (let i = 0; i < 4; i++) { const x = -9 + i * 6; c.strokeStyle = '#3f7a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 18); c.quadraticCurveTo(x - 4, 0, x + 2, -16); c.stroke(); for (let k = 0; k < 5; k++) { c.fillStyle = '#5c9a45'; c.beginPath(); ellipse(c, x - 2 + (k % 2) * 4, 12 - k * 6, 3.2, 1.6, 0.5); c.fill(); } } } },
  fleur_lanterne: { name: 'Fleur-lanterne', desc: "Une fleur orangée qui luit doucement dans l'ombre. Pour le jardin de Mara.", icon: (c) => { c.strokeStyle = '#3f7a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 20); c.quadraticCurveTo(-6, 4, 2, -4); c.stroke(); c.beginPath(); ellipse(c, 2, -9, 9, 11); ink(c, '#f2a03a', 1.6, { light: () => ellipse(c, 0, -12, 3, 5), lightCol: '#ffe08a' }); } },
  baume: { name: 'Baume de Mara', desc: "Un onguent parfumé à la sauge. Rend trois cœurs. (Toucher « Utiliser » pour l'appliquer.)", consumable: true, icon: (c) => { c.beginPath(); rrect(c, -14, -6, 28, 22, 4); ink(c, '#9fb8b0', 1.8); c.beginPath(); rrect(c, -16, -14, 32, 9, 3); ink(c, '#8a5a35', 1.6); c.fillStyle = '#5f7d3c'; c.beginPath(); ellipse(c, 0, 5, 6, 4); c.fill(); } },
  page_gauche: { name: 'Page déchirée (moitié gauche)', desc: "La moitié gauche d'une page de carnet. On y lit : « …les Conservateurs ne détruisent pas les ch… ».", icon: (c) => { c.beginPath(); c.moveTo(-16, -20); c.lineTo(8, -20); c.lineTo(4, -10); c.lineTo(10, 0); c.lineTo(3, 10); c.lineTo(8, 20); c.lineTo(-16, 20); c.closePath(); ink(c, '#efe2c0', 1.6); for (let y = -12; y < 16; y += 6) line(c, -12, y, 0, y, '#b48a52', 1); } },
  page_droite: { name: 'Page déchirée (moitié droite)', desc: "La moitié droite d'une page de carnet. On y lit : « …emins, ils les mettent à l'abri. M. »", icon: (c) => { c.beginPath(); c.moveTo(16, -20); c.lineTo(-6, -20); c.lineTo(-2, -10); c.lineTo(-8, 0); c.lineTo(-1, 10); c.lineTo(-6, 20); c.lineTo(16, 20); c.closePath(); ink(c, '#efe2c0', 1.6); for (let y = -12; y < 16; y += 6) line(c, 2, y, 12, y, '#b48a52', 1); } },
  page_maelys: { name: 'Page du carnet de Maëlys', desc: "« Les Conservateurs ne détruisent pas les chemins, ils les mettent à l'abri. Reste à savoir de quoi. — M. »", icon: (c) => { c.beginPath(); rrect(c, -16, -20, 32, 40, 2); ink(c, '#efe2c0', 1.6); for (let y = -12; y < 16; y += 6) line(c, -11, y, 11, y, '#b48a52', 1); c.strokeStyle = '#a6463a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-2, -20); c.lineTo(2, -10); c.lineTo(-3, 0); c.lineTo(2, 10); c.lineTo(-2, 20); c.stroke(); } },
  talisman: { name: 'Talisman de lierre', desc: "Un anneau de lierre tressé autour d'une pierre verte. Éloi se sent plus solide : un cœur de plus.", icon: (c) => { c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.lineWidth = 6; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#5c9a45'; c.stroke(); c.beginPath(); ellipse(c, 0, -15, 6, 7); ink(c, '#4fae8a', 1.4); } },
  frottis: { name: 'Frottis de la stèle', desc: "Le relevé au fusain qu'Anton a fait d'une pierre brisée : « La lune n'ouvre aucun chemin : elle les cache. »", icon: (c) => { c.beginPath(); rrect(c, -18, -16, 36, 32, 2); ink(c, '#f4ecd8', 1.6); c.save(); c.translate(0, 0); drawSymbol(c, 'lune', '#3a3530', 2); c.restore(); } },
};

const iconCache = new Map<string, string>();
export function itemIcon(id: string, size = 64): string {
  const k = id + size;
  if (iconCache.has(k)) return iconCache.get(k)!;
  const def = ITEMS[id];
  const [cv, ctx] = canvas(size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 56, size / 56);
  def?.icon(ctx);
  const url = cv.toDataURL();
  iconCache.set(k, url);
  return url;
}
