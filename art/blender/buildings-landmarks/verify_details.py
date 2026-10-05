"""Independent exterior art checks. These are NOT runtime navigation/animation tests."""
import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[3];checks={}
def tree(obs):
 vs=[];fs=[]
 for o in obs:
  offset=len(vs);vs.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices);fs.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
 return BVHTree.FromPolygons(vs,fs)
for aid,w,d,h,rise in [('hearth-cottage',3,2.45,1.65,1),('roadside-inn',4.2,3.1,2.85,1.35),('watermill',3,2.6,2.15,1.05)]:
 obs=[o for o in bpy.data.collections[aid].objects if o.name.startswith('Solid gable panel ')]
 assert len(obs)==16,(aid,'solid gables');bvh=tree(obs)
 for side in [-1,1]:
  for y in [-d*.28,0,d*.28]:
   z=.3+h+.1+rise*.17
   hit=bvh.ray_cast(Vector((side*(w/2+1),y,z)),Vector((-side,0,0)),1.5)
   assert hit[0] is not None,(aid,side,y,'gable ray hole')
 checks[aid]={'solidGablePanels':16,'gableSampleRays':6,'passed':True}
obs=list(bpy.data.collections['gatehouse'].objects);bvh=tree(obs);rays=0
for x in [-.7,0,.7]:
 for z in [.2,.9,1.8]:
  assert bvh.ray_cast(Vector((x,-3,z)),Vector((0,1,0)),6)[0] is None,(x,z,'blocked visual gate opening');rays+=1
checks['gatehouse']={'clearVisualPassageRays':rays,'sampledWidth':1.4,'sampledHeight':1.8,'notNavigationAcceptance':True}
obs=list(bpy.data.collections['watermill'].objects)
wheel=[o for o in obs if o.name.startswith(('Wheel rim segment','Wheel radial spoke','Wheel paddle'))]
sluice=[o for o in obs if o.name.startswith('Raised sluice bed')];assert len(sluice)==1
highest=max(v.co.z for o in wheel for v in o.data.vertices);lowest=min(v.co.z for o in sluice for v in o.data.vertices)
assert lowest-highest>.05,('sluice clearance',lowest-highest)
assert len([o for o in obs if o.name.startswith('Outboard wheel bearing leg')])==2
assert len([o for o in obs if o.name.startswith('Sluice trestle post')])==2
checks['watermill'].update({'sluiceAboveWheelClearance':lowest-highest,'outboardBearingLegs':2,'sluiceTrestlePosts':2,'noAnimationClaim':True})
assert any(o.name.startswith('Bell crown suspension') for o in bpy.data.collections['bell-tower'].objects)
checks['bell-tower']={'crownSuspensionPresent':True}
report={'passed':True,'scope':'Saved Blender exterior geometry only','checks':checks};(root/'art/verification/buildings-landmarks/detail-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
