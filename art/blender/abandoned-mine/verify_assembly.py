"""Saved-source assembly and decorative clearance audit; no navigation claim."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3];layout=json.loads((root/'public/art/abandoned-mine/layout.json').read_text());camp=bpy.data.collections['hollowvein-diggings'];report=[]
assert len(layout['instances'])==10
for row in layout['instances']:
 source=bpy.data.collections[row['asset']];matches=[o for o in camp.objects if o.name.startswith(row['instance']+'/')];assert len(matches)==len(source.objects)
 p=row['translation'];p=Vector((p[0],-p[2],p[1]));s=row['scale'];s=(s[0],s[2],s[1]);a=row['yawRadians'];assert s==(1,1,1),'unscaled module instances';maxerr=0
 for o in source.objects:
  c=camp.objects.get(row['instance']+'/'+o.name);assert c,o.name;assert len(c.data.vertices)==len(o.data.vertices)
  for v,w in zip(o.data.vertices,c.data.vertices):
   x,y,z=v.co;x*=s[0];y*=s[1];z*=s[2];expected=p+Vector((x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z));maxerr=max(maxerr,(expected-w.co).length)
 assert maxerr<2e-5,(row['instance'],maxerr)
 report.append({'instance':row['instance'],'asset':row['asset'],'editableParts':len(matches),'maxVertexTransformError':maxerr})

# Mine seal is a solid visual obstruction, not a traversable portal.
vs=[];fs=[]
for o in bpy.data.collections['sealed-mine-mouth'].objects:
 start=len(vs);vs.extend(tuple(v.co) for v in o.data.vertices);fs.extend(tuple(start+i for i in p.vertices) for p in o.data.polygons)
tree=BVHTree.FromPolygons(vs,fs)
for x in [-.5,0,.5]:
 for z in [.4,1,1.6]:assert tree.ray_cast(Vector((x,-3,z)),Vector((0,1,0)),5)[0] is not None
result={'passed':True,'scope':'Static geometry only; no walkability or collision acceptance','instances':report,'assemblyOnlyDressingParts':len(camp.objects)-sum(r['editableParts'] for r in report),'blockedMineSealRays':9}
(root/'art/verification/abandoned-mine/assembly-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
