from pathlib import Path

app=Path('studio24')
index=app/'index.html'
sw=app/'sw.js'

html=index.read_text(encoding='utf-8')
if 'update-helper.js' not in html:
    html=html.replace('  <script src="v8-enhance.js"></script>\n','  <script src="v8-enhance.js"></script>\n  <script src="update-helper.js"></script>\n')
index.write_text(html,encoding='utf-8')

text=sw.read_text(encoding='utf-8')
text=text.replace("studio24-v8-network-universe-1","studio24-v8-updatefix-1")
if "'update-helper.js'" not in text:
    text=text.replace("'v8-enhance.js'","'v8-enhance.js','update-helper.js'")
if "message" not in text:
    text += "\nself.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});\n"
sw.write_text(text,encoding='utf-8')

assert 'update-helper.js' in index.read_text(encoding='utf-8')
assert 'studio24-v8-updatefix-1' in sw.read_text(encoding='utf-8')
print('UPDATE_FIX_OK')
