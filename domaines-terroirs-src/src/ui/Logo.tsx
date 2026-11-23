// Logo original « Domaines & Terroirs » — enseigne de bois, grappe, épi et pomme (vectoriel).
export function Logo({ width = 360 }: { width?: number }) {
  return (
    <svg className="logo" width={width} viewBox="0 0 400 190" role="img" aria-label="Domaines & Terroirs">
      <defs>
        <linearGradient id="lg-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a34" />
          <stop offset="0.55" stopColor="#6b4226" />
          <stop offset="1" stopColor="#4a2c18" />
        </linearGradient>
        <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d98a" />
          <stop offset="1" stopColor="#f2b765" />
        </linearGradient>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="1" stopColor="#e9c87a" />
        </linearGradient>
      </defs>
      {/* médaillon : paysage */}
      <path d="M140 52 a60 40 0 0 1 120 0z" fill="url(#lg-sky)" stroke="#5a3a20" strokeWidth="3" />
      <path d="M142 52 q20 -16 40 -8 t42 -6 t34 10 v4z" fill="#7a9a46" />
      <path d="M150 52 q28 -10 50 -2 t52 2z" fill="#5f8a34" />
      {[166, 182, 214, 232].map((x, i) => (
        <g key={i}>
          <rect x={x - 1} y={36 - (i % 2) * 3} width="2" height="10" fill="#4a3020" />
          <circle cx={x} cy={33 - (i % 2) * 3} r="5.5" fill="#4f7a34" />
        </g>
      ))}
      <rect x="196" y="34" width="12" height="10" fill="#e8d6aa" />
      <path d="M193 35 l9 -7 l9 7z" fill="#b8553a" />
      {/* enseigne */}
      <path d="M40 58 h320 q14 0 14 14 v62 q0 14 -14 14 h-130 l-30 22 l-30 -22 h-130 q-14 0 -14 -14 v-62 q0 -14 14 -14z" fill="url(#lg-wood)" stroke="#3a2212" strokeWidth="4" />
      <path d="M48 66 h304 q8 0 8 8 v58 q0 8 -8 8 h-304 q-8 0 -8 -8 v-58 q0 -8 8 -8z" fill="none" stroke="#c99a5a" strokeWidth="1.5" opacity="0.7" />
      {[86, 104, 122].map((y) => (
        <path key={y} d={`M44 ${y} q80 -3 160 0 t156 0`} stroke="#5a361e" strokeWidth="1" opacity="0.45" fill="none" />
      ))}
      <text x="200" y="100" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="38" fontWeight="700" fill="url(#lg-gold)" stroke="#3a2212" strokeWidth="1.2" letterSpacing="1">DOMAINES</text>
      <text x="200" y="133" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="30" fontWeight="700" fill="url(#lg-gold)" stroke="#3a2212" strokeWidth="1" letterSpacing="1">&amp; TERROIRS</text>
      {/* grappe */}
      <g transform="translate(34 70)">
        <path d="M14 -6 q8 -10 18 -6" stroke="#5f8a34" strokeWidth="3" fill="none" />
        <path d="M6 -4 q-12 -8 -4 -18 q10 2 12 14z" fill="#6fa040" stroke="#3f6a24" strokeWidth="1.5" />
        {[[10, 4], [20, 4], [5, 13], [15, 13], [25, 13], [10, 22], [20, 22], [15, 31]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5.6" fill="#6a3a8a" stroke="#3a1a50" strokeWidth="1" />
        ))}
        {[[8, 2], [18, 11], [8, 20]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#c8a8e8" />
        ))}
      </g>
      {/* épi de blé */}
      <g transform="translate(352 66) rotate(18)">
        <path d="M0 0 v60" stroke="#c89a3a" strokeWidth="2.5" />
        {[0, 9, 18, 27, 36].map((y) => (
          <g key={y}>
            <ellipse cx="-5" cy={y + 6} rx="3.4" ry="6.5" transform={`rotate(-25 -5 ${y + 6})`} fill="#e8c05a" stroke="#a87a2a" strokeWidth="0.8" />
            <ellipse cx="5" cy={y + 6} rx="3.4" ry="6.5" transform={`rotate(25 5 ${y + 6})`} fill="#e8c05a" stroke="#a87a2a" strokeWidth="0.8" />
          </g>
        ))}
      </g>
      {/* pomme */}
      <g transform="translate(200 166)">
        <circle cx="-6" cy="0" r="9" fill="#d2322a" />
        <circle cx="6" cy="0" r="9" fill="#c22a24" />
        <path d="M0 -8 q2 -6 6 -8" stroke="#5a3a20" strokeWidth="2" fill="none" />
        <path d="M2 -12 q8 -6 12 0 q-6 4 -12 0z" fill="#6fa040" />
        <ellipse cx="-8" cy="-3" rx="2.5" ry="3.5" fill="#ff8a7a" opacity="0.7" />
      </g>
      <text x="200" y="186" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="#f3e6c4" letterSpacing="4" opacity="0.9">JLG CREATIVE</text>
    </svg>
  );
}
