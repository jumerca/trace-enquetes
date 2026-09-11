from pathlib import Path
import re, sys, subprocess, shutil

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'index-1.html'
LOADER = ROOT / 'index.html'
MEDIA = ROOT / 'media'
MEDIA.mkdir(exist_ok=True)

s = APP.read_text(encoding='utf-8')
if '<!-- TRACE V17 QUALITY PASS -->' in s:
    print('TRACE V17 already applied')
    sys.exit(0)

# 1. Rebuild the room-17 CCTV exhibit as a proper 10-second surveillance clip.
# The frame is deliberately CCTV-like: realistic corridor perspective, door 17,
# service stair edge, low-light palette, timestamp, grain and brief service-side movement.
frame_svg = r'''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="404" viewBox="0 0 720 404">
<defs>
 <linearGradient id="wall" x2="0" y2="1"><stop stop-color="#555b5e"/><stop offset="1" stop-color="#242a2e"/></linearGradient>
 <linearGradient id="floor" x2="0" y2="1"><stop stop-color="#4b4e4d"/><stop offset="1" stop-color="#171b1d"/></linearGradient>
 <linearGradient id="door" x2="1" y2="0"><stop stop-color="#332f2a"/><stop offset=".55" stop-color="#575048"/><stop offset="1" stop-color="#292622"/></linearGradient>
 <radialGradient id="lamp"><stop stop-color="#f7efd2" stop-opacity=".82"/><stop offset="1" stop-color="#f7efd2" stop-opacity="0"/></radialGradient>
</defs>
<rect width="720" height="404" fill="#171b1d"/>
<polygon points="0,30 720,18 720,305 0,330" fill="url(#wall)"/>
<polygon points="0,330 720,305 720,404 0,404" fill="url(#floor)"/>
<path d="M0 330L720 305M115 326L80 404M245 322L235 404M475 313L510 404M615 309L690 404" stroke="#858787" stroke-opacity=".22" stroke-width="2"/>
<ellipse cx="360" cy="72" rx="260" ry="105" fill="url(#lamp)" opacity=".28"/>
<rect x="268" y="82" width="185" height="245" rx="2" fill="url(#door)" stroke="#111719" stroke-width="7"/>
<rect x="289" y="103" width="143" height="200" fill="none" stroke="#77746f" stroke-opacity=".45" stroke-width="2"/>
<rect x="344" y="116" width="38" height="28" rx="3" fill="#dedbd0" stroke="#202326" stroke-width="2"/>
<text x="363" y="137" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#1b2022">17</text>
<circle cx="422" cy="215" r="5" fill="#c6b48d"/>
<polygon points="62,117 194,101 194,323 62,330" fill="#3e3b36" stroke="#171b1d" stroke-width="5"/>
<text x="128" y="151" text-anchor="middle" font-family="Arial" font-size="18" fill="#d7d2c7">16</text>
<polygon points="509,92 603,80 603,314 509,319" fill="#3b3935" stroke="#171b1d" stroke-width="5"/>
<text x="557" y="127" text-anchor="middle" font-family="Arial" font-size="18" fill="#d7d2c7">18</text>
<polygon points="610,65 720,45 720,305 610,313" fill="#242a2d" stroke="#111517" stroke-width="4"/>
<path d="M628 282h92M635 256h85M642 230h78M649 204h71M656 178h64M663 152h57M670 126h50M677 100h43" stroke="#81898b" stroke-width="4"/>
<path d="M620 75L705 56" stroke="#a7afb0" stroke-width="5"/>
<rect x="610" y="64" width="8" height="250" fill="#111517"/>
<path d="M0 286L720 270" stroke="#a9a99f" stroke-opacity=".22" stroke-width="4"/>
<rect x="0" y="0" width="720" height="404" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="24"/>
</svg>'''
frame = MEDIA / '.chambre17-v17.svg'
video = MEDIA / 'chambre17-cctv.mp4'
frame.write_text(frame_svg, encoding='utf-8')
ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    raise RuntimeError('TRACE V17: ffmpeg absent du runner')
font = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
vf = (
    "scale=720:404,"
    "zoompan=z='min(zoom+0.00045,1.03)':d=200:s=720x404:fps=20,"
    "noise=alls=6:allf=t,"
    "drawbox=x=0:y=0:w=iw:h=34:color=black@0.68:t=fill,"
    f"drawtext=fontfile={font}:text='CAM C2  |  HOTEL LE VAUBERT':x=14:y=8:fontsize=17:fontcolor=white,"
    f"drawtext=fontfile={font}:timecode='02\\:17\\:55\\:00':rate=20:x=w-tw-14:y=8:fontsize=17:fontcolor=white,"
    "drawbox=x=650:y=150:w=24:h=118:color=black@0.62:t=fill:enable='between(t,5.0,5.4)',"
    "drawbox=x=628:y=150:w=26:h=118:color=black@0.62:t=fill:enable='between(t,5.4,5.8)',"
    "drawbox=x=606:y=150:w=28:h=118:color=black@0.62:t=fill:enable='between(t,5.8,6.2)',"
    "drawbox=x=14:y=h-28:w=10:h=10:color=red@0.95:t=fill,"
    f"drawtext=fontfile={font}:text='REC':x=31:y=h-31:fontsize=16:fontcolor=white"
)
cmd=[ffmpeg,'-y','-loop','1','-i',str(frame),'-vf',vf,'-t','10','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(video)]
r=subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
frame.unlink(missing_ok=True)
if r.returncode != 0 or not video.exists() or video.stat().st_size < 50000:
    raise RuntimeError('TRACE V17: génération CCTV échouée: '+r.stderr[-1200:])

# 2. Natural adult French voice for the room-17 emergency message.
NEW_VOICE = 'https://resource2.heygen.ai/text_to_speech/5a47ba280b2b41098e2bc859953d404b/4b1de1582d2c477485ad2e0c2717f0ff/id=ccebab9f-b8cb-4c9e-8151-313bac2b99ef.wav'
pat = re.compile(r"const AUDIO_FILES=\{c1e3:[^,}]+,c7e8:([^,}]+),c8e7:([^}]+)\};")
m = pat.search(s)
if m:
    s = pat.sub("const AUDIO_FILES={c1e3:%r,c7e8:%s,c8e7:%s};" % (NEW_VOICE, m.group(1), m.group(2)), s, count=1)
else:
    old_voice = 'https://resource2.heygen.ai/text_to_speech/5a47ba280b2b41098e2bc859953d404b/25a6a67280574d3da78e97b1935ebfc7/id=bd666844-c2cb-4a7d-88b3-6eef0480b92f.wav'
    if old_voice not in s:
        raise RuntimeError('TRACE V17: AUDIO_FILES c1e3 introuvable')
    s = s.replace(old_voice, NEW_VOICE, 1)

# 3. Unlimited evidence recoupement: 2, 3, 4, 5... any number of pinned pieces.
if 'function recoupSelected()' not in s or 'boardSelection.length<2' not in s:
    raise RuntimeError('TRACE V17: recoupement multi-preuves V16 introuvable')
s = s.replace(
    'Sélectionne 2, 3, 4 pièces ou davantage. TRACE teste tous les liens possibles dans ta sélection.',
    'Sélectionne 2, 3, 4, 5 pièces ou davantage : aucune limite. TRACE teste tous les liens possibles dans ta sélection.'
)
s = s.replace('Tous les couples compatibles seront analysés en une fois.', 'Tous les recoupements compatibles de la sélection sont analysés en une fois.')

# 4. Use refreshed technical plan + CCTV references.
if 'chambre17-plan.svg?v=16' not in s or 'chambre17-cctv.mp4?v=16' not in s:
    raise RuntimeError('TRACE V17: références média V16 introuvables')
s = s.replace('chambre17-plan.svg?v=16', 'chambre17-plan.svg?v=17')
s = s.replace('chambre17-cctv.mp4?v=16', 'chambre17-cctv.mp4?v=17')
s = s.replace('Archive C2 · couloir nord', 'Caméra C2 · couloir nord — extrait 10 s')
s = s.replace('Caméra fixe · aucune sortie par la porte principale ; activité seulement en bord de zone service', 'Caméra fixe · porte principale visible en continu · mouvement uniquement côté escalier/service')

# Better mobile readability for the plan/video and explicit V17 marker.
addon = r'''<style id="trace-v17-quality-css">
.trace-plan-real{image-rendering:auto;max-width:none}
@media(max-width:720px){
 .trace-plan-real{min-width:980px!important}
 .artifact-shell .real-video-card video{min-height:220px;object-fit:cover;background:#05080a}
 .recoup-action{align-items:flex-start!important}
}
</style><script id="trace-v17-quality-js">window.TRACE_V17=true;</script>'''
s = s.replace('</body>', addon + '<!-- TRACE V17 QUALITY PASS --></body>', 1)
APP.write_text(s, encoding='utf-8')

if LOADER.exists():
    l = LOADER.read_text(encoding='utf-8')
    l2 = l.replace('index-1.html?v=local-v16', 'index-1.html?v=local-v17')
    if l2 == l and 'local-v17' not in l:
        raise RuntimeError('TRACE V17: cache-bust loader introuvable')
    LOADER.write_text(l2, encoding='utf-8')

print('TRACE V17 quality pass applied')
