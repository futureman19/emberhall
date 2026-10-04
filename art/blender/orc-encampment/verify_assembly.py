"""Saved-source assembly and decorative clearance audit; no navigation claim."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3];layout=json.loads((root/'public/art/orc-encampment/layout.json').read_text());camp=bpy.data.collections['grimroot-camp'];report=[]
assert len(layout['instances'])==14
for row in layout['instances']:
 source=bpy.data.collections[row['asset']];matches=[o for o in camp.objects if o.name.startswith(row['instance']+'/')];assert len(matches)==len(source.objects)
 p=row['translation'];p=Vector((p[0],-p[2],p[1]));s=row['scale'];s=(s[0],s[2],s[1]);a=row['yawRadians'];assert s==(1,1,1),'no compressed wall instances';maxerr=0
 for o in source.objects:
  c=camp.objects.get(row['instance']+'/'+o.name);assert c,o.name;assert len(c.data.vertices)==len(o.data.vertices)
  for v,w in zip(o.data.vertices,c.data.vertices):
   x,y,z=v.co;x*=s[0];y*=s[1];z*=s[2];expected=p+Vector((x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z));maxerr=max(maxerr,(expected-w.co).length)
 assert maxerr<2e-5,(row['instance'],maxerr)
 report.append({'instance':row['instance'],'asset':row['asset'],'editableParts':len(matches),'maxVertexTransformError':maxerr})
infill=[o for o in camp.objects if o.name.startswith('Front infill stake')];assert len(infill)==10
assert all(max(v.co.x for v in o.data.vertices)-min(v.co.x for v in o.data.vertices)>.26 for o in infill)
def tree(obs):
 vs=[];fs=[]
 for o in obs:
  start=len(vs);vs.extend(tuple(v.co) for v in o.data.vertices);fs.extend(tuple(start+i for i in p.vertices) for p in o.data.polygons)
 return BVHTree.FromPolygons(vs,fs)
gate=tree(bpy.data.collections['palisade-gate'].objects)
for x in [-.5,0,.5]:
 for z in [.2,.8,1.4]:assert gate.ray_cast(Vector((x,-2,z)),Vector((0,1,0)),4)[0] is None,('decorative gate opening',x,z)
cloth=0
for cid in ['war-tent','palisade-gate','lookout-platform','trophy-standard']:
 for o in bpy.data.collections[cid].objects:
  if o.name.endswith(' underside'):
   original=bpy.data.collections[cid].objects.get(o.name[:-10]);assert original,o.name
   n=original.data.polygons[0].normal
   for a,b in zip(original.data.vertices,o.data.vertices):assert abs(abs((a.co-b.co).dot(n))-.025)<1e-5
   cloth+=1
assert cloth>0
cage=tree(bpy.data.collections['empty-cage'].objects)
for direction in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0)]:
 hit=cage.ray_cast(Vector((0,0,.9)),Vector(direction),2)
 assert hit[0] is None or hit[3]>.4,'unoccupied central cage volume'
result={'passed':True,'scope':'Source prefab geometry only; not gameplay, pathfinding or spawning','instances':report,'assemblyOnlyDressingParts':len(camp.objects)-sum(r['editableParts'] for r in report),'uncompressedFrontInfillStakes':len(infill),'separatedClothPanels':cloth,'clearGateSampleRays':9,'emptyCageCenterChecks':4}
(root/'art/verification/orc-encampment/assembly-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
