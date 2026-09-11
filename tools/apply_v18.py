from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'index-1.html'; LOADER=ROOT/'index.html'; TOOLS=ROOT/'tools'
MARK='<!-- TRACE V18 INVESTIGATION OS -->'
s=APP.read_text(encoding='utf-8')
if MARK in s:
    print('TRACE V18 already applied'); sys.exit(0)
required=['function renderHome()','function renderCase()','function openEvidence(id)','function renderReport()','function caseReadiness(c,p)','function availableLinks(c)']
missing=[x for x in required if x not in s]
if missing: raise RuntimeError('TRACE V18: socle incompatible: '+', '.join(missing))
parts=sorted(TOOLS.glob('v18_payload_*.txt'))
if not parts: raise RuntimeError('TRACE V18: payload absent')
addon=''.join(p.read_text(encoding='utf-8') for p in parts)
if MARK not in addon or '<style id="trace-v18-css">' not in addon or '<script id="trace-v18-js">' not in addon:
    raise RuntimeError('TRACE V18: payload incomplet')
s=s.replace('</body>',addon+'</body>',1)
APP.write_text(s,encoding='utf-8')
if LOADER.exists():
    l=LOADER.read_text(encoding='utf-8')
    if 'index-1.html?v=local-v17' in l: l=l.replace('index-1.html?v=local-v17','index-1.html?v=local-v18')
    elif 'index-1.html?v=local-v18' not in l: l=l.replace('index-1.html','index-1.html?v=local-v18',1)
    LOADER.write_text(l,encoding='utf-8')
print('TRACE V18 Investigation OS applied')
