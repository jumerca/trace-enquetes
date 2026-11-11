import type { Appearance } from '../../data/model';
import { PlayerPortrait } from './PlayerPortrait';

/** Emblème original : ballon stylisé porté par une trajectoire ascendante vers une étoile. */
export function Emblem({ size = 48 }: { size?: number; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Emblème Basketball Rising Star">
<defs>
    <linearGradient id="em2-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b2c4d"/><stop offset="0.55" stopColor="#101827"/><stop offset="1" stopColor="#070b14"/></linearGradient>
    <radialGradient id="em2-glow" cx="0.72" cy="0.2" r="0.7"><stop offset="0" stopColor="#3988F5" stopOpacity="0.55"/><stop offset="1" stopColor="#3988F5" stopOpacity="0"/></radialGradient>
    <linearGradient id="em2-arc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#F36B32" stopOpacity="0"/><stop offset="0.35" stopColor="#F36B32"/><stop offset="1" stopColor="#FFD98A"/></linearGradient>
    <radialGradient id="em2-ball" cx="0.34" cy="0.28" r="0.85"><stop offset="0" stopColor="#ffb07a"/><stop offset="0.5" stopColor="#F36B32"/><stop offset="1" stopColor="#a53c12"/></radialGradient>
    <linearGradient id="em2-star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE9A8"/><stop offset="1" stopColor="#DDB65A"/></linearGradient>
    <clipPath id="em2-clip"><rect width="512" height="512" rx="116"/></clipPath>
  </defs>
  <g clipPath="url(#em2-clip)">
    <rect width="512" height="512" fill="url(#em2-bg)"/>
    <rect width="512" height="512" fill="url(#em2-glow)"/>
    
    <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="10"><path d="M-20 420 L540 330"/><path d="M-20 480 L540 390"/></g>
    
    <path d="M40 452 C 170 430, 300 320, 398 120" fill="none" stroke="url(#em2-arc)" strokeWidth="34" strokeLinecap="round"/>
    <path d="M96 476 C 210 452, 320 370, 392 250" fill="none" stroke="#3988F5" strokeOpacity="0.45" strokeWidth="12" strokeLinecap="round"/>
    
    <g transform="translate(214 306)">
      <circle r="128" fill="#000" opacity="0.25" transform="translate(8 12)"/>
      <circle r="124" fill="url(#em2-ball)"/>
      <g fill="none" stroke="#2a1206" strokeWidth="11" strokeLinecap="round" opacity="0.88">
        <path d="M0 -124 C 46 -54, 46 54, 0 124"/>
        <path d="M-124 0 H 124"/>
        <path d="M-88 -88 C -34 -36, -34 36, -88 88"/>
        <path d="M88 -88 C 34 -36, 34 36, 88 88"/>
      </g>
      <path d="M-70 -84 A 104 104 0 0 1 34 -104" stroke="#fff" strokeOpacity="0.4" strokeWidth="14" fill="none" strokeLinecap="round"/>
    </g>
    
    <path d="M404 40 L424 92 L478 96 L436 130 L450 184 L404 154 L358 184 L372 130 L330 96 L384 92 Z" fill="url(#em2-star)" stroke="#8a6a22" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M404 62 L416 100 L404 96 Z" fill="#fff" opacity="0.5"/>
  </g>

    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="row" style={{ gap: 12 }}>
      <Emblem size={compact ? 38 : 64} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, letterSpacing: '0.34em', fontSize: compact ? 9 : 12, color: 'var(--muted)' }}>BASKETBALL</div>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: compact ? 22 : 40, letterSpacing: '0.01em' }}>
          RISING <span style={{ color: 'var(--orange)' }}>STAR</span>
        </div>
      </div>
    </div>
  );
}

/** Portrait illustré : délègue au générateur détaillé (hauteur = size). */
export function Portrait({ a, colors, number, size = 96, seedKey, weightKg, heightCm }: { a: Appearance; colors: [string, string]; number: number; size?: number; seedKey?: string; weightKg?: number; heightCm?: number }) {
  return <PlayerPortrait a={a} colors={colors} number={number} size={size / 1.2} seedKey={seedKey ?? `${a.skin}${a.hair}${a.hairColor}${number}`} weightKg={weightKg} heightCm={heightCm} />;
}

/** Illustration de l'écran d'accueil : un joueur s'élève vers le cercle dans une salle éclairée. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 900 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="h-spot" cx="0.62" cy="0.28" r="0.6">
          <stop offset="0" stopColor="#3988F5" stopOpacity="0.35" />
          <stop offset="1" stopColor="#101827" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="h-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c98d55" stopOpacity="0.0" />
          <stop offset="0.3" stopColor="#c98d55" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7a4d27" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="h-jersey" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a9bff" />
          <stop offset="1" stopColor="#1f5fc4" />
        </linearGradient>
        <linearGradient id="h-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b77a52" />
          <stop offset="1" stopColor="#7a4b2e" />
        </linearGradient>
        <radialGradient id="h-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffab78" />
          <stop offset="0.6" stopColor="#F36B32" />
          <stop offset="1" stopColor="#a63f14" />
        </radialGradient>
        <linearGradient id="h-trail" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F36B32" stopOpacity="0" />
          <stop offset="1" stopColor="#F36B32" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect width="900" height="700" fill="url(#h-spot)" />
      {/* Projecteurs */}
      <g opacity="0.5">
        <path d="M560 0 L470 520 L640 520 Z" fill="#3988F5" opacity="0.08" />
        <path d="M760 0 L640 520 L840 520 Z" fill="#F6F4EF" opacity="0.05" />
      </g>
      {/* Tribunes stylisées */}
      <g opacity="0.35">
        {Array.from({ length: 6 }).map((_, r) => (
          <g key={r}>
            {Array.from({ length: 40 }).map((__, i) => (
              <rect key={i} x={i * 24 + (r % 2) * 12} y={360 + r * 16} width="14" height="9" rx="3" fill={(i * 7 + r * 3) % 9 === 0 ? '#F36B32' : (i + r) % 5 === 0 ? '#3988F5' : '#24314c'} />
            ))}
          </g>
        ))}
      </g>
      {/* Parquet */}
      <path d="M0 470 L900 440 L900 700 L0 700 Z" fill="url(#h-floor)" />
      <path d="M0 560 L900 520" stroke="#F6F4EF" strokeOpacity="0.35" strokeWidth="3" />
      <ellipse cx="560" cy="610" rx="230" ry="40" fill="none" stroke="#F6F4EF" strokeOpacity="0.25" strokeWidth="3" />
      {/* Panier */}
      <g>
        <rect x="770" y="60" width="16" height="420" fill="#1b2333" />
        <rect x="700" y="120" width="16" height="150" rx="3" fill="#d9e8ff" opacity="0.55" stroke="#F6F4EF" strokeWidth="3" />
        <rect x="716" y="160" width="60" height="10" fill="#1b2333" />
        <ellipse cx="660" cy="232" rx="46" ry="12" fill="none" stroke="#F36B32" strokeWidth="6" />
        <g stroke="#F6F4EF" strokeOpacity="0.85" strokeWidth="2.2" className="net">
          <path d="M616 234 L630 296 M632 240 L640 300 M648 243 L652 302 M664 243 L664 302 M680 241 L676 300 M696 236 L686 296 M704 232 L690 294" />
          <path d="M622 262 C 640 270, 680 270, 698 262 M630 288 C 645 294, 675 294, 688 288" fill="none" />
        </g>
      </g>
      {/* Traînée du ballon */}
      <path d="M380 520 C 470 420, 560 300, 630 214" fill="none" stroke="url(#h-trail)" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 18" />
      {/* Joueur en extension vers le cercle */}
      <g className="hero-player">
        <ellipse cx="470" cy="600" rx="90" ry="16" fill="#000" opacity="0.35" />
        {/* jambe arrière */}
        <path d="M455 410 C 430 450, 410 480, 380 500" stroke="url(#h-skin)" strokeWidth="26" strokeLinecap="round" fill="none" />
        <path d="M380 500 L352 512" stroke="#F6F4EF" strokeWidth="18" strokeLinecap="round" />
        {/* jambe avant (genou levé) */}
        <path d="M480 405 C 520 420, 540 440, 520 480" stroke="url(#h-skin)" strokeWidth="26" strokeLinecap="round" fill="none" />
        <path d="M520 480 L532 506" stroke="#F6F4EF" strokeWidth="18" strokeLinecap="round" />
        {/* short */}
        <path d="M440 360 L500 352 L512 420 L446 430 Z" fill="#163a78" />
        <path d="M444 420 L510 410" stroke="#DDB65A" strokeWidth="4" />
        {/* torse */}
        <path d="M446 250 C 470 238, 520 238, 532 256 L512 362 L440 368 Z" fill="url(#h-jersey)" />
        <path d="M466 246 L486 270 L506 244" fill="none" stroke="#F6F4EF" strokeWidth="5" />
        <text x="486" y="330" textAnchor="middle" fontFamily="Barlow Condensed, Inter, sans-serif" fontWeight="800" fontSize="46" fill="#F6F4EF">
          23
        </text>
        {/* bras gauche (équilibre) */}
        <path d="M450 262 C 420 290, 400 300, 380 296" stroke="url(#h-skin)" strokeWidth="18" strokeLinecap="round" fill="none" />
        {/* bras droit tendu vers le cercle */}
        <path d="M520 256 C 556 228, 590 214, 612 204" stroke="url(#h-skin)" strokeWidth="18" strokeLinecap="round" fill="none" />
        {/* tête */}
        <circle cx="492" cy="214" r="24" fill="url(#h-skin)" />
        <path d="M468 210 C 470 186, 516 186, 516 210 C 506 198, 478 198, 468 210 Z" fill="#1b1410" />
        <rect x="468" y="200" width="48" height="6" rx="3" fill="#F36B32" />
      </g>
      {/* Ballon */}
      <g className="hero-ball" transform="translate(628 196)">
        <circle r="24" fill="url(#h-ball)" />
        <g fill="none" stroke="#2a1206" strokeWidth="2.6" opacity="0.8">
          <path d="M0 -24 C 9 -10, 9 10, 0 24" />
          <path d="M-24 0 H 24" />
          <path d="M-17 -17 C -6 -7, -6 7, -17 17" />
        </g>
      </g>
      <style>{`
        .hero-player, .hero-ball { animation: brs-float 4.5s ease-in-out infinite; transform-box: fill-box; }
        .hero-ball { animation-delay: .15s; }
        @keyframes brs-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -10px; } }
        @media (prefers-reduced-motion: reduce) { .hero-player, .hero-ball { animation: none; } }
      `}</style>
    </svg>
  );
}
