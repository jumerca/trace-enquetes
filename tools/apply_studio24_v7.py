from pathlib import Path

index = Path('studio24/index.html')
text = index.read_text(encoding='utf-8')
if 'v7.css' not in text:
    text = text.replace('<link rel="stylesheet" href="v6.css" />', '<link rel="stylesheet" href="v6.css" />\n  <link rel="stylesheet" href="v7.css" />')
if 'v7-enhance.js' not in text:
    text = text.replace('<script src="v6-enhance.js"></script>', '<script src="v6-enhance.js"></script>\n  <script src="v7-enhance.js"></script>')
index.write_text(text, encoding='utf-8')

sw = Path('studio24/sw.js')
s = sw.read_text(encoding='utf-8')
s = s.replace("const CACHE='studio24-v6-install-2';", "const CACHE='studio24-v7-living-antenna-1';")
if "'v7.css'" not in s:
    s = s.replace("'v6.css'", "'v6.css','v7.css'")
if "'v7-enhance.js'" not in s:
    s = s.replace("'v6-enhance.js'", "'v6-enhance.js','v7-enhance.js'")
sw.write_text(s, encoding='utf-8')

print('Studio 24 V7 wiring applied')
