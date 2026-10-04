"""Package only the three owned woodland-shrine directories; exclude backups/self."""
from pathlib import Path
import zipfile,hashlib,json
ROOT=Path(__file__).resolve().parents[3];EV=ROOT/'art/verification/woodland-shrine'
archive=EV/'emberhall-woodland-shrine-source.zip';inventory=EV/'delivery-inventory.json'
files=[]
for rel in ['art/blender/woodland-shrine','public/art/woodland-shrine','art/verification/woodland-shrine']:
 for p in (ROOT/rel).rglob('*'):
  if p.is_file() and p not in [archive,inventory] and p.suffix not in ['.blend1','.blend2','.pyc','.zip'] and '__pycache__' not in p.parts:files.append(p)
files.sort();records=[{'file':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert len(z.namelist())==len(files)
 for r in records:assert hashlib.sha256(z.read(r['file'])).hexdigest()==r['sha256']
result={'archive':archive.relative_to(ROOT).as_posix(),'archiveBytes':archive.stat().st_size,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'archiveReadbackVerified':True,'fileCount':len(records),'files':records}
inventory.write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='files'},indent=2))
