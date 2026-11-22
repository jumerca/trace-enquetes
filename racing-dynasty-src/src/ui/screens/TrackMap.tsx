import { useMemo } from 'react';
import { getTrack } from '../../engine/tracks';

export function TrackMap({ trackId, width = 220 }: { trackId: string; width?: number }) {
  const { d, vb, start } = useMemo(() => {
    const t = getTrack(trackId);
    const b = t.bounds;
    const pad = 60;
    let path = '';
    for (let i = 0; i < t.n; i += 6) path += (i ? 'L' : 'M') + t.x[i].toFixed(0) + ' ' + t.y[i].toFixed(0);
    return {
      d: path + 'Z',
      vb: `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`,
      start: { x: t.x[0], y: t.y[0] },
    };
  }, [trackId]);
  return (
    <svg className="trackmap" viewBox={vb} width={width} aria-label="Tracé du circuit">
      <path d={d} fill="none" stroke="#16130f" strokeWidth="44" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#f4f1ea" strokeWidth="22" strokeLinejoin="round" />
      <rect x={start.x - 6} y={start.y - 34} width="12" height="68" fill="#d62828" stroke="#16130f" strokeWidth="5" />
    </svg>
  );
}
