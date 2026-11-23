import { describe, expect, it } from 'vitest';
import { agentDepth, buildingDepth, tileDepth } from '../src/render/depth';

describe('tri en profondeur', () => {
  // bâtiment 3×3 en (10,10) : faces visibles côté +x et +y
  const b = buildingDepth(10, 10, 3);
  it('un personnage devant les faces visibles est dessiné après le bâtiment', () => {
    expect(agentDepth(13, 10)).toBeGreaterThan(b); // face +x
    expect(agentDepth(11, 13)).toBeGreaterThan(b); // face +y
    expect(agentDepth(13, 13)).toBeGreaterThan(b); // coin avant
  });
  it('un personnage derrière le bâtiment est dessiné avant', () => {
    expect(agentDepth(9, 11)).toBeLessThan(b); // côté −x
    expect(agentDepth(11, 9)).toBeLessThan(b); // côté −y
    expect(agentDepth(9, 9)).toBeLessThan(b);
  });
  it('les objets d\'une même rangée isométrique se recouvrent du fond vers l\'avant', () => {
    expect(tileDepth(5, 5)).toBeLessThan(tileDepth(5, 6));
    expect(tileDepth(5, 5)).toBeLessThan(tileDepth(6, 5));
    expect(agentDepth(5, 5)).toBeGreaterThan(tileDepth(5, 5)); // devant le tronc de sa case
    expect(agentDepth(5, 5)).toBeLessThan(tileDepth(6, 5));
  });
});
