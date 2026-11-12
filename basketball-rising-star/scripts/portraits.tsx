import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerPortrait } from '../src/ui/components/PlayerPortrait';
const out: string[] = [];
const cols: [string, string][] = [['#1b2a4a', '#F6F4EF'], ['#F36B32', '#101827'], ['#F2F0EA', '#3988F5'], ['#7a1f2b', '#DDB65A']];
for (let i = 0; i < 12; i++) {
  const a = { skin: i % 5, hair: i % 6, hairColor: i % 4, beard: i % 3, headband: i % 5 === 0, sleeve: false } as never;
  out.push(renderToStaticMarkup(createElement(PlayerPortrait, { a, colors: cols[i % 4], number: 4 + i * 3, size: 190, seedKey: 'p' + i * 17, weightKg: 80 + i * 3, heightCm: 185 + i * 2 })));
}
writeFileSync(process.argv[2], `<body style="background:#101827;display:flex;flex-wrap:wrap;gap:12px;padding:12px;width:1240px">${out.join('')}</body>`);
