"""Verify preservation; package this isolated review kit; read back every ZIP member."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[3];EV=ROOT/'art/verification/character-reimagined';SRC=ROOT/'art/blender/character-reimagined';OUT=ROOT/'public/art/character-reimagined'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
snapshot=json.loads((EV/'preservation-before.json').read_text())
changed=[name for name,h in snapshot.items() if not (ROOT/name).is_file() or sha(ROOT/name)!=h]
assert not changed,changed
(EV/'preservation-verification.json').write_text(json.dumps({'passed':True,'filesChecked':len(snapshot),'changed':changed,'scope':'Every snapshotted source file and package file, plus current character source/generator/GLB/manifest; no original changes.'},indent=2))
manifest=json.loads((OUT/'manifest.json').read_text())
for a in manifest['assets']:assert sha(OUT/a['file'])==a['sha256']
for name in ['source-verification.json','geometry-verification.json','independent-saved-source-audit.json','browser-full-verification.json']:
 report=json.loads((EV/name).read_text());assert report['passed'],name
browser=json.loads((EV/'browser-full-verification.json').read_text());assert browser['serverClosed']
for a in json.loads((EV/'independent-saved-source-audit.json').read_text())['assets']:
 assert a['sourceSha256']==sha(SRC/(a['id']+'.blend'));assert a['glbSha256']==sha(OUT/(a['id']+'.glb'))
# Prevent a stale browser audit from passing after export regeneration.
for a in browser['httpHashes']:assert a['sha256']==sha(OUT/(a['id']+'.glb'))
archive=EV/'emberhall-character-reimagined-source.zip';excluded={'package-inventory.json','package-verification.json'}
files=sorted(f for d in [SRC,OUT,EV] for f in d.rglob('*') if f.is_file() and f.suffix not in ['.zip','.blend1','.pyc'] and f.name not in excluded and '__pycache__' not in f.parts)
inventory=[{'path':str(f.relative_to(ROOT)).replace('\\','/'),'bytes':f.stat().st_size,'sha256':sha(f)} for f in files]
(EV/'package-inventory.json').write_text(json.dumps({'files':inventory},indent=2))
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f,item in zip(files,inventory):z.write(f,item['path'])
 z.write(EV/'package-inventory.json','art/verification/character-reimagined/package-inventory.json')
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert len(z.namelist())==len(inventory)+1
 for item in inventory:
  data=z.read(item['path']);assert len(data)==item['bytes'];assert hashlib.sha256(data).hexdigest()==item['sha256'];assert sha(ROOT/item['path'])==item['sha256'],'concurrent change '+item['path']
 assert json.loads(z.read('art/verification/character-reimagined/package-inventory.json'))['files']==inventory
 assert not any(name.endswith('.blend1') for name in z.namelist())
report={'passed':True,'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),'members':len(inventory)+1,'payloadFilesVerified':len(inventory),'readback':'Every ZIP member byte length and SHA256 matched the exact current file; inventory JSON parsed back; CRC test clean.','sourceAndBrowserHashesFresh':True,'preservedExistingFiles':len(snapshot),'backupBlendFilesExcluded':True}
(EV/'package-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
