// Logo original de Brigade criminelle Tycoon (vectoriel, aucune ressource externe).
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact)
    return (
      <svg className={className} viewBox="0 0 64 64" aria-label="Brigade criminelle Tycoon">
        <path d="M32 3 L56 11 L54 36 C52 48 42 56 32 61 C22 56 12 48 10 36 L8 11 Z" fill="#1f3a6e" stroke="#d89a3a" strokeWidth="3" />
        <circle cx="29" cy="28" r="11" fill="#f6efdd" stroke="#1d1a17" strokeWidth="3" />
        <path d="M37 36 L47 47" stroke="#1d1a17" strokeWidth="6" strokeLinecap="round" />
        <path d="M22 32 L22 24 L26 24 L26 20 L30 20 L30 26 L34 26 L34 32 Z" fill="#1d1a17" />
      </svg>
    );
  return (
    <svg className={className} viewBox="0 0 600 330" role="img" aria-label="Brigade criminelle Tycoon — Sous haute tension">
      <defs>
        <linearGradient id="lg-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2c3e66" />
          <stop offset="1" stopColor="#d89a3a" />
        </linearGradient>
        <path id="lg-arc" d="M95 150 A205 205 0 0 1 505 150" />
      </defs>
      {/* écusson */}
      <path d="M300 18 L470 52 L462 170 C455 230 390 270 300 300 C210 270 145 230 138 170 L130 52 Z" fill="#1f3a6e" stroke="#1d1a17" strokeWidth="8" />
      <path d="M300 34 L454 64 L447 168 C441 220 382 255 300 283 C218 255 159 220 153 168 L146 64 Z" fill="url(#lg-sky)" stroke="#f6efdd" strokeWidth="3" />
      {/* silhouette de ville française : beffroi, toits, clocher */}
      <path d="M160 200 L160 168 L182 168 L182 150 L196 138 L210 150 L210 172 L232 172 L232 160 L250 160 L250 120 L258 104 L266 120 L266 160 L286 160 L286 176 L310 176 L310 140 L322 128 L334 140 L334 176 L356 176 L356 150 L376 150 L376 166 L398 166 L398 146 L412 134 L426 146 L426 182 L444 182 L440 200 Z" fill="#1d1a17" />
      {[[188, 160], [200, 160], [262, 132], [258, 146], [320, 150], [328, 162], [364, 160], [408, 156], [416, 170], [296, 186]].map(([x, y], i) => <rect key={i} x={x} y={y} width="5" height="7" fill="#f2c86a" />)}
      {/* loupe */}
      <circle cx="300" cy="118" r="44" fill="rgba(246,239,221,.18)" stroke="#f6efdd" strokeWidth="10" />
      <circle cx="300" cy="118" r="44" fill="none" stroke="#1d1a17" strokeWidth="3" />
      <path d="M332 150 L372 192" stroke="#1d1a17" strokeWidth="20" strokeLinecap="round" />
      <path d="M332 150 L372 192" stroke="#8a5a2a" strokeWidth="12" strokeLinecap="round" />
      <path d="M282 98 A26 26 0 0 1 312 92" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".8" />
      {/* titre */}
      <text fontFamily="Georgia, serif" fontWeight="900" fontSize="30" fill="#f6efdd" stroke="#1d1a17" strokeWidth="1.2" letterSpacing="4">
        <textPath href="#lg-arc" startOffset="50%" textAnchor="middle">BRIGADE CRIMINELLE</textPath>
      </text>
      <text x="300" y="250" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="78" fill="#d89a3a" stroke="#1d1a17" strokeWidth="5" paintOrder="stroke" letterSpacing="6">TYCOON</text>
      {/* bandeau */}
      <path d="M120 268 L480 268 L462 292 L480 316 L120 316 L138 292 Z" fill="#c83a2a" stroke="#1d1a17" strokeWidth="5" />
      <text x="300" y="300" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="22" fill="#fff" letterSpacing="5">SOUS HAUTE TENSION</text>
    </svg>
  );
}
