"""Saved-source assembly and decorative clearance audit; no navigation claim."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3];layout=json.loads((root/'public/art/woodland-shrine/layout.json').read_text());sanctuary=bpy.data.collections['mossveil-sanctuary'];report=[]
assert len(layout['instances'])==11
for row in layout['instances']:
 source=bpy.data.collections[row['asset']];matches=[o for o in sanctuary.objects if o.name.startswith(row['instance']+'/')];assert len(matches)==len(source.objects)
 p=row['translation'];p=Vector((p[0],-p[2],p[1]));s=row['scale'];s=(s[0],s[2],s[1]);a=row['yawRadians'];assert s==(1,1,1),'unscaled module instances';maxerr=0
 for o in source.objects:
  c=sanctuary.objects.get(row['instance']+'/'+o.name);assert c,o.name;assert len(c.data.vertices)==len(o.data.vertices)
  for v,w in zip(o.data.vertices,c.data.vertices):
   x,y,z=v.co;x*=s[0];y*=s[1];z*=s[2];expected=p+Vector((x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z));maxerr=max(maxerr,(expected-w.co).length)
 assert maxerr<2e-5,(row['instance'],maxerr)
 report.append({'instance':row['instance'],'asset':row['asset'],'editableParts':len(matches),'maxVertexTransformError':maxerr})

result={'passed':True,'scope':'Static vertex-transform proof only; no gameplay or collision acceptance','instances':report,'assemblyOnlyDressingParts':len(sanctuary.objects)-sum(r['editableParts'] for r in report)}
(root/'art/verification/woodland-shrine/assembly-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
