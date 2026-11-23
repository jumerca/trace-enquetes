// Pictogrammes vectoriels originaux (trait), cohérents avec la charte.
const P: Record<string, string> = {
  pause: 'M7 5v14M17 5v14',
  play: 'M7 4l13 8-13 8z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0.01 0',
  close: 'M6 6l12 12M18 6L6 18',
  coin: 'M12 4a8 8 0 1 0 0.01 0M9 9.5c0-1.2 1.3-2 3-2s3 .8 3 2-1.3 1.8-3 2.2-3 1-3 2.3 1.3 2 3 2 3-.8 3-2M12 6v2M12 16v2',
  sun: 'M12 8a4 4 0 1 0 0.01 0M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  cloud: 'M7 18h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.7 1.5A3.3 3.3 0 0 0 7 18z',
  rain: 'M7 14h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.7 1.5A3.3 3.3 0 0 0 7 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3',
  storm: 'M7 14h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.7 1.5A3.3 3.3 0 0 0 7 14zM12 15l-2 4h3l-2 4',
  snow: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5',
  smile: 'M12 3a9 9 0 1 0 0.01 0M8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  hammer: 'M14 4l6 6-2 2-6-6zM12 6L4 14v0l3 3 8-8M4 14l-1 6 6-1',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  wheat: 'M12 21V9M12 9c-2-1-3-3-3-5 2 0 3 1.5 3 3M12 9c2-1 3-3 3-5-2 0-3 1.5-3 3M12 13c-2-1-3-3-3-5M12 13c2-1 3-3 3-5M12 17c-2-1-3-3-3-5M12 17c2-1 3-3 3-5',
  people: 'M9 11a3 3 0 1 0 0.01 0M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 1 0 0.01 0M16 14.2c2.8.3 5 2.6 5 5.8',
  cart: 'M3 4h2.5l2.2 10.5h10.6L21 7H6.4M9 19a1.3 1.3 0 1 0 .01 0M17 19a1.3 1.3 0 1 0 .01 0',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  check: 'M5 12.5l4.5 4.5L19 7',
  path: 'M6 21c0-6 12-6 12-12V3M10 21c0-3 6-4 6-8',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  info: 'M12 3a9 9 0 1 0 0.01 0M12 11v6M12 7.5h.01',
  save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 21V9M7 14l5-5 5 5M4 4h16',
  gear: 'M12 9a3 3 0 1 0 0.01 0M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  chevron: 'M6 9l6 6 6-6',
  leaf: 'M5 19c0-9 6-14 15-15-1 9-6 15-15 15zM5 19l8-8',
};

export function Icon({ name, size = 20, title }: { name: keyof typeof P | string; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name] ?? P.info} />
    </svg>
  );
}

export const WEATHER_ICON: Record<string, string> = { soleil: 'sun', nuageux: 'cloud', pluie: 'rain', orage: 'storm', neige: 'snow' };
