import { hashString } from '../../core/rng';
import type { Appearance } from '../../data/model';
import { HAIR, SKIN, shade } from '../../render/renderer';

/**
 * Portrait illustré, généré à partir de l'apparence du joueur.
 * Chaque visage a sa propre morphologie (mâchoire, nez, lèvres, yeux, sourcils, oreilles),
 * déterminée de façon stable par l'identifiant du joueur. Éclairage de studio : lumière
 * principale en haut à gauche, ombre propre à droite, liseré de contre-jour aux couleurs du club.
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
  const sk1 = shade(skin, 0.16);
  const sk2 = shade(skin, -0.16);
  const sk3 = shade(skin, -0.34);
  const sk4 = shade(skin, -0.5);
  const hair = HAIR[a.hairColor] ?? HAIR[0];
  const hairL = shade(hair, 0.28);
  const hairD = shade(hair, -0.3);
  const [jersey, trim] = colors;
  const jerseyD = shade(jersey, -0.3);
  const jerseyL = shade(jersey, 0.14);
  const id = `pp${h.toString(36)}`;
  const soft = size >= 56; // les flous ne servent à rien sur les vignettes
  const blur = soft ? `url(#${id}b)` : undefined;
  const blur2 = soft ? `url(#${id}b2)` : undefined;
  // Morphologie
  const bulk = Math.max(0.85, Math.min(1.25, weightKg / ((heightCm / 100) ** 2 * 23.5)));
  const jaw = 0.78 + r(1) * 0.26; // largeur de mâchoire
  const faceW = 41 + r(2) * 4 + (bulk - 1) * 7;
  const chin = 0.7 + r(4) * 0.5;
  const noseW = 9 + r(5) * 5 + (a.skin >= 3 ? 3 : 0);
  const noseL = 21 + r(6) * 5;
  const lip = 3.4 + r(7) * 2.6 + (a.skin >= 3 ? 1.4 : 0);
  const mouthW = 19 + r(8) * 6;
  const eyeW = 9.5 + r(9) * 2;
  const eyeGap = 18 + r(15) * 2.5;
  const browT = 3.2 + r(11) * 2.2;
  const browTilt = -1.5 + r(12) * 3.5;
  const earH = 15 + r(13) * 4;
  const cx = 100;
  const top = 34 + r(3) * 4; // sommet du crâne
  const eyeY = top + 66;
  const bottom = eyeY + 62 + r(10) * 5; // menton
  const jw = faceW * jaw;
  const noseY = eyeY + noseL;
  const mouthY = noseY + 13 + r(16) * 2;
  const iris = a.skin <= 1 && r(14) > 0.55 ? (r(14) > 0.8 ? '#5d7f6a' : '#4f7396') : a.skin <= 2 && r(14) > 0.8 ? '#6b4a26' : '#3a2516';
  // Contour du visage (crâne arrondi, tempes, pommettes, mâchoire, menton)
  const face = `M ${cx - faceW} ${eyeY - 8}
    C ${cx - faceW - 1} ${top + 14}, ${cx - faceW * 0.62} ${top}, ${cx} ${top}
    C ${cx + faceW * 0.62} ${top}, ${cx + faceW + 1} ${top + 14}, ${cx + faceW} ${eyeY - 8}
    C ${cx + faceW + 1} ${eyeY + 22}, ${cx + jw + 2} ${bottom - 30}, ${cx + jw * 0.62} ${bottom - 10}
    C ${cx + 16 * chin} ${bottom + 3}, ${cx - 16 * chin} ${bottom + 3}, ${cx - jw * 0.62} ${bottom - 10}
    C ${cx - jw - 2} ${bottom - 30}, ${cx - faceW - 1} ${eyeY + 22}, ${cx - faceW} ${eyeY - 8} Z`;
  const neckW = 24 + bulk * 7;
  const shoulderW = 82 + bulk * 14;
  const shY = bottom + 30; // ligne des épaules
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" role="img" aria-label="Portrait du joueur" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={shade(jersey === '#F2F0EA' ? trim : jersey, -0.3)} />
          <stop offset="1" stopColor="#090e18" />
        </linearGradient>
        <radialGradient id={`${id}spot`} cx="0.5" cy="0.34" r="0.62">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}sk`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor={sk1} />
          <stop offset="0.5" stopColor={skin} />
          <stop offset="1" stopColor={sk2} />
        </radialGradient>
        <linearGradient id={`${id}side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.5" stopColor={sk4} stopOpacity="0" />
          <stop offset="1" stopColor={sk4} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${id}neck`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sk4} />
          <stop offset="0.45" stopColor={sk2} />
          <stop offset="1" stopColor={skin} />
        </linearGradient>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor={jerseyL} />
          <stop offset="0.55" stopColor={jersey} />
          <stop offset="1" stopColor={jerseyD} />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={hairL} />
          <stop offset="0.6" stopColor={hair} />
          <stop offset="1" stopColor={hairD} />
        </linearGradient>
        <linearGradient id={`${id}vig`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.8" stopColor="#060a12" stopOpacity="0" />
          <stop offset="1" stopColor="#060a12" stopOpacity="0.25" />
        </linearGradient>
        {soft && (
          <>
            <filter id={`${id}b`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            <filter id={`${id}b2`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.3" />
            </filter>
          </>
        )}
        <clipPath id={`${id}clip`}>
          <rect width="200" height="240" rx={frame ? 22 : 0} />
        </clipPath>
        <clipPath id={`${id}face`}>
          <path d={face} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}clip)`}>
        {/* Décor : salle plongée dans l'ombre, projecteur derrière le joueur */}
        <rect width="200" height="240" fill={`url(#${id}bg)`} />
        <rect width="200" height="240" fill={`url(#${id}spot)`} />
        <g opacity="0.07" fill="#fff">
          <circle cx="24" cy="38" r="13" />
          <circle cx="172" cy="56" r="9" />
          <circle cx="158" cy="22" r="6" />
          <circle cx="44" cy="84" r="5" />
        </g>
        <path d="M-10 132 L210 112 L210 126 L-10 146 Z" fill="#fff" opacity="0.035" />

        {/* Épaules, trapèzes, deltoïdes */}
        <path
          d={`M ${cx - shoulderW} 240 C ${cx - shoulderW} ${shY + 22}, ${cx - shoulderW + 16} ${shY + 6}, ${cx - neckW - 20} ${shY - 2} C ${cx - neckW - 6} ${shY - 8}, ${cx - neckW} ${shY - 18}, ${cx - neckW} ${shY - 26} L ${cx + neckW} ${shY - 26} C ${cx + neckW} ${shY - 18}, ${cx + neckW + 6} ${shY - 8}, ${cx + neckW + 20} ${shY - 2} C ${cx + shoulderW - 16} ${shY + 6}, ${cx + shoulderW} ${shY + 22}, ${cx + shoulderW} 240 Z`}
          fill={`url(#${id}sk)`}
        />
        <ellipse cx={cx + shoulderW - 24} cy={shY + 36} rx="26" ry="34" fill={sk4} opacity="0.3" filter={blur} />
        <ellipse cx={cx - shoulderW + 30} cy={shY + 20} rx="18" ry="10" fill="#fff" opacity="0.1" filter={blur} />
        {/* Clavicules */}
        <path d={`M ${cx - 8} ${shY + 6} C ${cx - 24} ${shY + 2}, ${cx - 44} ${shY + 4}, ${cx - 58} ${shY + 10}`} stroke={sk3} strokeOpacity="0.4" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={`M ${cx + 8} ${shY + 6} C ${cx + 24} ${shY + 2}, ${cx + 44} ${shY + 4}, ${cx + 58} ${shY + 10}`} stroke={sk3} strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Maillot (débardeur) */}
        <path
          d={`M ${cx - shoulderW + 30} 240 L ${cx - shoulderW + 34} ${shY + 26} C ${cx - shoulderW + 36} ${shY + 10}, ${cx - neckW - 12} ${shY + 6}, ${cx - neckW - 10} ${shY - 4} C ${cx - 16} ${shY + 30}, ${cx + 16} ${shY + 30}, ${cx + neckW + 10} ${shY - 4} C ${cx + neckW + 12} ${shY + 6}, ${cx + shoulderW - 36} ${shY + 10}, ${cx + shoulderW - 34} ${shY + 26} L ${cx + shoulderW - 30} 240 Z`}
          fill={`url(#${id}j)`}
        />
        {/* Plis du tissu */}
        <path d={`M ${cx - 40} ${shY + 30} q 8 14 4 34 M ${cx + 34} ${shY + 26} q -6 16 0 38`} stroke={jerseyD} strokeOpacity="0.35" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={`M ${cx - neckW - 10} ${shY - 4} C ${cx - 16} ${shY + 30}, ${cx + 16} ${shY + 30}, ${cx + neckW + 10} ${shY - 4}`} stroke={trim} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d={`M ${cx - shoulderW + 34} ${shY + 26} C ${cx - shoulderW + 36} ${shY + 10}, ${cx - neckW - 12} ${shY + 6}, ${cx - neckW - 10} ${shY - 4}`} stroke={trim} strokeWidth="3.5" fill="none" />
        <path d={`M ${cx + shoulderW - 34} ${shY + 26} C ${cx + shoulderW - 36} ${shY + 10}, ${cx + neckW + 12} ${shY + 6}, ${cx + neckW + 10} ${shY - 4}`} stroke={trim} strokeWidth="3.5" fill="none" />
        <text x={cx} y="236" textAnchor="middle" fontFamily="Barlow Condensed, Inter, sans-serif" fontWeight="800" fontSize="30" fill={trim} stroke={jerseyD} strokeWidth="1.2" paintOrder="stroke">
          {number}
        </text>

        {/* Cou : muscles et ombre portée de la mâchoire */}
        <path d={`M ${cx - neckW + 3} ${bottom - 34} L ${cx - neckW} ${shY - 8} C ${cx - 10} ${shY + 12}, ${cx + 10} ${shY + 12}, ${cx + neckW} ${shY - 8} L ${cx + neckW - 3} ${bottom - 34} Z`} fill={`url(#${id}neck)`} />
        <path d={`M ${cx - neckW + 6} ${bottom - 4} C ${cx - 14} ${shY - 10}, ${cx - 8} ${shY}, ${cx - 4} ${shY + 6}`} stroke={sk3} strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d={`M ${cx + neckW - 6} ${bottom - 4} C ${cx + 14} ${shY - 10}, ${cx + 8} ${shY}, ${cx + 4} ${shY + 6}`} stroke={sk3} strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx={cx + 3} cy={bottom + 4} rx={neckW + 2} ry="13" fill={sk4} opacity="0.55" filter={blur} />

        {/* Oreilles */}
        {[-1, 1].map((s) => (
          <g key={s}>
            <path d={`M ${cx + s * (faceW - 2)} ${eyeY - 6} c ${s * 11} -7 ${s * 13} 12 ${s * 8} ${earH + 6} c ${s * -2} 6 ${s * -6} 6 ${s * -8} 2 Z`} fill={s > 0 ? sk2 : skin} />
            <path d={`M ${cx + s * (faceW + 4)} ${eyeY - 1} c ${s * 4} 2 ${s * 4} 10 ${s * 1} ${earH - 2}`} stroke={sk3} strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        ))}

        {/* Visage */}
        <path d={face} fill={`url(#${id}sk)`} />
        <g clipPath={`url(#${id}face)`}>
          {/* Ombre propre (côté opposé à la lumière) */}
          <rect x={cx - faceW - 4} y={top - 4} width={faceW * 2 + 8} height={bottom - top + 12} fill={`url(#${id}side)`} />
          {/* Orbites, creux des joues, dessous de la lèvre */}
          <ellipse cx={cx - eyeGap} cy={eyeY - 3} rx={eyeW + 5} ry="8" fill={sk3} opacity="0.3" filter={blur} />
          <ellipse cx={cx + eyeGap} cy={eyeY - 3} rx={eyeW + 5} ry="8" fill={sk3} opacity="0.38" filter={blur} />
          <ellipse cx={cx + faceW * 0.62} cy={mouthY - 6} rx="9" ry="20" fill={sk3} opacity="0.3" filter={blur} />
          <ellipse cx={cx - faceW * 0.66} cy={mouthY - 4} rx="7" ry="17" fill={sk3} opacity="0.18" filter={blur} />
          <ellipse cx={cx} cy={mouthY + lip + 9} rx={mouthW * 0.42} ry="3.6" fill={sk3} opacity="0.32" filter={blur2} />
          {/* Lumières : front, pommette, menton */}
          <ellipse cx={cx - 12} cy={top + 30} rx="20" ry="12" fill="#fff" opacity="0.13" filter={blur} />
          <ellipse cx={cx - faceW * 0.52} cy={eyeY + 18} rx="10" ry="7" fill="#fff" opacity="0.12" filter={blur} />
          <ellipse cx={cx - 3} cy={bottom - 9} rx="9" ry="5" fill="#fff" opacity="0.08" filter={blur} />
          {/* Barbe */}
          {a.beard === 1 && (
            <path
              d={`M ${cx - faceW} ${eyeY + 24} C ${cx - faceW + 4} ${bottom - 22}, ${cx - jw * 0.6} ${bottom + 2}, ${cx} ${bottom + 5} C ${cx + jw * 0.6} ${bottom + 2}, ${cx + faceW - 4} ${bottom - 22}, ${cx + faceW} ${eyeY + 24} C ${cx + faceW - 14} ${mouthY + 2}, ${cx + mouthW * 0.8} ${mouthY - 8}, ${cx} ${mouthY - 9} C ${cx - mouthW * 0.8} ${mouthY - 8}, ${cx - faceW + 14} ${mouthY + 2}, ${cx - faceW} ${eyeY + 24} Z`}
              fill={hairD}
              opacity="0.34"
              filter={blur}
            />
          )}
          {a.beard === 2 && (
            <g>
              <path
                d={`M ${cx - faceW - 1} ${eyeY + 14} C ${cx - faceW + 2} ${bottom - 20}, ${cx - jw * 0.62} ${bottom + 4}, ${cx} ${bottom + 7} C ${cx + jw * 0.62} ${bottom + 4}, ${cx + faceW - 2} ${bottom - 20}, ${cx + faceW + 1} ${eyeY + 14} C ${cx + faceW - 10} ${mouthY - 2}, ${cx + mouthW * 0.75} ${mouthY - 10}, ${cx} ${mouthY - 11} C ${cx - mouthW * 0.75} ${mouthY - 10}, ${cx - faceW + 10} ${mouthY - 2}, ${cx - faceW - 1} ${eyeY + 14} Z`}
                fill={`url(#${id}h)`}
              />
              {Array.from({ length: 9 }).map((_, i) => (
                <path key={i} d={`M ${cx - jw * 0.7 + i * ((jw * 1.4) / 8)} ${bottom - 14} q 1 6 -1 12`} stroke={hairL} strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
              ))}
            </g>
          )}
        </g>
        {/* Liseré de contre-jour aux couleurs du club */}
        <path d={`M ${cx + faceW} ${eyeY - 8} C ${cx + faceW + 1} ${eyeY + 22}, ${cx + jw + 2} ${bottom - 30}, ${cx + jw * 0.62} ${bottom - 10}`} stroke={trim === '#101827' ? '#F6F4EF' : trim} strokeOpacity="0.28" strokeWidth="2.4" fill="none" strokeLinecap="round" filter={blur2} />

        {/* Yeux */}
        {[-1, 1].map((s) => {
          const ex = cx + s * eyeGap;
          const by = eyeY - 11 - browT * 0.3;
          return (
            <g key={s}>
              <path d={`M ${ex - eyeW} ${eyeY + 0.5} Q ${ex - eyeW * 0.2} ${eyeY - eyeW * 0.72} ${ex + eyeW} ${eyeY - 0.5} Q ${ex} ${eyeY + eyeW * 0.5} ${ex - eyeW} ${eyeY + 0.5} Z`} fill="#f1ede4" />
              <clipPath id={`${id}e${s}`}>
                <path d={`M ${ex - eyeW} ${eyeY + 0.5} Q ${ex - eyeW * 0.2} ${eyeY - eyeW * 0.72} ${ex + eyeW} ${eyeY - 0.5} Q ${ex} ${eyeY + eyeW * 0.5} ${ex - eyeW} ${eyeY + 0.5} Z`} />
              </clipPath>
              <g clipPath={`url(#${id}e${s})`}>
                <circle cx={ex} cy={eyeY - 0.8} r={eyeW * 0.5} fill={iris} />
                <circle cx={ex} cy={eyeY - 0.8} r={eyeW * 0.5} fill="none" stroke="#0b0b0b" strokeOpacity="0.5" strokeWidth="1" />
                <circle cx={ex} cy={eyeY - 0.8} r={eyeW * 0.23} fill="#0b0b0b" />
                <rect x={ex - eyeW} y={eyeY - eyeW} width={eyeW * 2} height={eyeW * 0.55} fill="#000" opacity="0.22" />
              </g>
              <circle cx={ex - 1.6} cy={eyeY - 2.4} r="1.25" fill="#fff" />
              {/* Paupière supérieure (cils), pli, paupière inférieure */}
              <path d={`M ${ex - eyeW - 1} ${eyeY + 0.8} Q ${ex - eyeW * 0.2} ${eyeY - eyeW * 0.8} ${ex + eyeW + 1.5} ${eyeY - 1}`} stroke={sk4} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d={`M ${ex - eyeW + 1} ${eyeY - 4.5} Q ${ex} ${eyeY - eyeW * 0.95 - 2} ${ex + eyeW - 0.5} ${eyeY - 5}`} stroke={sk3} strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
              <path d={`M ${ex - eyeW + 2} ${eyeY + 3.6} Q ${ex} ${eyeY + eyeW * 0.6 + 1.5} ${ex + eyeW - 1.5} ${eyeY + 3}`} stroke={sk3} strokeOpacity="0.45" strokeWidth="1.1" fill="none" />
              {/* Sourcil : forme pleine, plus épais côté nez */}
              <path
                d={`M ${ex - s * (eyeW + 3)} ${by + 2.5 - s * browTilt * 0.2} Q ${ex - s * 2} ${by - 3.5 - browTilt * 0.4} ${ex + s * (eyeW + 4)} ${by + 0.5 + browTilt * 0.5} L ${ex + s * (eyeW + 3.5)} ${by + 2 + browTilt * 0.5} Q ${ex - s * 2} ${by - 3.5 + browT} ${ex - s * (eyeW + 2)} ${by + 2.5 + browT * 0.9} Z`}
                fill={hairD}
                opacity="0.92"
              />
            </g>
          );
        })}

        {/* Nez : arête éclairée, ombre latérale, ailes et narines */}
        <path d={`M ${cx + 2.5} ${eyeY - 2} C ${cx + 5} ${eyeY + noseL * 0.5}, ${cx + noseW * 0.5} ${noseY - 8}, ${cx + noseW * 0.72} ${noseY - 1} C ${cx + noseW * 0.3} ${noseY + 3}, ${cx + 2} ${noseY + 2}, ${cx + 1.5} ${noseY - 2} Z`} fill={sk3} opacity="0.42" filter={blur2} />
        <path d={`M ${cx - 2.5} ${eyeY} C ${cx - 3} ${eyeY + noseL * 0.5}, ${cx - 3} ${noseY - 8}, ${cx - 2} ${noseY - 4}`} stroke="#fff" strokeOpacity="0.2" strokeWidth="3" fill="none" strokeLinecap="round" filter={blur2} />
        <path d={`M ${cx - noseW * 0.74} ${noseY - 2} C ${cx - noseW * 0.9} ${noseY + 3}, ${cx - noseW * 0.35} ${noseY + 4.5}, ${cx - noseW * 0.2} ${noseY + 2} Q ${cx} ${noseY + 5.5} ${cx + noseW * 0.2} ${noseY + 2} C ${cx + noseW * 0.35} ${noseY + 4.5}, ${cx + noseW * 0.9} ${noseY + 3}, ${cx + noseW * 0.74} ${noseY - 2}`} stroke={sk4} strokeOpacity="0.75" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <ellipse cx={cx - noseW * 0.36} cy={noseY + 1.6} rx="1.9" ry="1.1" fill={sk4} opacity="0.75" />
        <ellipse cx={cx + noseW * 0.36} cy={noseY + 1.6} rx="1.9" ry="1.1" fill={sk4} opacity="0.75" />
        <circle cx={cx - 1.5} cy={noseY - 4.5} r="2.6" fill="#fff" opacity="0.2" filter={blur2} />

        {/* Bouche : lèvre supérieure dans l'ombre, lèvre inférieure éclairée */}
        <path d={`M ${cx - 3} ${noseY + 6.5} L ${cx - 2} ${mouthY - lip * 0.7} M ${cx + 3} ${noseY + 6.5} L ${cx + 2} ${mouthY - lip * 0.7}`} stroke={sk3} strokeOpacity="0.3" strokeWidth="1.2" />
        <path d={`M ${cx - mouthW / 2} ${mouthY} C ${cx - mouthW * 0.3} ${mouthY - lip * 0.75}, ${cx - 3} ${mouthY - lip}, ${cx} ${mouthY - lip * 0.6} C ${cx + 3} ${mouthY - lip}, ${cx + mouthW * 0.3} ${mouthY - lip * 0.75}, ${cx + mouthW / 2} ${mouthY} Q ${cx} ${mouthY + 1.5} ${cx - mouthW / 2} ${mouthY} Z`} fill={shade(skin, -0.42)} />
        <path d={`M ${cx - mouthW / 2} ${mouthY} Q ${cx} ${mouthY + 1.5} ${cx + mouthW / 2} ${mouthY} C ${cx + mouthW * 0.3} ${mouthY + lip * 1.35}, ${cx - mouthW * 0.3} ${mouthY + lip * 1.35}, ${cx - mouthW / 2} ${mouthY} Z`} fill={shade(skin, -0.24)} />
        <path d={`M ${cx - mouthW / 2 - 1} ${mouthY} Q ${cx} ${mouthY + 1.8} ${cx + mouthW / 2 + 1} ${mouthY}`} stroke={sk4} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <ellipse cx={cx - 2} cy={mouthY + lip * 0.6} rx={mouthW * 0.2} ry={lip * 0.25} fill="#fff" opacity="0.2" />
        {a.beard === 2 && <path d={`M ${cx - mouthW / 2 - 5} ${mouthY - 1} C ${cx - mouthW * 0.3} ${mouthY - lip - 5}, ${cx + mouthW * 0.3} ${mouthY - lip - 5}, ${cx + mouthW / 2 + 5} ${mouthY - 1} C ${cx + mouthW * 0.3} ${mouthY - lip - 1}, ${cx - mouthW * 0.3} ${mouthY - lip - 1}, ${cx - mouthW / 2 - 5} ${mouthY - 1} Z`} fill={hair} />}

        {/* Cheveux */}
        {hairStyle(a.hair, cx, top, faceW, eyeY, `url(#${id}h)`, hair, hairL, hairD)}
        {a.headband && (
          <g>
            <path d={`M ${cx - faceW - 1} ${top + 30} C ${cx - 22} ${top + 19}, ${cx + 22} ${top + 19}, ${cx + faceW + 1} ${top + 30} L ${cx + faceW + 1} ${top + 42} C ${cx + 22} ${top + 31}, ${cx - 22} ${top + 31}, ${cx - faceW - 1} ${top + 42} Z`} fill={trim} />
            <path d={`M ${cx + 8} ${top + 22} C ${cx + 24} ${top + 22}, ${cx + faceW - 6} ${top + 26}, ${cx + faceW + 1} ${top + 30} L ${cx + faceW + 1} ${top + 42} C ${cx + faceW - 6} ${top + 38}, ${cx + 24} ${top + 33}, ${cx + 8} ${top + 32} Z`} fill="#000" opacity="0.22" />
          </g>
        )}
        <rect width="200" height="240" fill={`url(#${id}vig)`} />
      </g>
      {frame && <rect x="1" y="1" width="198" height="238" rx="21" fill="none" stroke={trim} strokeOpacity="0.35" strokeWidth="2" />}
    </svg>
  );
}

function hairStyle(style: number, cx: number, top: number, w: number, eyeY: number, grad: string, base: string, light: string, dark: string) {
  const hl = top + 26; // ligne d'implantation
  const tY = eyeY - 10; // tempes
  // Calotte commune : du haut du crâne jusqu'à la ligne d'implantation, pattes sur les tempes
  const cap = (lift: number, side: number) =>
    `M ${cx - w - side} ${tY} C ${cx - w - side - 2} ${top + 8 - lift}, ${cx - w * 0.6} ${top - 4 - lift}, ${cx} ${top - 4 - lift} C ${cx + w * 0.6} ${top - 4 - lift}, ${cx + w + side + 2} ${top + 8 - lift}, ${cx + w + side} ${tY} L ${cx + w - 5} ${tY - 2} C ${cx + w - 6} ${hl + 4}, ${cx + w * 0.55} ${hl - 3}, ${cx} ${hl - 2} C ${cx - w * 0.55} ${hl - 3}, ${cx - w + 6} ${hl + 4}, ${cx - w + 5} ${tY - 2} Z`;
  switch (style) {
    case 0: // coupe dégradée (fade)
      return (
        <g>
          <path d={cap(1, 0)} fill={base} opacity="0.55" />
          <path d={`M ${cx - w + 4} ${hl + 6} C ${cx - w + 2} ${top + 4}, ${cx - w * 0.55} ${top - 5}, ${cx} ${top - 5} C ${cx + w * 0.55} ${top - 5}, ${cx + w - 2} ${top + 4}, ${cx + w - 4} ${hl + 6} C ${cx + w * 0.5} ${hl - 4}, ${cx - w * 0.5} ${hl - 4}, ${cx - w + 4} ${hl + 6} Z`} fill={grad} />
          <path d={`M ${cx - w * 0.5} ${top + 4} q ${w * 0.5} -8 ${w} 0`} stroke={light} strokeOpacity="0.3" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 1: // court texturé
      return (
        <g>
          <path d={cap(5, 1)} fill={grad} />
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={i} d={`M ${cx - w + 8 + (i % 7) * ((2 * w - 16) / 6)} ${top + 4 + Math.floor(i / 7) * 10} q 3 -5 6 -1`} stroke={light} strokeOpacity="0.4" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          ))}
        </g>
      );
    case 2: // afro
      return (
        <g>
          <path d={`M ${cx - w - 3} ${tY + 4} C ${cx - w - 24} ${top + 20}, ${cx - w - 8} ${top - 30}, ${cx} ${top - 30} C ${cx + w + 8} ${top - 30}, ${cx + w + 24} ${top + 20}, ${cx + w + 3} ${tY + 4} L ${cx + w - 5} ${tY - 2} C ${cx + w - 6} ${hl + 4}, ${cx + w * 0.55} ${hl - 3}, ${cx} ${hl - 2} C ${cx - w * 0.55} ${hl - 3}, ${cx - w + 6} ${hl + 4}, ${cx - w + 5} ${tY - 2} Z`} fill={grad} />
          {Array.from({ length: 27 }).map((_, i) => (
            <circle key={i} cx={cx - w - 4 + (i % 9) * ((2 * w + 8) / 8)} cy={top - 20 + Math.floor(i / 9) * 13 + (i % 2) * 4} r="5.5" fill={i % 3 === 0 ? dark : light} opacity="0.16" />
          ))}
        </g>
      );
    case 3: // tresses plaquées
      return (
        <g>
          <path d={cap(3, 0)} fill={dark} />
          {Array.from({ length: 8 }).map((_, i) => {
            const x = cx - w + 7 + i * ((2 * w - 14) / 7);
            return <path key={i} d={`M ${x} ${hl + (Math.abs(i - 3.5) > 3 ? 8 : 0)} C ${x + (x - cx) * 0.04} ${top + 14}, ${cx + (x - cx) * 0.6} ${top + 2}, ${cx + (x - cx) * 0.45} ${top - 6}`} stroke={light} strokeOpacity="0.75" strokeWidth="3.2" fill="none" strokeDasharray="3.2 1.6" strokeLinecap="round" />;
          })}
        </g>
      );
    case 4: // dreadlocks attachées en chignon
      return (
        <g>
          <ellipse cx={cx + 4} cy={top - 12} rx="17" ry="13" fill={grad} />
          <path d={cap(3, 1)} fill={grad} />
          {Array.from({ length: 9 }).map((_, i) => {
            const x = cx - w + 8 + i * ((2 * w - 16) / 8);
            return <path key={i} d={`M ${x} ${hl + 2} C ${x} ${top + 12}, ${cx + (x - cx) * 0.4} ${top}, ${cx + 4 + (x - cx) * 0.2} ${top - 10}`} stroke={dark} strokeOpacity="0.7" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
          })}
          <path d={`M ${cx - 10} ${top - 6} q 14 -8 28 0`} stroke={light} strokeOpacity="0.5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    default: // crâne rasé : ombre de repousse et reflet
      return (
        <g>
          <path d={cap(0, 0)} fill={base} opacity="0.16" />
          <ellipse cx={cx - 10} cy={top + 10} rx={w * 0.45} ry="7" fill="#fff" opacity="0.16" />
        </g>
      );
  }
}
