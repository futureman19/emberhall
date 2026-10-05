"""Read-only preservation audit against the pre-authoring snapshot."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[3];ev=root/'art/verification/trails-kit'
baseline=json.loads((ev/'scope-baseline.json').read_text())
changed=[f for f,h in baseline.items() if not (root/f).is_file() or hashlib.sha256((root/f).read_bytes()).hexdigest()!=h]
result={'passed':not changed,'checkedFiles':len(baseline),'changed':changed,'scope':'Pre-existing src, package.json and original landscape-kit source/public/evidence SHA256 preservation'}
(ev/'scope-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));assert not changed
