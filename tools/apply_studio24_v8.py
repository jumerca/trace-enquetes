import base64, zlib, re
from pathlib import Path

ROOT=Path('.')
APP=ROOT/'studio24'
PARTS=ROOT/'tools'/'v8_parts'

js_b64=''.join((PARTS/f'p{i}.txt').read_text().strip() for i in range(1,5))
css_b64=(PARTS/'css.txt').read_text().strip()
(APP/'v8-enhance.js').write_bytes(zlib.decompress(base64.b64decode(js_b64)))
(APP/'v8.css').write_bytes(zlib.decompress(base64.b64decode(css_b64)))

index=(APP/'index.html').read_text()
if 'v8.css' not in index:
    index=index.replace('<link rel="stylesheet" href="v7.css" />','<link rel="stylesheet" href="v7.css" />\n  <link rel="stylesheet" href="v8.css" />')
if 'v8-enhance.js' not in index:
    index=index.replace('<script src="v7-enhance.js"></script>','<script src="v7-enhance.js"></script>\n  <script src="v8-enhance.js"></script>')
index=index.replace('V7 LIVING ANTENNA','V8 NETWORK UNIVERSE')
index=index.replace('STUDIO 24 · LIVING ANTENNA','STUDIO 24 · NETWORK UNIVERSE')
index=index.replace('Studio 24 · V7 Living Antenna','Studio 24 · V8 Network Universe')
index=index.replace('<b>V7</b>','<b>V8</b>')
(APP/'index.html').write_text(index)

sw="""const CACHE='studio24-v8-network-universe-1';
const ASSETS=['./','index.html','styles.css','mobile.css','v6.css','v7.css','v8.css','app-core.js','app-pages.js','app-engine.js','v6-enhance.js','v7-enhance.js','v8-enhance.js','install-helper.js','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))))});
"""
(APP/'sw.js').write_text(sw)

js=(APP/'v8-enhance.js').read_text()
acts=set(re.findall(r'data-act=["\\\']([^"\\\']+)',js))
handled=set(re.findall(r"a==='([^']+)'",js))
missing=sorted(acts-handled)
if missing:
    raise SystemExit('Missing V8 action handlers: '+', '.join(missing))
print('V8_ACTIONS_OK',len(acts))
