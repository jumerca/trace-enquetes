import type { MatchEngine } from '../sim/engine';

/** Simulation sans rendu, découpée pour ne pas bloquer l'interface. */
export function simulateAsync(e: MatchEngine, until: (e: MatchEngine) => boolean = () => false, onProgress?: (e: MatchEngine) => void): Promise<void> {
  return new Promise((resolve) => {
    const chunk = () => {
      const t0 = performance.now();
      while (!e.finished && !until(e) && performance.now() - t0 < 14) {
        for (let i = 0; i < 240 && !e.finished && !until(e); i++) e.step();
      }
      onProgress?.(e);
      if (e.finished || until(e)) resolve();
      else setTimeout(chunk, 0);
    };
    chunk();
  });
}
