// Icônes de l'interface (SVG en ligne, trait d'encre).
const s = (body: string, vb = '0 0 32 32') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
const ink = 'stroke="#2b1e16" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
export const ICONS = {
  atlas: s(`<rect x="6" y="4" width="20" height="24" rx="2" fill="#7a3f2a" ${ink}/><rect x="6" y="4" width="20" height="4" fill="#9a5a3a"/><circle cx="16" cy="17" r="5" fill="#e0b85c" ${ink}/><path d="M16 13v8M12 17h8" ${ink}/>`),
  bag: s(`<path d="M6 12h20l-2 15H8z" fill="#9a6237" ${ink}/><path d="M11 12a5 5 0 0 1 10 0" fill="none" ${ink}/><rect x="13" y="16" width="6" height="4" rx="1" fill="#e0b85c" ${ink}/>`),
  journal: s(`<rect x="7" y="4" width="18" height="24" rx="2" fill="#efe2c0" ${ink}/><path d="M11 10h10M11 15h10M11 20h7" ${ink}/><path d="M7 4v24" stroke="#a6463a" stroke-width="3"/>`),
  menu: s(`<path d="M7 9h18M7 16h18M7 23h18" stroke="#2b1e16" stroke-width="3" stroke-linecap="round"/>`),
  heart: s(`<path d="M16 27S4 19.5 4 11.5A6 6 0 0 1 16 9a6 6 0 0 1 12 2.5C28 19.5 16 27 16 27z" ${ink}/>`),
  sun: s(`<circle cx="16" cy="16" r="6" fill="#f2c94c" ${ink}/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" ${ink}/>`),
  moon: s(`<path d="M21 5a11 11 0 1 0 6 18A9 9 0 0 1 21 5z" fill="#d8d4f0" ${ink}/>`),
  star: s(`<path d="M16 4l3.5 7.5 8 1-6 5.5 1.6 8L16 22l-7.1 4 1.6-8-6-5.5 8-1z" fill="#f2c94c" ${ink}/>`),
};
