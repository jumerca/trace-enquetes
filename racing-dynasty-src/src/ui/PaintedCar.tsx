import { useEffect, useRef } from 'react';
import { paintCar, paintSoftShadow, type Livery } from '../render/art';

/** Monoplace peinte (même dessin qu'en course), à l'échelle voulue, éventuellement inclinée. */
export function PaintedCar({ livery, width = 320, angle = 0, className }: { livery: Livery; width?: number; angle?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = (width / 6.4) * dpr;
      const art = paintCar(livery, S);
      const sh = paintSoftShadow(64);
      const h = width * 0.62;
      cv.width = width * dpr;
      cv.height = h * dpr;
      cv.style.width = width + 'px';
      cv.style.height = h + 'px';
      const g = cv.getContext('2d')!;
      g.clearRect(0, 0, cv.width, cv.height);
      g.save();
      g.translate(cv.width / 2, cv.height / 2);
      g.rotate(angle);
      g.drawImage(sh, -art.width / 2 + S * 0.35, -art.height / 2 + S * 0.45, art.width, art.height * 1.25);
      g.drawImage(art, -art.width / 2, -art.height / 2);
      g.restore();
    };
    draw();
    // redessine une fois les polices chargées (numéro et sponsor)
    void document.fonts?.ready.then(draw);
  }, [livery.color, livery.color2, livery.number, livery.sponsor, livery.sponsorColor, width, angle]);
  return <canvas ref={ref} className={className} aria-label="Monoplace" />;
}
