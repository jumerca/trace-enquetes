import { hashString } from '../../core/rng';
import type { Appearance } from '../../data/model';
import { HAIR, SKIN, shade } from '../../render/renderer';

/**
 * Portrait illustré semi-réaliste, généré à partir de l'apparence du joueur.
 * Chaque visage a sa propre morphologie (mâchoire, nez, lèvres, yeux, sourcils, oreilles),
 * déterminée de façon stable par l'identifiant du joueur.
 */
export function PlayerPortrait({
  a,
  colors,
  number,
  size = 120,
  seedKey,
  weightKg = 90,
  heightCm = 198,
  frame = true,
}: {
  a: Appearance;
  colors: [string, string];
  number: number;
  size?: number;
  seedKey: string;
  weightKg?: number;
  heightCm?: number;
  frame?: boolean;
}) {
  const h = hashString(seedKey);
  const r = (i: number) => ((h >>> (i * 3)) % 1000) / 1000; // paramètres stables 0..1
  const skin = SKIN[a.skin] ?? SKIN[2];
  const sk1 = shade(skin, 0.14);
  const sk2 = shade(skin, -0.16);
  const sk3 = shade(skin, -0.32);
  const hair = HAIR[a.hairColor] ?? HAIR[0];
  const hairL = shade(hair, 0.25);
  const [jersey, trim] = colors;
  const jerseyD = shade(jersey, -0.28);
  const id = `pp${h.toString(36)}`;
  // Morphologie
  const bulk = Math.max(0.85, Math.min(1.25, weightKg / ((heightCm / 100) ** 2 * 23.5)));
  const jaw = 0.82 + r(1) * 0.3; // largeur de mâchoire
  const faceW = 34 + r(2) * 4 + (bulk - 1) * 6;
  const faceH = 46 + r(3) * 5;
  const chin = 0.6 + r(4) * 0.5;
  const noseW = 7 + r(5) * 5 + (a.skin >= 3 ? 2.5 : 0);
  const noseL = 13 + r(6) * 5;
  const lip = 3 + r(7) * 2.5 + (a.skin >= 3 ? 1.2 : 0);
  const mouthW = 15 + r(8) * 5;
  const eyeW = 8 + r(9) * 2;
  const eyeY = 98 + r(10) * 3;
  const browT = 2.6 + r(11) * 1.8;
  const browTilt = -2 + r(12) * 4;
  const earH = 13 + r(13) * 4;
  const cx = 100;
  const top = 58;
  const bottom = top + faceH * 2;
  const jw = faceW * jaw;
  // Contour du visage (front arrondi, pommettes, mâchoire, menton)
  const face = `M ${cx - faceW} ${top + 40}
    C ${cx - faceW} ${top + 6}, ${cx - faceW * 0.55} ${top - 8}, ${cx} ${top - 8}
    C ${cx + faceW * 0.55} ${top - 8}, ${cx + faceW} ${top + 6}, ${cx + faceW} ${top + 40}
    C ${cx + faceW + 1} ${top + 58}, ${cx + jw} ${bottom - 22}, ${cx + jw * 0.55} ${bottom - 8}
    C ${cx + 14 * chin} ${bottom + 2}, ${cx - 14 * chin} ${bottom + 2}, ${cx - jw * 0.55} ${bottom - 8}
    C ${cx - jw} ${bottom - 22}, ${cx - faceW - 1} ${top + 58}, ${cx - faceW} ${top + 40} Z`;
  const neckW = 21 + bulk * 6;
  const shoulderW = 74 + bulk * 14;
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" role="img" aria-label="Portrait du joueur" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(jersey, -0.45)} />
          <stop offset="1" stopColor="#0b111d" />
        </linearGradient>
        <radialGradient id={`${id}sk`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={sk1} />
          <stop offset="0.55" stopColor={skin} />
          <stop offset="1" stopColor={sk2} />
        </radialGradient>
        <linearGradient id={`${id}neck`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sk3} />
          <stop offset="0.5" stopColor={sk2} />
          <stop offset="1" stopColor={skin} />
        </linearGradient>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(jersey, 0.12)} />
          <stop offset="0.6" stopColor={jersey} />
          <stop offset="1" stopColor={jerseyD} />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hairL} />
          <stop offset="1" stopColor={hair} />
        </linearGradient>
        <radialGradient id={`${id}rim`} cx="0.5" cy="0.15" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}stub`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.55" fill={hair} opacity="0.55" />
        </pattern>
        <clipPath id={`${id}clip`}>
          <rect width="200" height="240" rx={frame ? 22 : 0} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}clip)`}>
        <rect width="200" height="240" fill={`url(#${id}bg)`} />
        <rect width="200" height="240" fill={`url(#${id}rim)`} />
        {/* Lignes de salle en arrière-plan */}
        <path d="M-10 70 L210 40 M-10 120 L210 90" stroke="#fff" strokeOpacity="0.04" strokeWidth="10" />

        {/* Épaules, trapèzes, deltoïdes */}
        <path d={`M ${cx - shoulderW} 240 C ${cx - shoulderW} 196, ${cx - shoulderW + 18} 178, ${cx - neckW - 16} 172 L ${cx + neckW + 16} 172 C ${cx + shoulderW - 18} 178, ${cx + shoulderW} 196, ${cx + shoulderW} 240 Z`} fill={`url(#${id}sk)`} />
        <path d={`M ${cx - neckW} 160 C ${cx - neckW - 14} 172, ${cx - shoulderW + 20} 176, ${cx - shoulderW + 6} 196`} stroke={sk3} strokeOpacity="0.45" strokeWidth="2" fill="none" />
        <path d={`M ${cx + neckW} 160 C ${cx + neckW + 14} 172, ${cx + shoulderW - 20} 176, ${cx + shoulderW - 6} 196`} stroke={sk3} strokeOpacity="0.45" strokeWidth="2" fill="none" />
        {/* Maillot (débardeur) */}
        <path d={`M ${cx - shoulderW + 26} 240 L ${cx - shoulderW + 30} 200 C ${cx - shoulderW + 32} 188, ${cx - neckW - 6} 180, ${cx - neckW - 4} 172 C ${cx - 10} 200, ${cx + 10} 200, ${cx + neckW + 4} 172 C ${cx + neckW + 6} 180, ${cx + shoulderW - 32} 188, ${cx + shoulderW - 30} 200 L ${cx + shoulderW - 26} 240 Z`} fill={`url(#${id}j)`} />
        <path d={`M ${cx - neckW - 4} 172 C ${cx - 10} 200, ${cx + 10} 200, ${cx + neckW + 4} 172`} stroke={trim} strokeWidth="4.5" fill="none" />
        <path d={`M ${cx - shoulderW + 30} 200 C ${cx - shoulderW + 32} 188, ${cx - neckW - 6} 180, ${cx - neckW - 4} 172`} stroke={trim} strokeWidth="3.5" fill="none" />
        <path d={`M ${cx + shoulderW - 30} 200 C ${cx + shoulderW - 32} 188, ${cx + neckW + 6} 180, ${cx + neckW + 4} 172`} stroke={trim} strokeWidth="3.5" fill="none" />
        <text x={cx} y="234" textAnchor="middle" fontFamily="Barlow Condensed, Inter, sans-serif" fontWeight="800" fontSize="34" fill={trim} stroke={jerseyD} strokeWidth="1.2">
          {number}
        </text>
        {/* Cou */}
        <path d={`M ${cx - neckW + 2} 128 L ${cx - neckW} 168 C ${cx - 8} 182, ${cx + 8} 182, ${cx + neckW} 168 L ${cx + neckW - 2} 128 Z`} fill={`url(#${id}neck)`} />
        <path d={`M ${cx - 6} 150 C ${cx - 3} 160, ${cx + 3} 160, ${cx + 6} 150`} stroke={sk3} strokeOpacity="0.4" strokeWidth="1.5" fill="none" />

        {/* Oreilles */}
        <ellipse cx={cx - faceW - 1} cy={eyeY + 6} rx="6" ry={earH} fill={sk2} />
        <ellipse cx={cx + faceW + 1} cy={eyeY + 6} rx="6" ry={earH} fill={sk2} />
        <path d={`M ${cx - faceW - 3} ${eyeY - 2} q -3 8 1 16`} stroke={sk3} strokeWidth="1.6" fill="none" />
        <path d={`M ${cx + faceW + 3} ${eyeY - 2} q 3 8 -1 16`} stroke={sk3} strokeWidth="1.6" fill="none" />

        {/* Visage */}
        <path d={face} fill={`url(#${id}sk)`} />
        {/* Modelé : ombre sous les pommettes, tempes, côté de la mâchoire */}
        <path d={`M ${cx + faceW - 4} ${top + 46} C ${cx + faceW - 6} ${top + 70}, ${cx + jw * 0.8} ${bottom - 22}, ${cx + jw * 0.45} ${bottom - 6}`} stroke={sk3} strokeOpacity="0.35" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={`M ${cx - faceW + 9} ${eyeY + 22} q 8 6 16 4`} stroke={sk3} strokeOpacity="0.22" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d={`M ${cx + faceW - 9} ${eyeY + 22} q -8 6 -16 4`} stroke={sk3} strokeOpacity="0.28" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx={cx - 12} cy={top + 18} rx="14" ry="9" fill="#fff" opacity="0.08" />

        {/* Barbe */}
        {a.beard > 0 && (
          <path
            d={`M ${cx - faceW + 4} ${eyeY + 22} C ${cx - faceW + 6} ${bottom - 18}, ${cx - jw * 0.6} ${bottom}, ${cx} ${bottom + 3} C ${cx + jw * 0.6} ${bottom}, ${cx + faceW - 6} ${bottom - 18}, ${cx + faceW - 4} ${eyeY + 22} C ${cx + 16} ${eyeY + 46}, ${cx - 16} ${eyeY + 46}, ${cx - faceW + 4} ${eyeY + 22} Z`}
            fill={a.beard === 2 ? hair : `url(#${id}stub)`}
            opacity={a.beard === 2 ? 0.92 : 1}
          />
        )}
        {a.beard === 2 && <path d={`M ${cx - mouthW / 2 - 4} ${eyeY + 36} q ${mouthW / 2 + 4} -6 ${mouthW + 8} 0`} stroke={hair} strokeWidth="5" fill="none" strokeLinecap="round" />}

        {/* Yeux */}
        {[-1, 1].map((s) => {
          const ex = cx + s * 15;
          return (
            <g key={s}>
              <path d={`M ${ex - eyeW} ${eyeY} q ${eyeW} -${eyeW * 0.7} ${eyeW * 2} 0 q -${eyeW} ${eyeW * 0.55} -${eyeW * 2} 0 Z`} fill="#f4f1ea" />
              <circle cx={ex + s * 0.5} cy={eyeY - 0.5} r={eyeW * 0.42} fill={a.skin <= 1 && r(14) > 0.6 ? '#4a6b8a' : '#3a2516'} />
              <circle cx={ex + s * 0.5} cy={eyeY - 0.5} r={eyeW * 0.2} fill="#0b0b0b" />
              <circle cx={ex + s * 0.5 - 1.2} cy={eyeY - 1.8} r="1" fill="#fff" />
              <path d={`M ${ex - eyeW - 1} ${eyeY} q ${eyeW + 1} -${eyeW * 0.8} ${eyeW * 2 + 2} 0`} stroke={sk3} strokeWidth="1.8" fill="none" />
              <path d={`M ${ex - eyeW + 1} ${eyeY + 4} q ${eyeW - 1} 3 ${eyeW * 2 - 2} 0`} stroke={sk2} strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
              {/* Sourcils */}
              <path d={`M ${ex - eyeW - 2} ${eyeY - 9 + (s > 0 ? browTilt : -browTilt) * 0.3} q ${eyeW + 2} ${-4 - browTilt * 0.5} ${eyeW * 2 + 4} ${s * browTilt * 0.4}`} stroke={hair} strokeWidth={browT} fill="none" strokeLinecap="round" />
            </g>
          );
        })}
        {/* Nez */}
        <path d={`M ${cx - 2} ${eyeY + 2} C ${cx - 3} ${eyeY + noseL * 0.6}, ${cx - noseW * 0.6} ${eyeY + noseL - 2}, ${cx - noseW * 0.5} ${eyeY + noseL + 2}`} stroke={sk3} strokeOpacity="0.5" strokeWidth="1.6" fill="none" />
        <path d={`M ${cx - noseW * 0.65} ${eyeY + noseL + 2} q ${noseW * 0.3} 4 ${noseW * 0.65} 2 q ${noseW * 0.35} 2 ${noseW * 0.65} -2`} stroke={sk3} strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx={cx + 2} cy={eyeY + noseL * 0.55} rx="2" ry={noseL * 0.3} fill="#fff" opacity="0.12" />
        {/* Bouche */}
        <path d={`M ${cx - mouthW / 2} ${eyeY + noseL + 12} q ${mouthW / 2} ${-lip * 0.7} ${mouthW} 0 q ${-mouthW / 2} ${lip} ${-mouthW} 0 Z`} fill={shade(skin, -0.38)} />
        <path d={`M ${cx - mouthW / 2} ${eyeY + noseL + 12} q ${mouthW / 2} ${lip * 1.6} ${mouthW} 0`} fill={shade(skin, -0.2)} />
        <path d={`M ${cx - mouthW / 2} ${eyeY + noseL + 12} L ${cx + mouthW / 2} ${eyeY + noseL + 12}`} stroke={sk3} strokeWidth="1.3" />

        {/* Cheveux */}
        {hairStyle(a.hair, cx, top, faceW, `url(#${id}h)`, hair, hairL)}
        {a.headband && <path d={`M ${cx - faceW - 1} ${top + 18} C ${cx - 20} ${top + 8}, ${cx + 20} ${top + 8}, ${cx + faceW + 1} ${top + 18} L ${cx + faceW + 1} ${top + 27} C ${cx + 20} ${top + 17}, ${cx - 20} ${top + 17}, ${cx - faceW - 1} ${top + 27} Z`} fill={trim} />}
      </g>
      {frame && <rect x="1" y="1" width="198" height="238" rx="21" fill="none" stroke={trim} strokeOpacity="0.35" strokeWidth="2" />}
    </svg>
  );
}

function hairStyle(style: number, cx: number, top: number, w: number, grad: string, base: string, light: string) {
  switch (style) {
    case 0: // coupe dégradée (fade)
      return (
        <g>
          <path d={`M ${cx - w + 1} ${top + 34} C ${cx - w} ${top - 6}, ${cx + w} ${top - 6}, ${cx + w - 1} ${top + 34} C ${cx + w - 6} ${top + 14}, ${cx - w + 6} ${top + 14}, ${cx - w + 1} ${top + 34} Z`} fill={grad} />
          <path d={`M ${cx - w + 1} ${top + 34} L ${cx - w + 3} ${top + 52} M ${cx + w - 1} ${top + 34} L ${cx + w - 3} ${top + 52}`} stroke={base} strokeOpacity="0.35" strokeWidth="5" />
        </g>
      );
    case 1: // court texturé
      return (
        <g>
          <path d={`M ${cx - w - 1} ${top + 40} C ${cx - w - 4} ${top - 14}, ${cx + w + 4} ${top - 14}, ${cx + w + 1} ${top + 40} C ${cx + w - 4} ${top + 12}, ${cx - w + 4} ${top + 12}, ${cx - w - 1} ${top + 40} Z`} fill={grad} />
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d={`M ${cx - w + 8 + i * 7} ${top + 4} l 3 -6`} stroke={light} strokeOpacity="0.5" strokeWidth="1.4" />
          ))}
        </g>
      );
    case 2: // afro
      return (
        <g>
          <path d={`M ${cx - w - 6} ${top + 44} C ${cx - w - 22} ${top - 4}, ${cx - w + 4} ${top - 34}, ${cx} ${top - 34} C ${cx + w - 4} ${top - 34}, ${cx + w + 22} ${top - 4}, ${cx + w + 6} ${top + 44} C ${cx + w - 2} ${top + 14}, ${cx - w + 2} ${top + 14}, ${cx - w - 6} ${top + 44} Z`} fill={grad} />
          {Array.from({ length: 24 }).map((_, i) => (
            <circle key={i} cx={cx - w + (i % 8) * ((2 * w) / 7)} cy={top - 18 + Math.floor(i / 8) * 11} r="5" fill={light} opacity="0.12" />
          ))}
        </g>
      );
    case 3: // tresses plaquées
      return (
        <g>
          <path d={`M ${cx - w - 1} ${top + 40} C ${cx - w - 4} ${top - 12}, ${cx + w + 4} ${top - 12}, ${cx + w + 1} ${top + 40} C ${cx + w - 4} ${top + 14}, ${cx - w + 4} ${top + 14}, ${cx - w - 1} ${top + 40} Z`} fill={base} />
          {Array.from({ length: 7 }).map((_, i) => {
            const x = cx - w + 6 + i * ((2 * w - 12) / 6);
            return <path key={i} d={`M ${x} ${top + 30} C ${x + 2} ${top + 10}, ${cx + (x - cx) * 0.4} ${top - 2}, ${cx + (x - cx) * 0.2} ${top - 6}`} stroke={light} strokeOpacity="0.55" strokeWidth="3" fill="none" strokeDasharray="3 2" />;
          })}
        </g>
      );
    case 4: // dreadlocks attachées
      return (
        <g>
          <path d={`M ${cx - w - 1} ${top + 40} C ${cx - w - 4} ${top - 12}, ${cx + w + 4} ${top - 12}, ${cx + w + 1} ${top + 40} C ${cx + w - 4} ${top + 14}, ${cx - w + 4} ${top + 14}, ${cx - w - 1} ${top + 40} Z`} fill={grad} />
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} d={`M ${cx - 10 + i * 4} ${top - 8} q ${8 + i * 2} -14 ${18 + i * 3} -10`} stroke={base} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          ))}
        </g>
      );
    default: // crâne rasé : simple reflet
      return <ellipse cx={cx - 8} cy={top + 2} rx={w * 0.55} ry="8" fill="#fff" opacity="0.1" />;
  }
}
