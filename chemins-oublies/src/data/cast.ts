// Identité visuelle de chaque personnage (prénom, silhouette, couleurs, accessoires).
import type { CharSpec } from '../art/characters';

export const ELOI: CharSpec = {
  id: 'eloi', height: 1, width: 1, headR: 12.5, skin: '#f2c9a0', hair: '#8a4a26', hairStyle: 'tousle',
  top: '#2f7f86', topStyle: 'coat', bottom: '#5b4a3e', shoes: '#5a3522', accent: '#e8a92c', scarf: true, bag: '#9a6237', eyeCol: '#2e5a3a', cuff: '#e8a92c',
};

export const CAST: Record<string, CharSpec> = {
  agathe: { id: 'agathe', height: 1, width: 1.28, headR: 12.8, skin: '#f0c19a', hair: '#b5452b', hairStyle: 'bun', top: '#a6463a', topStyle: 'dress', bottom: '#4a3a30', shoes: '#4d2d1d', apron: '#f4ecd8', shawl: false, pattern: 'dots', patternCol: '#f2c7b8' },
  basile: { id: 'basile', height: 1.04, width: 1.02, headR: 12.2, skin: '#e9b98f', hair: '#4a3426', hairStyle: 'short', hat: 'cap', hatCol: '#34507a', top: '#3d5d8f', topStyle: 'uniform', bottom: '#2e3c58', shoes: '#2a1d16', mustache: true, mailbag: true, bag: '#7a4e2e', belt: '#3a2a20' },
  ninon: { id: 'ninon', height: 0.74, width: 0.9, headR: 12, skin: '#f6d0ad', hair: '#e0a23a', hairStyle: 'pigtails', top: '#e9c33e', topStyle: 'dress', bottom: '#5b4a3e', shoes: '#b0412e', accent: '#d4473d', pattern: 'flowers', patternCol: '#ffffff' },
  mara: { id: 'mara', height: 1.08, width: 0.88, headR: 11.8, skin: '#d8a27a', hair: '#2e2420', hairStyle: 'braid', top: '#5f7d3c', topStyle: 'robe', bottom: '#4a3a30', shoes: '#4d3424', accent: '#9a6a3a', shawl: true, eyeCol: '#4a6a2a', pattern: 'leaves', patternCol: '#a6d07a' },
  anton: { id: 'anton', height: 1.02, width: 1.32, headR: 12.8, skin: '#ebb48a', hair: '#7a6a5a', hairStyle: 'short', hat: 'flatcap', hatCol: '#7a6448', top: '#efe6d2', topStyle: 'shirt', bottom: '#6b5a44', shoes: '#4a3020', beard: true, flour: true, belt: '#6b4a30' },
  coline: { id: 'coline', height: 0.98, width: 1, headR: 12, skin: '#c98d64', hair: '#2b2a35', hairStyle: 'curly', top: '#c56b3a', topStyle: 'shirt', bottom: '#3e4450', shoes: '#3a2a20', apron: '#7a5236', goggles: true },
  theodore: { id: 'theodore', height: 1.12, width: 1.12, headR: 12.2, skin: '#e7b48c', hair: '#5a4030', hairStyle: 'short', hat: 'kettle', top: '#7a2f32', topStyle: 'tunic', bottom: '#3a3530', shoes: '#2a1d16', mustache: true, belt: '#4a3020' },
  salome: { id: 'salome', height: 0.96, width: 0.96, headR: 12, skin: '#efc8a8', hair: '#c9c4c0', hairStyle: 'bun', top: '#6a4a7a', topStyle: 'robe', bottom: '#3a2e40', shoes: '#3a2a2a', glasses: true, accent: '#b89ac9', shawl: true, pattern: 'stripes', patternCol: '#7d5c8e' },
  // souvenirs et mystère
  maelys: { id: 'maelys', height: 1.06, width: 0.95, headR: 12, skin: '#e8b894', hair: '#6a4a3a', hairStyle: 'braid', top: '#5a4a7a', topStyle: 'coat', bottom: '#3a3040', shoes: '#4a2e22', accent: '#c9a24a', scarf: true, bag: '#7a4e2e', eyeCol: '#3a5a6a', cuff: '#c9a24a' },
  eloi_jeune: { id: 'eloi_jeune', height: 0.74, width: 0.92, headR: 12, skin: '#f2c9a0', hair: '#8a4a26', hairStyle: 'tousle', top: '#4f8f5a', topStyle: 'shirt', bottom: '#5b4a3e', shoes: '#5a3522', eyeCol: '#2e5a3a' },
  conservateur: { id: 'conservateur', height: 1.15, width: 1.0, headR: 12, skin: '#d9c2b0', hair: '#3a3a40', hairStyle: 'short', hat: 'hood', hatCol: '#6e737c', top: '#7a7f88', topStyle: 'robe', bottom: '#4a4e56', shoes: '#2a2a30', accent: '#d8dde4', shawl: true, eyeCol: '#8a9aa8' },
  // habitants d'ambiance
  gaspard: { id: 'gaspard', height: 1, width: 1.1, headR: 12, skin: '#dca57c', hair: '#6a5240', hairStyle: 'short', hat: 'flatcap', hatCol: '#3a5a50', top: '#4a6a5a', topStyle: 'shirt', bottom: '#4a4038', shoes: '#3a2a20', beard: true },
  odile: { id: 'odile', height: 0.98, width: 1.12, headR: 12.2, skin: '#f0c4a0', hair: '#7a4a2a', hairStyle: 'long', hat: 'kerchief', hatCol: '#c0523a', top: '#7a8a4a', topStyle: 'dress', bottom: '#4a3a30', shoes: '#4d2d1d', apron: '#e8dcc0', pattern: 'dots', patternCol: '#c9d79a' },
  paulin: { id: 'paulin', height: 0.72, width: 0.92, headR: 11.6, skin: '#e0a87e', hair: '#3a2a20', hairStyle: 'tousle', top: '#b8453a', topStyle: 'shirt', bottom: '#4a5a7a', shoes: '#3a2a20' },
};
