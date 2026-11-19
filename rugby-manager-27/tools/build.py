#!/usr/bin/env python3
"""Assemble Rugby Manager 27 V2.0.

Entrées : src/legacy (V1.6 découpée, inchangée), src/v2 (moteur, rendu, interface, carrière).
Sorties :
  dist/Rugby_Manager_27_V2_0.html   fichier autonome jouable hors connexion
  dist/PWA/                         version installable (HTTPS)
  index.html, sw.js, manifest.webmanifest, icônes  à la racine du dossier (publication GitHub Pages)
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
LEG = os.path.join(SRC, 'legacy')
V2 = os.path.join(SRC, 'v2')
VERSION = '2.2'

V2_JS = ['engine/rm2_core.js', 'engine/rm2_ai.js', 'engine/rm2_phases.js', 'engine/rm2_plays.js', 'engine/rm2_quick.js',
         'render/rm2_render.js', 'ui/rm2_match_ui.js', 'career/rm2_career.js', 'ui/rm2_shell.js']


def read(p):
    with open(p, encoding='utf8') as f:
        return f.read()


def build_html():
    t = read(os.path.join(LEG, 'template.html'))
    legacy_js = sorted(f for f in os.listdir(LEG) if f.endswith('.js'))
    legacy_css = sorted(os.listdir(os.path.join(LEG, 'css')))
    for i, f in enumerate(legacy_js):
        t = t.replace('/*@@JS%d@@*/' % i, read(os.path.join(LEG, f)).replace('</script', '<\\/script'), 1)
    for i, f in enumerate(legacy_css):
        t = t.replace('/*@@CSS%d@@*/' % i, read(os.path.join(LEG, 'css', f)), 1)
    assert '@@JS' not in t and '@@CSS' not in t, 'gabarit incomplet'
    t = t.replace('<title>Rugby Manager 27 — Édition Jouable</title>', '<title>Rugby Manager 27 — V%s</title><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png"><meta name="rm27-version" content="%s">' % (VERSION, VERSION))
    css = read(os.path.join(V2, 'ui', 'rm2.css'))
    t = t.replace('</head>', '<style id="rm27-v2-css">\n%s</style></head>' % css, 1)
    js = '\n'.join('/* ==== %s ==== */\n%s' % (f, read(os.path.join(V2, f))) for f in V2_JS)
    t = t.replace('</body></html>', '<script id="rm27-v2">\n%s\n</script></body></html>' % js.replace('</script', '<\\/script'), 1)
    return t


def main():
    html = build_html()
    dist = os.path.join(ROOT, 'dist')
    pwa = os.path.join(dist, 'PWA')
    os.makedirs(pwa, exist_ok=True)
    standalone = html.replace('<link rel="manifest" href="manifest.webmanifest">', '')
    with open(os.path.join(dist, 'Rugby_Manager_27_V2_0.html'), 'w', encoding='utf8') as f:
        f.write(standalone)
    manifest = {
        "id": "./", "name": "Rugby Manager 27 — V2.0", "short_name": "Rugby 27",
        "start_url": "./index.html", "scope": "./", "display": "standalone", "orientation": "any",
        "background_color": "#0b1019", "theme_color": "#0d1918", "lang": "fr",
        "description": "Rugby Manager 27 V2.0 — JLG Creative. Gestion de club de rugby à XV et moteur de match 2D multi-agents.",
        "icons": [{"src": "./icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
                  {"src": "./icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
    sw = read(os.path.join(V2, 'ui', 'sw.js'))
    for target in (pwa, ROOT):
        with open(os.path.join(target, 'index.html'), 'w', encoding='utf8') as f:
            f.write(html)
        with open(os.path.join(target, 'manifest.webmanifest'), 'w', encoding='utf8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        with open(os.path.join(target, 'sw.js'), 'w', encoding='utf8') as f:
            f.write(sw)
        for icon in ('icon-192.png', 'icon-512.png'):
            if os.path.abspath(os.path.join(SRC, icon)) != os.path.abspath(os.path.join(target, icon)):
                shutil.copy(os.path.join(SRC, icon), os.path.join(target, icon))
    print('OK', len(html) // 1024, 'Ko')


if __name__ == '__main__':
    main()
