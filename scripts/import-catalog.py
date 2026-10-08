"""Import a verified catalogue snapshot; never promote missing or unreviewed artwork."""
from pathlib import Path
from extra_art import merge_extra_art, require
import sys,json,re,hashlib,shutil,subprocess
source=Path(sys.argv[1]).resolve()
root=Path(__file__).resolve().parents[1]
out=root/'assets';out.mkdir(exist_ok=True)
old=json.loads((source/'catalog.json').read_text(encoding='utf-8'))
svg=(source/'display-library-cache-v2.svg').read_bytes()
meta=json.loads((source/'display-library-cache-v2.json').read_text(encoding='utf-8'))
require(hashlib.sha256(svg).hexdigest()==meta['sha256'], 'Snapshot SVG hash mismatch')
require(hashlib.sha256((source/'catalog.json').read_bytes()).hexdigest()==meta['catalogJsonSha256'], 'Snapshot catalog hash mismatch')
require(meta['nativePixelEquivalencePassed'] is True, 'Snapshot pixel equivalence not verified')
symbols=set(re.findall(r'<symbol id="([^"]+)"',svg.decode('utf-8')))
keys=['id','name','en','group','appearance','aliases','asset','sourceUrls','visualSourceUrls','artSourceLabel','artProvenance']
forms=[]
for form in old['forms']:
 row={key:form[key] for key in keys if key in form}
 row['asset']=form.get('asset') if form.get('visualVerified') is True and form.get('asset') in symbols else None
 forms.append(row)
reviewed=sum(bool(form['asset']) for form in forms)
catalog={'schemaVersion':1,'groups':old['groups'],'coverage':{'total':len(forms),'reviewed':reviewed,'missing':len(forms)-reviewed},'forms':forms}
manifest=json.loads((source/'source-art-manifest.json').read_text(encoding='utf-8'))
active={form['id'] for form in forms if form['asset']}
assets=[{key:entry[key] for key in ['formId','url','pageUrl','rights','contentType','renderMode'] if key in entry} for entry in manifest['assets'] if entry['formId'] in active]
provenance={'source':'Reviewed Ben10 cosmic-selector archive snapshot','catalogSha256':hashlib.sha256((source/'catalog.json').read_bytes()).hexdigest(),'svgSha256':hashlib.sha256(svg).hexdigest(),'coverage':catalog['coverage'],'assets':assets,'notes':['Community-reposted images are not publisher-hosted originals.','Artwork remains copyrighted by its respective owners. No open artwork license is asserted.','Missing artwork stays missing. Silhouettes use the previously verified native display cache.']}
catalog,svg,provenance=merge_extra_art(catalog,svg,provenance)
(out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'silhouettes.svg').write_bytes(svg)
(out/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'coverage':catalog['coverage'],'svgBytes':len(svg)},ensure_ascii=False))
if (root/'scripts/fit-dial.py').exists():
 subprocess.run([sys.executable,str(root/'scripts/fit-dial.py')],check=True)
